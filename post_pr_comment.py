"""
RepoTrace AI — Local PR Comment Poster
Posts the pr_comment.md directly to a GitHub Pull Request via API.
Bypasses GitHub Actions runner queue completely.

Usage:
  python post_pr_comment.py --repo pujith-vijay-swamy/UserService --pr 5 --token YOUR_GITHUB_TOKEN
"""
import os
import sys
import json
import argparse
import urllib.request
import urllib.error

def post_pr_comment(repo: str, pr_number: int, token: str, comment_file: str = "pr_comment.md"):
    """Post comment to GitHub PR and set commit status to failure."""
    
    if not os.path.exists(comment_file):
        print(f"[ERROR] Comment file '{comment_file}' not found. Run pr-check first.")
        sys.exit(1)
    
    with open(comment_file, "r", encoding="utf-8") as f:
        comment_body = f.read()
    
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RepoTrace-AI-Enterprise",
        "Content-Type": "application/json"
    }
    
    # 1. Check for existing RepoTrace comment (sticky update)
    print(f"[INFO] Fetching existing comments on {repo}#PR{pr_number}...")
    list_url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments?per_page=100"
    req = urllib.request.Request(list_url, headers=headers)
    
    existing_comment_id = None
    try:
        with urllib.request.urlopen(req) as resp:
            comments = json.loads(resp.read().decode("utf-8"))
            for c in comments:
                if "RepoTrace AI" in c.get("body", ""):
                    existing_comment_id = c["id"]
                    break
    except Exception as e:
        print(f"[WARN] Could not fetch comments: {e}")
    
    # 2. Create or update the sticky PR comment
    if existing_comment_id:
        print(f"[INFO] Updating existing RepoTrace comment (ID: {existing_comment_id})...")
        update_url = f"https://api.github.com/repos/{repo}/issues/comments/{existing_comment_id}"
        payload = json.dumps({"body": comment_body}).encode("utf-8")
        req = urllib.request.Request(update_url, data=payload, headers=headers, method="PATCH")
    else:
        print(f"[INFO] Creating new RepoTrace PR comment on {repo}#PR{pr_number}...")
        create_url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
        payload = json.dumps({"body": comment_body}).encode("utf-8")
        req = urllib.request.Request(create_url, data=payload, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            print(f"[SUCCESS] PR Comment posted: {result.get('html_url')}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[ERROR] Failed to post comment: {e.code} - {err_body}")
        sys.exit(1)
    
    # 3. Set commit status to "failure" on the PR head SHA
    print(f"[INFO] Fetching PR head commit SHA...")
    pr_url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    req = urllib.request.Request(pr_url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as resp:
            pr_data = json.loads(resp.read().decode("utf-8"))
            head_sha = pr_data["head"]["sha"]
            print(f"[INFO] Head SHA: {head_sha}")
    except Exception as e:
        print(f"[WARN] Could not fetch PR data: {e}")
        return
    
    # 4. Post commit status = failure
    status_url = f"https://api.github.com/repos/{repo}/statuses/{head_sha}"
    status_payload = json.dumps({
        "state": "failure",
        "target_url": f"https://github.com/{repo}/pull/{pr_number}",
        "description": "BLOCKED: Cross-Repository Contract Drift Detected",
        "context": "RepoTrace AI / PR Governance Gate"
    }).encode("utf-8")
    req = urllib.request.Request(status_url, data=status_payload, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"[SUCCESS] Commit status set to FAILURE on {head_sha[:8]}")
            print(f"[RESULT] PR #{pr_number} is now marked as BLOCKED with RepoTrace governance check! 🛑")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[WARN] Could not set commit status: {e.code} - {err_body}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RepoTrace AI — Post PR Comment & Block Status via GitHub API")
    parser.add_argument("--repo", required=True, help="GitHub repo (owner/repo)")
    parser.add_argument("--pr", required=True, type=int, help="PR number")
    parser.add_argument("--token", required=True, help="GitHub Personal Access Token")
    parser.add_argument("--comment-file", default="pr_comment.md", help="Path to PR comment markdown file")
    args = parser.parse_args()
    
    post_pr_comment(args.repo, args.pr, args.token, args.comment_file)
