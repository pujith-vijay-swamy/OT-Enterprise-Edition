import sys
import os

engine_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if engine_dir not in sys.path:
    sys.path.insert(0, engine_dir)

import json
import argparse
from typing import List
from omnitrace.ir import ServiceContract
from omnitrace.parsers.python_ast import PythonASTParser
from omnitrace.parsers.ts_ast import TypeScriptASTParser
from omnitrace.matcher import CrossRepoMatcher
from omnitrace.diff_engine import ContractDiffEngine, DiffResult, ContractDriftItem

def extract_contract(source_dir: str, service_name: str = "", output_file: str = "omnitrace.contract.json") -> ServiceContract:
    source_dir = os.path.abspath(source_dir)
    
    # Determine dominant language
    py_count = 0
    ts_count = 0
    for root, _, files in os.walk(source_dir):
        for f in files:
            if f.endswith(".py"):
                py_count += 1
            elif f.endswith((".js", ".ts", ".tsx", ".jsx")):
                ts_count += 1

    if py_count >= ts_count:
        parser = PythonASTParser()
    else:
        parser = TypeScriptASTParser()

    contract = parser.parse_directory(source_dir, service_name=service_name or os.path.basename(source_dir))
    if output_file:
        contract.save_json(output_file)
    return contract


def generate_pr_comment_markdown(diff_result: DiffResult) -> str:
    status_badge = "CRITICAL: PR BLOCKED -- Breaking Contract Drift Detected" if diff_result.has_breaking_changes else "PASS: Contract Governance Approved"
    
    md = [
        "## OmniTrace AI -- Pull Request API Governance Check",
        "",
        f"**CI Pipeline Gate**: `{status_badge}`",
        f"**Microservice**: `{diff_result.service_name}` | **Version Comparison**: `{diff_result.old_version}` -> `{diff_result.new_version}`",
        f"**Total Schema Drifts Found**: `{len(diff_result.drifts)}`",
        "",
        "---",
        "### Detected Contract Modifications & Origin Attribution",
        "",
        "| Severity | Change Type | Target Endpoint | Affected Field | Author | Source File & Line |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |"
    ]

    for d in diff_result.drifts:
        sev_icon = "BREAKING" if d.severity == "BREAKING" else "WARNING"
        author = f"@{d.git_context.author}"
        loc = f"`{d.git_context.file_path}:L{d.git_context.line_number}`"
        md.append(f"| {sev_icon} | `{d.change_type}` | `{d.method} {d.target_route}` | `{d.field_name}` | {author} | {loc} |")

    md.extend([
        "",
        "### Actionable Remediation Guidance",
        ""
    ])

    for i, d in enumerate(diff_result.drifts, 1):
        md.append(f"**{i}. {d.method} `{d.target_route}` -- {d.description}**")
        md.append(f"- **Action Required**: {d.remediation_suggestion}")
        md.append(f"- **Commit Context**: *\"{d.git_context.commit_message}\"* by {d.git_context.author}")
        md.append("")

    md.extend([
        "---",
        "*Powered by OmniTrace AI Enterprise Contract Engine*"
    ])

    return "\n".join(md)


def main():
    parser = argparse.ArgumentParser(prog="omnitrace", description="OmniTrace AI -- Passive Contract Drift Detection CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Init command: 1-Click local workflow file generator
    init_p = subparsers.add_parser("init", help="Initialize OmniTrace GitHub Actions PR Governance workflow in current repo")
    init_p.add_argument("--dir", default=".", help="Target repository directory (default: current directory)")

    # Extract command
    extract_p = subparsers.add_parser("extract", help="Extract AST API contract into JSON IR")
    extract_p.add_argument("--dir", required=True, help="Root source directory")
    extract_p.add_argument("--out", default="omnitrace.contract.json", help="Output contract JSON file")
    extract_p.add_argument("--name", default="", help="Service name override")

    # Check command
    check_p = subparsers.add_parser("check", help="Check contract drift between two repositories or contract files")
    check_p.add_argument("--repo-a", required=True, help="Path to repo A or omnitrace.contract.json A (Producer / Baseline / Main)")
    check_p.add_argument("--repo-b", required=True, help="Path to repo B or omnitrace.contract.json B (PR Branch / Modified)")
    check_p.add_argument("--fail-on-breaking", action="store_true", default=True, help="Exit with code 1 on breaking drift")

    # PR Check command specifically for Pull Request CI
    pr_p = subparsers.add_parser("pr-check", help="Run AST schema drift check for Pull Request against main branch")
    pr_p.add_argument("--head", required=True, help="PR modified repository directory or contract JSON (New)")
    pr_p.add_argument("--base", default="", help="Base branch baseline repository directory or contract JSON (Main / Baseline)")
    pr_p.add_argument("--name", default="", help="Service name override")
    pr_p.add_argument("--out-md", default="", help="Optional file path to output GitHub PR comment markdown")

    # Diff command
    diff_p = subparsers.add_parser("diff", help="Generate detailed structural diff report")
    diff_p.add_argument("--old", required=True, help="Old contract JSON")
    diff_p.add_argument("--new", required=True, help="New contract JSON")

    # CI Report command
    ci_p = subparsers.add_parser("ci-report", help="Generate GitHub Actions PR Comment markdown")
    ci_p.add_argument("--old", required=True, help="Old contract JSON")
    ci_p.add_argument("--new", required=True, help="New contract JSON")
    ci_p.add_argument("--out-md", default="pr_comment.md", help="Output markdown file for PR comment")

    args = parser.parse_args()

    if args.command == "init":
        target_dir = os.path.abspath(args.dir)
        workflows_dir = os.path.join(target_dir, ".github", "workflows")
        os.makedirs(workflows_dir, exist_ok=True)
        workflow_path = os.path.join(workflows_dir, "omnitrace-ci.yml")

        workflow_yaml = """name: OmniTrace PR API Governance

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
        uses: pyx/sticky-pull-request-comment@v2
        with:
          path: pr_comment.md
"""
        with open(workflow_path, "w", encoding="utf-8") as f:
            f.write(workflow_yaml)

        print("\n" + "=" * 68)
        print("  OMNITRACE AI -- 1-CLICK WORKFLOW INITIALIZATION SUCCESSFUL")
        print("=" * 68)
        print(f"[SUCCESS] Created GitHub Actions Workflow File: {workflow_path}")
        print("[NEXT STEP] Commit and push .github/workflows/omnitrace-ci.yml to activate PR governance.")
        print("=" * 68 + "\n")

    elif args.command == "extract":
        print(f"[INFO] Extracting static AST contract from directory: {args.dir}")
        contract = extract_contract(args.dir, service_name=args.name, output_file=args.out)
        print(f"[SUCCESS] Extracted {len(contract.routes)} routes and {len(contract.consumer_calls)} consumer calls to '{args.out}'.")

    elif args.command == "pr-check":
        head_path = args.head
        base_path = args.base

        # Load or extract head (PR modified code)
        if head_path.endswith(".json") and os.path.exists(head_path):
            c_head = ServiceContract.load_json(head_path)
        else:
            c_head = extract_contract(head_path, service_name=args.name, output_file="")

        # Load or extract base (Baseline / Main branch code)
        if base_path and base_path.endswith(".json") and os.path.exists(base_path):
            c_base = ServiceContract.load_json(base_path)
        elif base_path and os.path.exists(base_path):
            c_base = extract_contract(base_path, service_name=args.name, output_file="")
        else:
            baseline_path = os.path.join(engine_dir, "..", "samples", "user-service-v1")
            if os.path.exists(baseline_path):
                c_base = extract_contract(baseline_path, service_name=args.name or "user-service", output_file="")
            else:
                c_base = c_head

        diff_engine = ContractDiffEngine()
        diff_res = diff_engine.diff_contracts(c_base, c_head)

        print("\n" + "=" * 68)
        print("  OMNITRACE AI -- PULL REQUEST CONTRACT DRIFT & GOVERNANCE REPORT")
        print("=" * 68)
        print(f"Target Branch: main  |  PR Service: {diff_res.service_name}")
        
        if diff_res.has_breaking_changes:
            print("Status: [PR BLOCKED - BREAKING CONTRACT DRIFT DETECTED]")
        else:
            print("Status: [PASS - CONTRACT GOVERNANCE APPROVED]")
        
        print(f"Total Drifts Found: {len(diff_res.drifts)}\n")

        for d in diff_res.drifts:
            prefix = "[BREAKING]" if d.severity == "BREAKING" else "[WARNING]"
            print(f"{prefix} {d.change_type} @ {d.method} {d.target_route}")
            print(f"  Affected Field: {d.field_name or 'N/A'}")
            print(f"  Description:    {d.description}")
            print(f"  File Origin:    {d.git_context.file_path}:L{d.git_context.line_number} (Commit: {d.git_context.commit_sha} by @{d.git_context.author})")
            print(f"  Fix Guidance:   {d.remediation_suggestion}\n")

        if args.out_md:
            md_comment = generate_pr_comment_markdown(diff_res)
            with open(args.out_md, "w", encoding="utf-8") as f:
                f.write(md_comment)
            print(f"[SUCCESS] Wrote PR comment markdown report to '{args.out_md}'")

        print("=" * 68 + "\n")

        if diff_res.has_breaking_changes:
            print("[FAIL] CLI Gate Triggered: Breaking AST contract drift prevents merging PR into main branch.")
            sys.exit(1)
        else:
            print("[SUCCESS] CLI Gate Passed: PR contains zero breaking API drifts.")
            sys.exit(0)

    elif args.command == "check" or args.command == "diff":
        if args.repo_a.endswith(".json") and os.path.exists(args.repo_a):
            c_a = ServiceContract.load_json(args.repo_a)
        else:
            c_a = extract_contract(args.repo_a, output_file="")

        if args.repo_b.endswith(".json") and os.path.exists(args.repo_b):
            c_b = ServiceContract.load_json(args.repo_b)
        else:
            c_b = extract_contract(args.repo_b, output_file="")

        diff_engine = ContractDiffEngine()
        diff_res = diff_engine.diff_contracts(c_a, c_b)

        print("\n" + "=" * 68)
        print(f"  OmniTrace Contract Drift Report: {diff_res.service_name}")
        print("=" * 68)
        print(f"Status: {'[BREAKING DRIFT]' if diff_res.has_breaking_changes else '[HEALTHY]'}")
        print(f"Drifts Found: {len(diff_res.drifts)}\n")

        for d in diff_res.drifts:
            print(f"[{d.severity}] {d.change_type} @ {d.method} {d.target_route}")
            print(f"  Field: {d.field_name} (Old: {d.old_value} -> New: {d.new_value})")
            print(f"  Description: {d.description}")
            print(f"  Origin: SHA {d.git_context.commit_sha} by {d.git_context.author} at {d.git_context.file_path}:{d.git_context.line_number}")
            print(f"  Suggested Action: {d.remediation_suggestion}\n")

        if diff_res.has_breaking_changes and getattr(args, "fail_on_breaking", False):
            sys.exit(1)

    elif args.command == "ci-report":
        c_a = ServiceContract.load_json(args.old) if args.old.endswith(".json") else extract_contract(args.old)
        c_b = ServiceContract.load_json(args.new) if args.new.endswith(".json") else extract_contract(args.new)
        diff_res = ContractDiffEngine().diff_contracts(c_a, c_b)
        md_comment = generate_pr_comment_markdown(diff_res)
        
        with open(args.out_md, "w", encoding="utf-8") as f:
            f.write(md_comment)
        print(f"[SUCCESS] Generated CI Markdown report at '{args.out_md}'")

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
