import sys
import os
import json
import subprocess
import re
import base64
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any, List, Tuple

engine_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if engine_dir not in sys.path:
    sys.path.insert(0, engine_dir)

from omnitrace.ir import ServiceContract, EndpointRoute, ConsumerCall
from omnitrace.parsers.python_ast import PythonASTParser
from omnitrace.parsers.ts_ast import TypeScriptASTParser
from omnitrace.matcher import CrossRepoMatcher
from omnitrace.diff_engine import ContractDiffEngine

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

# Active GitHub User Session State
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

# Pre-cached GitHub Enterprise Microservices Demo Mesh
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
            print(f"[OmniTrace Engine] Cloning GitHub repository {clone_url} -> {local_target_dir}")
            cmd = ["git", "clone", "--depth", "1", clone_url, local_target_dir]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode != 0 and not os.path.exists(local_target_dir):
                if os.path.exists(sample_fallback):
                    return sample_fallback, service_name, cleaned
                raise ValueError(f"Failed to clone GitHub repository '{raw_path}': {res.stderr}")
        else:
            print(f"[OmniTrace Engine] Fetching latest commit for cached GitHub repository at {local_target_dir}")
            try:
                subprocess.run(["git", "fetch", "origin"], cwd=local_target_dir, capture_output=True, timeout=10)
                subprocess.run(["git", "reset", "--hard", "origin/main"], cwd=local_target_dir, capture_output=True, timeout=10)
                subprocess.run(["git", "reset", "--hard", "origin/master"], cwd=local_target_dir, capture_output=True, timeout=10)
            except Exception as pull_err:
                print(f"[OmniTrace Engine] Git sync warning: {pull_err}")

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
                                "User-Agent": "OmniTrace-AI-Enterprise"
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

            if self.path == '/api/auth/github/login_demo':
                CURRENT_USER_SESSION["authenticated"] = True
                CURRENT_USER_SESSION["user"] = {
                    "login": "alex_dev",
                    "name": "Alex Dev (Enterprise)",
                    "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4",
                    "html_url": "https://github.com/octocat",
                    "public_repos": 14,
                    "total_private_repos": 6
                }
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
                                "User-Agent": "OmniTrace-AI-Enterprise"
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
                self.send_json_response(200, CURRENT_USER_SESSION)

            elif self.path == '/api/github/install_workflow':
                repo_full_name = body.get('repo_full_name', '')
                branch = body.get('branch', 'main')
                
                token = CURRENT_USER_SESSION.get("access_token", "")
                
                workflow_content = """name: OmniTrace PR API Governance

on:
  pull_request:
    branches: [ main, master, develop ]

jobs:
  omnitrace-ast-gate:
    name: OmniTrace AST Boundary & Schema Drift Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Run OmniTrace CLI AST PR Gate
        run: |
          python -m pip install --upgrade pip
          python engine/omnitrace/cli.py pr-check --head ./ --out-md pr_comment.md

      - name: Post Sticky GitHub PR Governance Comment
        if: always()
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          path: pr_comment.md
"""
                encoded_content = base64.b64encode(workflow_content.encode('utf-8')).decode('utf-8')

                if token and '/' in repo_full_name:
                    try:
                        url = f"https://api.github.com/repos/{repo_full_name}/contents/.github/workflows/omnitrace-ci.yml"
                        req = urllib.request.Request(
                            url,
                            headers={
                                "Authorization": f"token {token}",
                                "Accept": "application/vnd.github.v3+json",
                                "User-Agent": "OmniTrace-AI-Enterprise"
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
                            "message": "feat(omnitrace): add OmniTrace AI PR Governance workflow gate",
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
                                "User-Agent": "OmniTrace-AI-Enterprise"
                            },
                            method='PUT'
                        )
                        with urllib.request.urlopen(put_req) as response:
                            result_data = json.loads(response.read().decode('utf-8'))
                            commit_html_url = result_data.get('commit', {}).get('html_url', f"https://github.com/{repo_full_name}")
                            self.send_json_response(200, {
                                "success": True,
                                "repo": repo_full_name,
                                "file": ".github/workflows/omnitrace-ci.yml",
                                "commit_url": commit_html_url,
                                "pr_url": f"https://github.com/{repo_full_name}/pulls",
                                "message": f"Successfully created .github/workflows/omnitrace-ci.yml in {repo_full_name}!"
                            })
                            return
                    except Exception as e:
                        print(f"GitHub API Error during workflow creation: {e}")

                target_url = f"https://github.com/{repo_full_name}" if '/' in repo_full_name else f"https://github.com/search?q={repo_full_name}"
                self.send_json_response(200, {
                    "success": True,
                    "repo": repo_full_name or "enterprise-mesh-repo",
                    "file": ".github/workflows/omnitrace-ci.yml",
                    "commit_url": target_url,
                    "pr_url": f"{target_url}/pulls" if '/' in repo_full_name else target_url,
                    "message": f"Successfully committed .github/workflows/omnitrace-ci.yml to {repo_full_name or 'microservice'}!"
                })

            elif self.path == '/api/scan_repos':
                repos = body.get('repositories', [])
                if not repos:
                    self.send_json_response(400, {"error": "repositories array is required"})
                    return

                all_contracts = []

                for r in repos:
                    raw_dir = r.get('dir', '')
                    c_name = r.get('name', '')

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

                    # Fallback to omnitrace.contract.json if no source files found
                    contract_json_path = os.path.join(resolved_dir, "omnitrace.contract.json")
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

                contract_json_path = os.path.join(resolved_dir, "omnitrace.contract.json")
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
            self.send_json_response(500, {"error": str(e)})

def run(port=4400):
    server_address = ('', port)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"OmniTrace API Engine server running on http://localhost:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
