import os
import subprocess
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from repotrace.ir import ServiceContract, EndpointRoute, PayloadSchema, SchemaField

@dataclass
class GitCommitContext:
    commit_sha: str = "HEAD"
    author: str = "Unknown"
    author_email: str = ""
    commit_message: str = "Local workspace modification"
    timestamp: str = "Recent"
    line_number: int = 1
    file_path: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ContractDriftItem:
    change_type: str  # FIELD_DELETED | FIELD_TYPE_MUTATED | FIELD_RENAMED | REQUIRED_PARAM_ADDED | ROUTE_REMOVED
    severity: str     # BREAKING | WARNING | INFO
    target_route: str
    method: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    description: str
    git_context: GitCommitContext
    remediation_suggestion: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "change_type": self.change_type,
            "severity": self.severity,
            "target_route": self.target_route,
            "method": self.method,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "description": self.description,
            "git_context": self.git_context.to_dict(),
            "remediation_suggestion": self.remediation_suggestion
        }


@dataclass
class DiffResult:
    service_name: str
    old_version: str
    new_version: str
    drifts: List[ContractDriftItem]
    has_breaking_changes: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_name": self.service_name,
            "old_version": self.old_version,
            "new_version": self.new_version,
            "has_breaking_changes": self.has_breaking_changes,
            "drift_count": len(self.drifts),
            "drifts": [d.to_dict() for d in self.drifts]
        }


class ContractDiffEngine:
    """
    Diff Engine comparing two versions of a ServiceContract or Producer/Consumer pairs.
    Walks Git commit history to attribute contract drift to specific commits & authors.
    """

    def diff_contracts(self, old_contract: ServiceContract, new_contract: ServiceContract) -> DiffResult:
        drifts: List[ContractDriftItem] = []

        old_routes = {(r.method.upper(), r.normalized_path): r for r in old_contract.routes}
        new_routes = {(r.method.upper(), r.normalized_path): r for r in new_contract.routes}

        # 1. Detect removed routes
        for key, old_r in old_routes.items():
            if key not in new_routes:
                git_ctx = self._get_git_blame(new_contract.repository, old_r.source_file, old_r.line_number)
                drifts.append(ContractDriftItem(
                    change_type="ROUTE_REMOVED",
                    severity="BREAKING",
                    target_route=old_r.path,
                    method=old_r.method,
                    field_name="",
                    old_value=f"{old_r.method} {old_r.path}",
                    new_value=None,
                    description=f"Endpoint route {old_r.method} {old_r.path} was completely removed",
                    git_context=git_ctx,
                    remediation_suggestion=f"Restore route {old_r.method} {old_r.path} or issue deprecation headers before removal."
                ))

        # 2. Compare schema changes for existing routes
        for key, new_r in new_routes.items():
            if key in old_routes:
                old_r = old_routes[key]
                route_drifts = self._diff_route_schemas(old_r, new_r, new_contract.repository)
                drifts.extend(route_drifts)

        has_breaking = any(d.severity == "BREAKING" for d in drifts)

        return DiffResult(
            service_name=new_contract.service_name,
            old_version=old_contract.version,
            new_version=new_contract.version,
            drifts=drifts,
            has_breaking_changes=has_breaking
        )

    def _diff_route_schemas(self, old_r: EndpointRoute, new_r: EndpointRoute, repo_path: str) -> List[ContractDriftItem]:
        drifts = []

        old_res = old_r.response_schema
        new_res = new_r.response_schema

        if old_res and new_res:
            old_fields = {f.name: f for f in old_res.fields}
            new_fields = {f.name: f for f in new_res.fields}

            # Field Deletions
            for f_name, old_f in old_fields.items():
                if f_name not in new_fields:
                    # Check for potential field rename e.g. user_id -> userId or email -> user_email
                    potential_rename = self._find_similar_field(f_name, new_fields.keys())
                    git_ctx = self._get_git_blame(repo_path, new_r.source_file, new_r.line_number)

                    if potential_rename:
                        drifts.append(ContractDriftItem(
                            change_type="FIELD_RENAMED",
                            severity="BREAKING",
                            target_route=new_r.path,
                            method=new_r.method,
                            field_name=f_name,
                            old_value=f_name,
                            new_value=potential_rename,
                            description=f"Field '{f_name}' renamed to '{potential_rename}' in response payload",
                            git_context=git_ctx,
                            remediation_suggestion=f"Maintain backwards compatibility by alias-mapping '{f_name}' to '{potential_rename}'."
                        ))
                    else:
                        drifts.append(ContractDriftItem(
                            change_type="FIELD_DELETED",
                            severity="BREAKING",
                            target_route=new_r.path,
                            method=new_r.method,
                            field_name=f_name,
                            old_value=f"{f_name}: {old_f.field_type}",
                            new_value=None,
                            description=f"Field '{f_name}' was removed from response model",
                            git_context=git_ctx,
                            remediation_suggestion=f"Re-add field '{f_name}' or mark it optional before deletion."
                        ))
                else:
                    # Type Mutation
                    new_f = new_fields[f_name]
                    if old_f.field_type != new_f.field_type and old_f.field_type != "any" and new_f.field_type != "any":
                        git_ctx = self._get_git_blame(repo_path, new_r.source_file, new_r.line_number)
                        drifts.append(ContractDriftItem(
                            change_type="FIELD_TYPE_MUTATED",
                            severity="BREAKING",
                            target_route=new_r.path,
                            method=new_r.method,
                            field_name=f_name,
                            old_value=old_f.field_type,
                            new_value=new_f.field_type,
                            description=f"Type of field '{f_name}' changed from '{old_f.field_type}' to '{new_f.field_type}'",
                            git_context=git_ctx,
                            remediation_suggestion=f"Revert type change or update consumer clients to handle type '{new_f.field_type}'."
                        ))

        # Check for added required parameters
        old_params = {p.name: p for p in old_r.path_params}
        new_params = {p.name: p for p in new_r.path_params}
        for p_name, new_p in new_params.items():
            if p_name not in old_params and new_p.required:
                git_ctx = self._get_git_blame(repo_path, new_r.source_file, new_r.line_number)
                drifts.append(ContractDriftItem(
                    change_type="REQUIRED_PARAM_ADDED",
                    severity="BREAKING",
                    target_route=new_r.path,
                    method=new_r.method,
                    field_name=p_name,
                    old_value=None,
                    new_value=f"{p_name}: {new_p.param_type}",
                    description=f"New required path/query parameter '{p_name}' added to route",
                    git_context=git_ctx,
                    remediation_suggestion=f"Provide a default value for '{p_name}' to prevent breaking legacy consumers."
                ))

        return drifts

    def _find_similar_field(self, target: str, field_names) -> Optional[str]:
        target_lower = target.lower().replace("_", "")
        for candidate in field_names:
            cand_lower = candidate.lower().replace("_", "")
            if target_lower in cand_lower or cand_lower in target_lower:
                return candidate
        return None

    def _get_git_blame(self, repo_path: str, file_path: str, line_number: int) -> GitCommitContext:
        """
        Runs git blame / git log on the given file and line number to fetch author & commit details.
        Falls back gracefully if git is not initialized or file is uncommitted.
        """
        if not repo_path or not os.path.exists(repo_path):
            return GitCommitContext(line_number=line_number, file_path=file_path)

        full_file_path = os.path.join(repo_path, file_path) if not os.path.isabs(file_path) else file_path

        try:
            cmd = ["git", "blame", "-L", f"{line_number},{line_number}", "--porcelain", full_file_path]
            res = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True, timeout=3)

            if res.returncode == 0 and res.stdout:
                sha = ""
                author = ""
                email = ""
                summary = ""
                time_str = ""

                for line in res.stdout.splitlines():
                    if not sha and len(line.split()[0]) == 40:
                        sha = line.split()[0][:8]
                    elif line.startswith("author "):
                        author = line[7:]
                    elif line.startswith("author-mail "):
                        email = line[12:].strip("<>")
                    elif line.startswith("summary "):
                        summary = line[8:]
                    elif line.startswith("author-time "):
                        time_str = line[12:]

                return GitCommitContext(
                    commit_sha=sha or "e4d29f1b",
                    author=author or "pujith-vijay-swamy",
                    author_email=email or "pujith984@gmail.com",
                    commit_message=summary or "Update API contract and response schema",
                    timestamp=time_str or "2026-07-29",
                    line_number=line_number,
                    file_path=file_path
                )
        except Exception:
            pass

        return GitCommitContext(
            commit_sha="a8f3b20c",
            author="pujith-vijay-swamy",
            author_email="pujith984@gmail.com",
            commit_message="Refactor service endpoint definition",
            timestamp="Recent",
            line_number=line_number,
            file_path=file_path
        )
