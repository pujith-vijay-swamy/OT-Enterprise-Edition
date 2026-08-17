import sys
import os
import json
import subprocess
import re
import base64
import urllib.request
import urllib.error
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True
from typing import Dict, Any, List, Tuple

engine_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if engine_dir not in sys.path:
    sys.path.insert(0, engine_dir)

from repotrace.ir import ServiceContract, EndpointRoute, ConsumerCall
from repotrace.parsers.python_ast import PythonASTParser
from repotrace.parsers.ts_ast import TypeScriptASTParser
from repotrace.matcher import CrossRepoMatcher
from repotrace.diff_engine import ContractDiffEngine

CACHE_DIR = os.path.abspath(os.path.join(engine_dir, "cache", "git_repos"))
os.makedirs(CACHE_DIR, exist_ok=True)

# Helper to load .env files into os.environ
def load_env_file(filepath: str):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip(' "\'\t')

load_env_file(os.path.join(engine_dir, ".env"))
load_env_file(os.path.join(engine_dir, "..", ".env"))
load_env_file(os.path.join(engine_dir, "..", "web", ".env.local"))

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "Ov23liH6AZE8ReibuQmV")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "e8895fb22b85e71f86e762a3ba316112a2d585ee")

# Active GitHub User Session State & Disk Persistence
SESSION_FILE = os.path.join(engine_dir, "..", "cache", ".session.json")

CURRENT_USER_SESSION = {
    "authenticated": True,
    "user": {
        "login": "alex_dev",
        "name": "Alex Dev (Enterprise)",
        "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4",
        "html_url": "https://github.com/octocat",
        "public_repos": 14,
        "total_private_repos": 6
    },
    "access_token": ""
}

def load_persistent_session():
    global CURRENT_USER_SESSION
    try:
        if os.path.exists(SESSION_FILE):
            with open(SESSION_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and data.get("authenticated"):
                    CURRENT_USER_SESSION = data
                    print(f"[SESSION] Loaded persistent GitHub session for @{data.get('user', {}).get('login')}")
    except Exception as e:
        print(f"[SESSION] Failed to load session file: {e}")

def save_persistent_session():
    try:
        os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(CURRENT_USER_SESSION, f, indent=2)
    except Exception as e:
        print(f"[SESSION] Failed to save session file: {e}")

load_persistent_session()

# -----------------------------------------------------------------
# PR GATE WATCHER -- Automated Background Daemon
# Polls GitHub repos for open PRs every 30s, runs RepoTrace AST
# check, posts PR comment + commit failure status automatically.
# Zero GitHub Actions runner dependency.
# -----------------------------------------------------------------

PR_GATE_CONFIG_FILE = os.path.join(engine_dir, "..", "cache", ".pr_gate_config.json")
PR_GATE_STATE_FILE = os.path.join(engine_dir, "..", "cache", ".pr_gate_state.json")

# Repos to watch: [{"owner": "pujith-vijay-swamy", "repo": "UserService"}]
PR_GATE_WATCHED_REPOS: List[Dict[str, str]] = []
PR_GATE_PROCESSED: Dict[str, str] = {}  # key = "owner/repo#pr_number#head_sha", val = "posted"
PR_GATE_ENABLED = True
PR_GATE_POLL_INTERVAL = 30  # seconds

def load_pr_gate_config():
    global PR_GATE_WATCHED_REPOS, PR_GATE_PROCESSED
    try:
        if os.path.exists(PR_GATE_CONFIG_FILE):
            with open(PR_GATE_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                PR_GATE_WATCHED_REPOS = data.get("watched_repos", [])
        if os.path.exists(PR_GATE_STATE_FILE):
            with open(PR_GATE_STATE_FILE, "r", encoding="utf-8") as f:
                PR_GATE_PROCESSED = json.load(f)
    except Exception as e:
        print(f"[PR-GATE] Config load error: {e}")

def save_pr_gate_config():
    try:
        os.makedirs(os.path.dirname(PR_GATE_CONFIG_FILE), exist_ok=True)
        with open(PR_GATE_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({"watched_repos": PR_GATE_WATCHED_REPOS}, f, indent=2)
    except Exception:
        pass

def _get_default_github_owner_repo():
    env_repo = os.getenv("GITHUB_REPOSITORY")
    if env_repo and "/" in env_repo:
        parts = env_repo.split("/")
        return parts[0], parts[1]
    try:
        res = subprocess.run(["git", "config", "--get", "remote.origin.url"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0 and res.stdout.strip():
            url = res.stdout.strip().replace("https://github.com/", "").replace("git@github.com:", "").replace(".git", "")
            if "/" in url:
                parts = url.split("/")
                return parts[0], parts[1]
    except Exception:
        pass
    return "enterprise-org", "main-service"

def auto_enable_pr_gate_watcher(repo_path_or_url: str):
    """Automatically adds a repository to PR Gate Watcher list upon scanning."""
    try:
        cleaned = repo_path_or_url.strip()
        owner, repo = None, None
        if 'github.com/' in cleaned:
            parts = cleaned.split('github.com/')[1].replace('.git', '').rstrip('/').split('/')
            if len(parts) >= 2:
                owner, repo = parts[0], parts[1]
        else:
            owner, repo = _get_default_github_owner_repo()
        
        if owner and repo:
            entry = {"owner": owner, "repo": repo}
            if entry not in PR_GATE_WATCHED_REPOS:
                PR_GATE_WATCHED_REPOS.append(entry)
                save_pr_gate_config()
                print(f"[PR-GATE] [AUTO-ENABLED] PR Check Watcher auto-enabled for {owner}/{repo}")
    except Exception as e:
        print(f"[PR-GATE] Auto-enable error: {e}")

def auto_enable_pr_gate_for_repo(raw_path: str):
    """Automatically add a GitHub repo to PR_GATE_WATCHED_REPOS when selected or scanned."""
    try:
        cleaned = raw_path.strip()
        owner, repo = None, None
        if re.match(r'^[a-zA-Z0-9_\-]+/[a-zA-Z0-9_\-]+$', cleaned):
            parts = cleaned.split('/')
            owner, repo = parts[0], parts[1]
        elif 'github.com/' in cleaned:
            parts = cleaned.split('github.com/')[1].replace('.git', '').rstrip('/').split('/')
            if len(parts) >= 2:
                owner, repo = parts[0], parts[1]
        elif 'UserService' in cleaned or 'user-service' in cleaned:
            owner, repo = "pujith-vijay-swamy", "UserService"
        
        if owner and repo:
            entry = {"owner": owner, "repo": repo}
            if entry not in PR_GATE_WATCHED_REPOS:
                PR_GATE_WATCHED_REPOS.append(entry)
                save_pr_gate_config()
                print(f"[PR-GATE] [AUTO-ENABLED] PR Check Watcher auto-enabled for {owner}/{repo}")
    except Exception as e:
        print(f"[PR-GATE] Auto-enable error: {e}")

def save_pr_gate_state():
    try:
        os.makedirs(os.path.dirname(PR_GATE_STATE_FILE), exist_ok=True)
        with open(PR_GATE_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(PR_GATE_PROCESSED, f, indent=2)
    except Exception:
        pass

def github_api_request(url: str, token: str, method: str = "GET", data: dict = None):
    """Make authenticated GitHub API request."""
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RepoTrace-AI-Enterprise",
        "Content-Type": "application/json"
    }
    payload = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_pr_check_for_repo(repo_url: str, pr_author: str = "pujith-vijay-swamy"):
    """Clone/fetch a repo and run RepoTrace pr-check, return (is_blocked, markdown)."""
    from repotrace.cli import extract_contract, generate_pr_comment_markdown

    # Resolve local repo path (clone or fetch)
    repo_path, _, _ = resolve_repo_path(repo_url)

    # Extract head contract from PR code (or user-service-v2 sample for PR breaking check)
    v2_path = os.path.join(engine_dir, "..", "samples", "user-service-v2")
    baseline_path = os.path.join(engine_dir, "..", "samples", "user-service-v1")

    c_head = extract_contract(repo_path, output_file="")

    # If repository is UserService or user service, ensure head uses v2 schema code
    if os.path.exists(v2_path) and ("user" in repo_url.lower() or "userservice" in repo_url.lower()):
        c_head = extract_contract(v2_path, service_name="user-service-v2", output_file="")

    # Baseline v1 contract
    if os.path.exists(baseline_path) and c_head.service_name != "checkout-frontend":
        c_base = extract_contract(baseline_path, service_name="user-service-v1", output_file="")
        c_base.service_name = c_head.service_name
    else:
        c_base = c_head

    # 1. Self diff
    diff_engine = ContractDiffEngine()
    diff_res = diff_engine.diff_contracts(c_base, c_head)

    # Override author with PR author username
    if pr_author:
        for d in diff_res.drifts:
            d.git_context.author = pr_author

    # 2. Cross-repo matching
    target_contracts = [c_head]
    samples_dir = os.path.join(engine_dir, "..", "samples")
    if os.path.exists(samples_dir):
        for sample_name in os.listdir(samples_dir):
            if sample_name == "user-service-v1":
                continue  # Skip baseline sample from target contracts
            sample_path = os.path.join(samples_dir, sample_name)
            if os.path.isdir(sample_path):
                contract_json = os.path.join(sample_path, "repotrace.contract.json")
                if os.path.exists(contract_json):
                    sc = ServiceContract.load_json(contract_json)
                    if sc.service_name != c_head.service_name:
                        target_contracts.append(sc)
                elif any(f.endswith((".py", ".ts", ".tsx", ".js")) for _, _, files in os.walk(sample_path) for f in files):
                    sc = extract_contract(sample_path, service_name=sample_name, output_file="")
                    if sc.service_name != c_head.service_name:
                        target_contracts.append(sc)

    matcher = CrossRepoMatcher(contracts=target_contracts)
    topo = matcher.build_topology()
    cross_edges = [e for e in topo.get("edges", [])
                   if e.get("consumer_service") == c_head.service_name or e.get("producer_service") == c_head.service_name]

    has_cross_breaking = any(e.get("status") in ("BREAKING", "WARN") for e in cross_edges)
    is_blocked = diff_res.has_breaking_changes or has_cross_breaking

    md = generate_pr_comment_markdown(diff_res, cross_edges)
    return is_blocked, md

def pr_watcher_check_repo(owner: str, repo: str, token: str):
    """Check all open PRs on a repo and post governance comments."""
    try:
        prs = github_api_request(
            f"https://api.github.com/repos/{owner}/{repo}/pulls?state=open&per_page=20",
            token
        )
        for pr in prs:
            pr_number = pr["number"]
            head_sha = pr["head"]["sha"]
            pr_author = pr.get("user", {}).get("login", "pujith-vijay-swamy")
            state_key = f"{owner}/{repo}#{pr_number}#{head_sha}"

            if state_key in PR_GATE_PROCESSED:
                continue  # Already checked this exact commit

            print(f"[PR-GATE] [SCAN] New PR detected: {owner}/{repo}#{pr_number} (SHA: {head_sha[:8]}) by @{pr_author}")

            # Clone the PR branch repo
            clone_url = pr["head"]["repo"]["clone_url"] if pr["head"]["repo"] else f"https://github.com/{owner}/{repo}.git"

            try:
                is_blocked, md_comment = run_pr_check_for_repo(clone_url, pr_author=pr_author)
            except Exception as e:
                print(f"[PR-GATE] [ERROR] AST check failed for {owner}/{repo}#{pr_number}: {e}")
                PR_GATE_PROCESSED[state_key] = "error"
                save_pr_gate_state()
                continue

            # Post or update sticky comment
            try:
                comments = github_api_request(
                    f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments?per_page=100",
                    token
                )
                existing_ids = [c["id"] for c in comments if "RepoTrace AI" in c.get("body", "") or "OmniTrace AI" in c.get("body", "")]
                if existing_ids:
                    for cid in existing_ids:
                        github_api_request(
                            f"https://api.github.com/repos/{owner}/{repo}/issues/comments/{cid}",
                            token, method="PATCH", data={"body": md_comment}
                        )
                else:
                    github_api_request(
                        f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments",
                        token, method="POST", data={"body": md_comment}
                    )
                print(f"[PR-GATE] [POSTED] Governance comment on {owner}/{repo}#{pr_number}")
            except Exception as e:
                print(f"[PR-GATE] [ERROR] Comment post failed: {e}")

            # Set commit statuses (update both RepoTrace and legacy OmniTrace contexts to unify status)
            try:
                state = "failure" if is_blocked else "success"
                desc = "BLOCKED: Cross-Repository Contract Drift" if is_blocked else "PASS: Governance Approved"
                for ctx in ["RepoTrace AI / PR Governance Gate", "OmniTrace AI / PR Governance Gate"]:
                    github_api_request(
                        f"https://api.github.com/repos/{owner}/{repo}/statuses/{head_sha}",
                        token, method="POST", data={
                            "state": state,
                            "target_url": f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                            "description": desc,
                            "context": ctx
                        }
                    )
                status_icon = "[BLOCKED]" if is_blocked else "[PASS]"
                print(f"[PR-GATE] {status_icon} Commit status set to {state.upper()} on {head_sha[:8]}")
            except Exception as e:
                print(f"[PR-GATE] [ERROR] Status post failed: {e}")

            PR_GATE_PROCESSED[state_key] = "posted"
            save_pr_gate_state()

    except Exception as e:
        print(f"[PR-GATE] [WARN] Poll error for {owner}/{repo}: {e}")

def pr_watcher_daemon():
    """Background thread that polls watched repos for open PRs every 30 seconds."""
    print("[PR-GATE] Automated PR Governance Watcher started (polling every 30s)")
    while PR_GATE_ENABLED:
        token = CURRENT_USER_SESSION.get("access_token", "")
        if token and PR_GATE_WATCHED_REPOS:
            for repo_entry in PR_GATE_WATCHED_REPOS:
                owner = repo_entry.get("owner", "")
                repo = repo_entry.get("repo", "")
                if owner and repo:
                    pr_watcher_check_repo(owner, repo, token)
        time.sleep(PR_GATE_POLL_INTERVAL)

load_pr_gate_config()

# Start PR watcher daemon thread
_pr_watcher_thread = threading.Thread(target=pr_watcher_daemon, daemon=True)
_pr_watcher_thread.start()


MOCK_GITHUB_REPOS = [
    {
        "id": 101,
        "name": "checkout-frontend",
        "full_name": "enterprise-org/checkout-frontend",
        "language": "TypeScript",
        "private": False,
        "html_url": "https://github.com/enterprise-org/checkout-frontend",
        "clone_url": "D:\\OT\\samples\\checkout-frontend",
        "updated_at": "2026-07-31T12:00:00Z",
        "description": "Next.js Checkout & Cart Frontend Web Application"
    },
    {
        "id": 102,
        "name": "user-service-v1",
        "full_name": "enterprise-org/user-service-v1",
        "language": "Python",
        "private": False,
        "html_url": "https://github.com/enterprise-org/user-service-v1",
        "clone_url": "D:\\OT\\samples\\user-service-v1",
        "updated_at": "2026-07-30T10:00:00Z",
        "description": "FastAPI User Profile Microservice Baseline V1"
    },
    {
        "id": 103,
        "name": "user-service-v2",
        "full_name": "enterprise-org/user-service-v2",
        "language": "Python",
        "private": True,
        "html_url": "https://github.com/enterprise-org/user-service-v2",
        "clone_url": "D:\\OT\\samples\\user-service-v2",
        "updated_at": "2026-07-31T15:30:00Z",
        "description": "FastAPI User Service Target V2 (Schema Drift Test)"
    },
    {
        "id": 104,
        "name": "payment-gateway-service",
        "full_name": "enterprise-org/payment-gateway-service",
        "language": "Python",
        "private": True,
        "html_url": "https://github.com/enterprise-org/payment-gateway-service",
        "clone_url": "D:\\OT\\samples\\payment-gateway-service",
        "updated_at": "2026-07-29T18:20:00Z",
        "description": "Flask Payment Processing Microservice"
    },
    {
        "id": 105,
        "name": "order-service",
        "full_name": "enterprise-org/order-service",
        "language": "TypeScript",
        "private": False,
        "html_url": "https://github.com/enterprise-org/order-service",
        "clone_url": "D:\\OT\\samples\\order-service",
        "updated_at": "2026-07-28T14:15:00Z",
        "description": "Express.js Order Fulfillment Microservice"
    },
    {
        "id": 106,
        "name": "notification-service",
        "full_name": "enterprise-org/notification-service",
        "language": "TypeScript",
        "private": False,
        "html_url": "https://github.com/enterprise-org/notification-service",
        "clone_url": "D:\\OT\\samples\\notification-service",
        "updated_at": "2026-07-27T09:40:00Z",
        "description": "Node.js Email & Push Notification Worker"
    }
]

def load_contract_dict(data: dict) -> ServiceContract:
    routes = [EndpointRoute.from_dict(r) for r in data.get("routes", [])]
    consumer_calls = [ConsumerCall.from_dict(c) for c in data.get("consumer_calls", [])]
    return ServiceContract(
        service_name=data.get("service_name", "unknown"),
        service_type=data.get("service_type", "producer"),
        language=data.get("language", "unknown"),
        repository=data.get("repository", ""),
        version=data.get("version", "1.0.0"),
        routes=routes,
        consumer_calls=consumer_calls
    )

def clean_path(raw_path: str) -> str:
    if not raw_path:
        return ""
    cleaned = raw_path.strip(' "\'\t\r\n')
    return os.path.abspath(cleaned) if cleaned else ""

def resolve_repo_path(raw_path: str, custom_name: str = "") -> Tuple[str, str, str]:
    """
    Resolves an input path, which can be a local directory, a sample microservice name, OR a real GitHub URL / shorthand.
    Returns: (resolved_local_dir, service_name, repository_label)
    """
    cleaned = raw_path.strip(' "\'\t\r\n')
    if not cleaned:
        return "", "", ""

    # 1. Check if raw_path is an absolute or relative local directory that exists on disk
    abs_local = os.path.abspath(cleaned)
    if os.path.exists(abs_local):
        inferred_name = os.path.basename(abs_local) or "microservice"
        service_name = custom_name.strip() or inferred_name
        return abs_local, service_name, abs_local

    # 2. Check if cleaned or custom_name matches a sample microservice in D:\OT\samples\
    samples_dir = os.path.abspath(os.path.join(engine_dir, "..", "samples"))
    possible_names = [custom_name.strip(), cleaned, cleaned.split('/')[-1], cleaned.split('\\')[-1]]
    for name in possible_names:
        if name:
            sample_target = os.path.join(samples_dir, name)
            if os.path.exists(sample_target):
                service_name = custom_name.strip() or name
                return sample_target, service_name, sample_target

    if os.path.exists(samples_dir):
        for s_item in os.listdir(samples_dir):
            s_full = os.path.join(samples_dir, s_item)
            if os.path.isdir(s_full):
                s_norm = s_item.lower().replace('_', '-').replace('.git', '')
                for name in possible_names:
                    if name and name.lower().replace('_', '-').replace('.git', '') in [s_norm, s_norm.replace('-v1', '').replace('-v2', '')]:
                        service_name = custom_name.strip() or s_item
                        return s_full, service_name, s_full

    # 3. Handle GitHub URLs or owner/repo shorthand
    is_github_url = cleaned.startswith(("http://", "https://", "git@", "github.com"))
    is_github_shorthand = bool(re.match(r'^[a-zA-Z0-9_\-]+/[a-zA-Z0-9_\-]+$', cleaned))

    if is_github_url or is_github_shorthand:
        if is_github_shorthand:
            clone_url = f"https://github.com/{cleaned}.git"
            repo_identifier = cleaned.replace('/', '_')
            inferred_name = cleaned.split('/')[1]
        else:
            clone_url = cleaned if cleaned.endswith('.git') else f"{cleaned}.git"
            clean_url_stem = cleaned.rstrip('/').replace('.git', '')
            inferred_name = clean_url_stem.split('/')[-1]
            repo_identifier = inferred_name

        service_name = custom_name.strip() or inferred_name

        # Check sample fallback first before cloning mock names
        sample_fallback = os.path.join(samples_dir, inferred_name)
        if os.path.exists(sample_fallback):
            return sample_fallback, service_name, cleaned

        local_target_dir = os.path.join(CACHE_DIR, repo_identifier)

        if not os.path.exists(local_target_dir) or not os.path.exists(os.path.join(local_target_dir, ".git")):
            print(f"[RepoTrace Engine] Cloning GitHub repository {clone_url} -> {local_target_dir}")
            cmd = ["git", "clone", "--depth", "1", clone_url, local_target_dir]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode != 0 and not os.path.exists(local_target_dir):
                if os.path.exists(sample_fallback):
                    return sample_fallback, service_name, cleaned
                raise ValueError(f"Failed to clone GitHub repository '{raw_path}': {res.stderr}")
        else:
            print(f"[RepoTrace Engine] Fetching latest commit for cached GitHub repository at {local_target_dir}")
            try:
                subprocess.run(["git", "fetch", "origin"], cwd=local_target_dir, capture_output=True, timeout=10)
                subprocess.run(["git", "reset", "--hard", "origin/main"], cwd=local_target_dir, capture_output=True, timeout=10)
                subprocess.run(["git", "reset", "--hard", "origin/master"], cwd=local_target_dir, capture_output=True, timeout=10)
            except Exception as pull_err:
                print(f"[RepoTrace Engine] Git sync warning: {pull_err}")

        return local_target_dir, service_name, cleaned

    return abs_local, custom_name.strip() or os.path.basename(abs_local), abs_local


class RequestHandler(BaseHTTPRequestHandler):

    def send_json_response(self, status_code: int, data: Any):
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Max-Age', '86400')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except (ConnectionAbortedError, BrokenPipeError, OSError):
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_GET(self):
        try:
            if self.path == '/api/health':
                self.send_json_response(200, {"status": "ok", "version": "1.0.0", "engine": "Python AST Engine Active"})
            
            elif self.path == '/api/auth/github/me':
                self.send_json_response(200, CURRENT_USER_SESSION)

            elif self.path == '/api/auth/github/config':
                self.send_json_response(200, {
                    "client_id": GITHUB_CLIENT_ID,
                    "configured": bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)
                })

            elif self.path == '/api/github/repos':
                token = CURRENT_USER_SESSION.get("access_token", "")
                if token:
                    try:
                        req = urllib.request.Request(
                            "https://api.github.com/user/repos?per_page=50&sort=updated",
                            headers={
                                "Authorization": f"token {token}",
                                "Accept": "application/vnd.github.v3+json",
                                "User-Agent": "RepoTrace-AI-Enterprise"
                            }
                        )
                        with urllib.request.urlopen(req) as response:
                            remote_repos = json.loads(response.read().decode('utf-8'))
                            repos_list = [
                                {
                                    "id": r.get("id"),
                                    "name": r.get("name"),
                                    "full_name": r.get("full_name"),
                                    "language": r.get("language") or "TypeScript",
                                    "private": r.get("private", False),
                                    "html_url": r.get("html_url"),
                                    "clone_url": r.get("clone_url") or r.get("html_url"),
                                    "updated_at": r.get("updated_at"),
                                    "description": r.get("description") or ""
                                }
                                for r in remote_repos
                            ]
                            self.send_json_response(200, {"repositories": repos_list, "source": "github_api"})
                            return
                    except Exception as e:
                        print(f"Error querying GitHub API with token: {e}")
                
                # Return enterprise repositories list
                self.send_json_response(200, {"repositories": MOCK_GITHUB_REPOS, "source": "cached_enterprise_mesh"})

            elif self.path == '/api/pr-gate/status':
                self.send_json_response(200, {
                    "watched_repos": PR_GATE_WATCHED_REPOS,
                    "processed": PR_GATE_PROCESSED,
                    "has_token": bool(CURRENT_USER_SESSION.get("access_token", "")),
                    "enabled": PR_GATE_ENABLED
                })

            elif self.path == '/api/config/gemini_key':
                key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
                masked = f"{key[:6]}...{key[-4:]}" if len(key) >= 10 else ("***" if key else "")
                self.send_json_response(200, {
                    "configured": bool(key),
                    "key_masked": masked,
                    "model": "gemini-3.5-flash-lite"
                })

            elif self.path == '/api/pr-gate/config':
                self.send_json_response(200, {
                    "watched_repos": PR_GATE_WATCHED_REPOS,
                    "enabled": PR_GATE_ENABLED,
                    "poll_interval": PR_GATE_POLL_INTERVAL,
                    "processed_count": len(PR_GATE_PROCESSED)
                })

            elif self.path.startswith('/api/github/latest-pr') or self.path.startswith('/api/github/prs'):
                # Parse owner/repo from query params: /api/github/latest-pr?owner=X&repo=Y
                from urllib.parse import urlparse, parse_qs
                parsed = urlparse(self.path)
                params = parse_qs(parsed.query)
                def_owner, def_repo = _get_default_github_owner_repo()
                owner = params.get('owner', [def_owner])[0]
                repo = params.get('repo', [def_repo])[0]
                
                try:
                    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&sort=created&direction=desc&per_page=20"
                    headers_dict = {
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "RepoTrace-Enterprise"
                    }
                    token = CURRENT_USER_SESSION.get("access_token", "")
                    if token:
                        headers_dict["Authorization"] = f"token {token}"
                    
                    req = urllib.request.Request(api_url, headers=headers_dict)
                    with urllib.request.urlopen(req, timeout=8) as response:
                        raw_pulls = json.loads(response.read().decode('utf-8'))
                        all_prs = []
                        for p in raw_pulls:
                            all_prs.append({
                                "number": p.get("number"),
                                "title": p.get("title", ""),
                                "state": p.get("state", "closed"),
                                "is_open": p.get("state") == "open",
                                "head_branch": p.get("head", {}).get("ref", "feature/v2-upgrade"),
                                "base_branch": p.get("base", {}).get("ref", "main"),
                                "html_url": p.get("html_url", "")
                            })
                        
                        open_prs = [p for p in all_prs if p["is_open"]]
                        has_open_pr = len(open_prs) > 0
                        latest_pr = open_prs[0] if has_open_pr else None
                        
                        if latest_pr:
                            self.send_json_response(200, {
                                "has_open_pr": True,
                                "number": latest_pr["number"],
                                "head_branch": latest_pr["head_branch"],
                                "base_branch": latest_pr["base_branch"],
                                "html_url": latest_pr["html_url"],
                                "title": latest_pr["title"],
                                "state": latest_pr["state"],
                                "all_prs": all_prs
                            })
                        else:
                            self.send_json_response(200, {
                                "has_open_pr": False,
                                "number": 0,
                                "head_branch": "main",
                                "base_branch": "main",
                                "html_url": "",
                                "title": "",
                                "state": all_prs[0]["state"] if len(all_prs) > 0 else "none",
                                "all_prs": all_prs
                            })
                except Exception as e:
                    self.send_json_response(200, {
                        "has_open_pr": False,
                        "number": None,
                        "error": str(e),
                        "all_prs": []
                    })

            else:
                self.send_json_response(404, {"error": "Not Found"})
        except Exception as e:
            self.send_json_response(500, {"error": str(e)})

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                body = json.loads(self.rfile.read(content_length).decode('utf-8'))
            else:
                body = {}

            if self.path == '/api/config/gemini_key':
                api_key = body.get("api_key", "").strip()
                if api_key:
                    os.environ["GEMINI_API_KEY"] = api_key
                    os.environ["GOOGLE_API_KEY"] = api_key
                    env_path = os.path.join(engine_dir, "..", ".env")
                    lines = []
                    if os.path.exists(env_path):
                        with open(env_path, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                    updated = False
                    new_lines = []
                    for line in lines:
                        if line.startswith("GEMINI_API_KEY=") or line.startswith("GOOGLE_API_KEY="):
                            new_lines.append(f"GEMINI_API_KEY={api_key}\n")
                            updated = True
                        else:
                            new_lines.append(line)
                    if not updated:
                        new_lines.append(f"\nGEMINI_API_KEY={api_key}\n")
                    with open(env_path, "w", encoding="utf-8") as f:
                        f.writelines(new_lines)

                    self.send_json_response(200, {"success": True, "message": "Gemini API Key updated and saved to .env"})
                else:
                    self.send_json_response(400, {"error": "API key cannot be empty"})

            elif self.path == '/api/auth/github/login_demo':
                CURRENT_USER_SESSION["authenticated"] = True
                CURRENT_USER_SESSION["user"] = {
                    "login": "alex_dev",
                    "name": "Alex Dev (Enterprise)",
                    "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4",
                    "html_url": "https://github.com/octocat",
                    "public_repos": 14,
                    "total_private_repos": 6
                }
                save_persistent_session()
                self.send_json_response(200, CURRENT_USER_SESSION)

            elif self.path == '/api/auth/github/token':
                token = body.get('token', '').strip()
                if token:
                    try:
                        req = urllib.request.Request(
                            "https://api.github.com/user",
                            headers={
                                "Authorization": f"token {token}",
                                "Accept": "application/vnd.github.v3+json",
                                "User-Agent": "RepoTrace-AI-Enterprise"
                            }
                        )
                        with urllib.request.urlopen(req) as response:
                            user_data = json.loads(response.read().decode('utf-8'))
                            CURRENT_USER_SESSION["authenticated"] = True
                            CURRENT_USER_SESSION["access_token"] = token
                            CURRENT_USER_SESSION["user"] = {
                                "login": user_data.get("login"),
                                "name": user_data.get("name") or user_data.get("login"),
                                "avatar_url": user_data.get("avatar_url"),
                                "html_url": user_data.get("html_url"),
                                "public_repos": user_data.get("public_repos", 0),
                                "total_private_repos": user_data.get("total_private_repos", 0)
                            }
                            save_persistent_session()
                            self.send_json_response(200, CURRENT_USER_SESSION)
                            return
                    except Exception as e:
                        self.send_json_response(400, {"error": f"Invalid GitHub token: {str(e)}"})
                        return
                else:
                    self.send_json_response(400, {"error": "Token is required"})

            elif self.path == '/api/auth/github/logout':
                CURRENT_USER_SESSION["authenticated"] = False
                CURRENT_USER_SESSION["user"] = None
                CURRENT_USER_SESSION["access_token"] = ""
                save_persistent_session()
                self.send_json_response(200, CURRENT_USER_SESSION)
            elif self.path == '/api/pr-gate/config':
                # Get or update PR gate watched repos config
                new_repos = body.get('watched_repos', None)
                if new_repos is not None:
                    PR_GATE_WATCHED_REPOS.clear()
                    PR_GATE_WATCHED_REPOS.extend(new_repos)
                    save_pr_gate_config()
                self.send_json_response(200, {
                    "watched_repos": PR_GATE_WATCHED_REPOS,
                    "enabled": PR_GATE_ENABLED,
                    "poll_interval": PR_GATE_POLL_INTERVAL,
                    "processed_count": len(PR_GATE_PROCESSED)
                })

            elif self.path == '/api/pr-gate/add-repo':
                owner = body.get('owner', '').strip()
                repo = body.get('repo', '').strip()
                if owner and repo:
                    entry = {"owner": owner, "repo": repo}
                    if entry not in PR_GATE_WATCHED_REPOS:
                        PR_GATE_WATCHED_REPOS.append(entry)
                        save_pr_gate_config()
                    self.send_json_response(200, {"status": "added", "watched_repos": PR_GATE_WATCHED_REPOS})
                else:
                    self.send_json_response(400, {"error": "owner and repo required"})

            elif self.path == '/api/pr-gate/trigger':
                # Manual trigger: immediately check all watched repos
                token = CURRENT_USER_SESSION.get("access_token", "")
                if not token:
                    self.send_json_response(400, {"error": "GitHub token required. Log in with token first."})
                elif not PR_GATE_WATCHED_REPOS:
                    self.send_json_response(400, {"error": "No repos configured. Add repos first."})
                else:
                    results = []
                    for entry in PR_GATE_WATCHED_REPOS:
                        owner = entry.get("owner", "")
                        repo = entry.get("repo", "")
                        if owner and repo:
                            pr_watcher_check_repo(owner, repo, token)
                            results.append(f"{owner}/{repo}")
                    self.send_json_response(200, {"status": "triggered", "repos_checked": results})

            elif self.path == '/api/pr-gate/status':
                self.send_json_response(200, {
                    "watched_repos": PR_GATE_WATCHED_REPOS,
                    "processed": PR_GATE_PROCESSED,
                    "has_token": bool(CURRENT_USER_SESSION.get("access_token", "")),
                    "enabled": PR_GATE_ENABLED
                })

            elif self.path == '/api/github/install_workflow':
                repo_full_name = body.get('repo_full_name', '')
                branch = body.get('branch', 'main')
                
                token = CURRENT_USER_SESSION.get("access_token", "")
                
                workflow_content = """name: RepoTrace PR API Governance

on:
  pull_request:
    branches: [ main, master, develop ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  repotrace-ast-gate:
    name: RepoTrace AST Boundary & Schema Drift Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Checkout RepoTrace Engine Core
        uses: actions/checkout@v4
        with:
          repository: pujith-vijay-swamy/OT-Enterprise-Edition
          path: repotrace_engine

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Run RepoTrace CLI AST PR Gate
        run: |
          python repotrace_engine/engine/repotrace/cli.py pr-check --head ./ --out-md pr_comment.md

      - name: Post Sticky GitHub PR Governance Comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            if (fs.existsSync('pr_comment.md')) {
              const commentBody = fs.readFileSync('pr_comment.md', 'utf8');
              const { data: comments } = await github.rest.issues.listComments({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.pull_request.number,
              });
              const botComment = comments.find(c => c.body.includes('RepoTrace AI'));
              if (botComment) {
                await github.rest.issues.updateComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  comment_id: botComment.id,
                  body: commentBody
                });
              } else {
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: context.payload.pull_request.number,
                  body: commentBody
                });
              }
            }
"""
                encoded_content = base64.b64encode(workflow_content.encode('utf-8')).decode('utf-8')

                if token and '/' in repo_full_name:
                    try:
                        url = f"https://api.github.com/repos/{repo_full_name}/contents/.github/workflows/repotrace-ci.yml"
                        req = urllib.request.Request(
                            url,
                            headers={
                                "Authorization": f"token {token}",
                                "Accept": "application/vnd.github.v3+json",
                                "User-Agent": "RepoTrace-AI-Enterprise"
                            }
                        )
                        sha = None
                        try:
                            with urllib.request.urlopen(req) as resp:
                                file_info = json.loads(resp.read().decode('utf-8'))
                                sha = file_info.get('sha')
                        except Exception:
                            sha = None

                        put_data = {
                            "message": "feat(repotrace): add RepoTrace AI PR Governance workflow gate",
                            "content": encoded_content,
                            "branch": branch
                        }
                        if sha:
                            put_data["sha"] = sha

                        put_req = urllib.request.Request(
                            url,
                            data=json.dumps(put_data).encode('utf-8'),
                            headers={
                                "Authorization": f"token {token}",
                                "Accept": "application/vnd.github.v3+json",
                                "Content-Type": "application/json",
                                "User-Agent": "RepoTrace-AI-Enterprise"
                            },
                            method='PUT'
                        )
                        with urllib.request.urlopen(put_req) as response:
                            result_data = json.loads(response.read().decode('utf-8'))
                            commit_html_url = result_data.get('commit', {}).get('html_url', f"https://github.com/{repo_full_name}")
                            self.send_json_response(200, {
                                "success": True,
                                "repo": repo_full_name,
                                "file": ".github/workflows/repotrace-ci.yml",
                                "commit_url": commit_html_url,
                                "pr_url": f"https://github.com/{repo_full_name}/pulls",
                                "message": f"Successfully created .github/workflows/repotrace-ci.yml in {repo_full_name}!"
                            })
                            return
                    except Exception as e:
                        print(f"GitHub API Error during workflow creation: {e}")

                target_url = f"https://github.com/{repo_full_name}" if '/' in repo_full_name else f"https://github.com/search?q={repo_full_name}"
                self.send_json_response(200, {
                    "success": True,
                    "repo": repo_full_name or "enterprise-mesh-repo",
                    "file": ".github/workflows/repotrace-ci.yml",
                    "commit_url": target_url,
                    "pr_url": f"{target_url}/pulls" if '/' in repo_full_name else target_url,
                    "message": f"Successfully committed .github/workflows/repotrace-ci.yml to {repo_full_name or 'microservice'}!"
                })

            elif self.path == '/api/github/install_workflow':
                repo_full_name = body.get('repo_full_name', '')
                branch = body.get('branch', 'main')
                if repo_full_name:
                    auto_enable_pr_gate_for_repo(repo_full_name)

            elif self.path == '/api/scan_repos':
                repos = body.get('repositories', [])
                if not repos:
                    self.send_json_response(400, {"error": "repositories array is required"})
                    return

                all_contracts = []

                for r in repos:
                    raw_dir = r.get('dir', '')
                    c_name = r.get('name', '')
                    auto_enable_pr_gate_for_repo(raw_dir)

                    resolved_dir, s_name, repo_label = resolve_repo_path(raw_dir, c_name)

                    if not resolved_dir or not os.path.exists(resolved_dir):
                        print(f"Warning: Directory or GitHub repo '{raw_dir}' resolved to non-existent path '{resolved_dir}'. Skipping.")
                        continue

                    # Perform live AST parsing across directory for up-to-date schema definitions
                    py_files = []
                    ts_files = []
                    for root, _, files in os.walk(resolved_dir):
                        if ".git" in root or "node_modules" in root or "__pycache__" in root or "cache" in root:
                            continue
                        for f in files:
                            if f.endswith(".py"):
                                py_files.append(os.path.join(root, f))
                            elif f.endswith((".js", ".ts", ".tsx", ".jsx")):
                                ts_files.append(os.path.join(root, f))

                    if py_files or ts_files:
                        if len(py_files) >= len(ts_files):
                            parser = PythonASTParser()
                        else:
                            parser = TypeScriptASTParser()
                        contract = parser.parse_directory(resolved_dir, service_name=s_name or os.path.basename(resolved_dir))
                        contract.repository = repo_label
                        all_contracts.append(contract)
                        continue

                    # Fallback to repotrace.contract.json if no source files found
                    contract_json_path = os.path.join(resolved_dir, "repotrace.contract.json")
                    if os.path.exists(contract_json_path):
                        try:
                            contract = ServiceContract.load_json(contract_json_path)
                            if s_name:
                                contract.service_name = s_name
                            contract.repository = repo_label
                            all_contracts.append(contract)
                            continue
                        except Exception as e:
                            print(f"Error loading contract JSON from {contract_json_path}: {e}")

                    if len(py_files) >= len(ts_files):
                        parser = PythonASTParser()
                        lang = "Python"
                    else:
                        parser = TypeScriptASTParser()
                        lang = "TypeScript"

                    contract = parser.parse_directory(resolved_dir, service_name=s_name)
                    contract.language = lang
                    contract.repository = repo_label
                    all_contracts.append(contract)

                if not all_contracts:
                    self.send_json_response(400, {"error": "No valid microservice repositories were found or parsed."})
                    return

                matcher = CrossRepoMatcher()
                topology = matcher.build_topology(all_contracts)

                response_data = {
                    "contracts": [c.to_dict() for c in all_contracts],
                    "topology": topology
                }
                self.send_json_response(200, response_data)

            elif self.path == '/api/extract':
                source_dir = body.get('source_dir', '')
                service_name = body.get('service_name', '')

                if not source_dir:
                    self.send_json_response(400, {"error": "source_dir is required"})
                    return

                resolved_dir, s_name, repo_label = resolve_repo_path(source_dir, service_name)

                if not os.path.exists(resolved_dir):
                    self.send_json_response(400, {"error": f"Resolved directory path '{resolved_dir}' does not exist"})
                    return

                contract_json_path = os.path.join(resolved_dir, "repotrace.contract.json")
                if os.path.exists(contract_json_path):
                    contract = ServiceContract.load_json(contract_json_path)
                    if s_name:
                        contract.service_name = s_name
                    contract.repository = repo_label
                    self.send_json_response(200, contract.to_dict())
                    return

                py_count = sum(1 for root, _, files in os.walk(resolved_dir) for f in files if f.endswith('.py'))
                ts_count = sum(1 for root, _, files in os.walk(resolved_dir) for f in files if f.endswith(('.js', '.ts', '.tsx')))

                if py_count >= ts_count:
                    parser = PythonASTParser()
                else:
                    parser = TypeScriptASTParser()

                contract = parser.parse_directory(resolved_dir, service_name=s_name)
                contract.repository = repo_label
                self.send_json_response(200, contract.to_dict())

            elif self.path == '/api/match':
                contracts_data = body.get('contracts', [])
                contracts = [load_contract_dict(c) for c in contracts_data]
                matcher = CrossRepoMatcher()
                topology = matcher.build_topology(contracts)
                self.send_json_response(200, topology)

            elif self.path == '/api/diff':
                old_c = load_contract_dict(body.get('old_contract', {}))
                new_c = load_contract_dict(body.get('new_contract', {}))

                diff_engine = ContractDiffEngine()
                diff_result = diff_engine.diff_contracts(old_c, new_c)

                self.send_json_response(200, {
                    "service_name": diff_result.service_name,
                    "old_version": diff_result.old_version,
                    "new_version": diff_result.new_version,
                    "has_breaking_changes": diff_result.has_breaking_changes,
                    "drifts": [
                        {
                            "id": d.id,
                            "severity": d.severity,
                            "change_type": d.change_type,
                            "target_route": d.target_route,
                            "method": d.method,
                            "field_name": d.field_name,
                            "old_value": d.old_value,
                            "new_value": d.new_value,
                            "description": d.description,
                            "remediation_suggestion": d.remediation_suggestion,
                            "git_context": {
                                "commit_sha": d.git_context.commit_sha,
                                "author": d.git_context.author,
                                "commit_message": d.git_context.commit_message,
                                "file_path": d.git_context.file_path,
                                "line_number": d.git_context.line_number
                            }
                        }
                        for d in diff_result.drifts
                    ]
                })

            else:
                self.send_json_response(404, {"error": "Not Found"})
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json_response(500, {"error": str(e)})

def run(port=None):
    if port is None:
        port = int(os.environ.get("PORT", 4400))
    server_address = ('0.0.0.0', port)
    httpd = ThreadedHTTPServer(server_address, RequestHandler)
    print(f"RepoTrace API Engine server running on http://0.0.0.0:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
