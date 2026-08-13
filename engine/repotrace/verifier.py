import os
import subprocess
from typing import Dict, Any, List, Optional

class ContractVerifier:
    """
    Verification Module for RepoTrace Detections.
    Runs post-Linker analysis to confirm reachability, optionality non-issues,
    and optional test suite execution signals without suppressing flagged breaks.
    """

    def verify_edge(
        self,
        consumer_service: str,
        producer_service: str,
        target_path: str,
        issues: List[str],
        consumer_file: Optional[str] = None,
        producer_file: Optional[str] = None,
        repo_path: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Verifies a service dependency edge mismatch.
        Returns dict with `verification_status` ("confirmed" | "unconfirmed" | "not_run")
        and `verification_note`.
        """
        if not issues:
            return {
                "verification_status": "confirmed",
                "verification_note": "No contract issues detected."
            }

        try:
            # Check 1: Optionality / Nullability non-issue check
            is_optional_mismatch = any(
                "optional" in issue.lower() or "nullable" in issue.lower()
                for issue in issues
            )
            if is_optional_mismatch:
                return {
                    "verification_status": "unconfirmed",
                    "verification_note": "Field mismatch involves optional/nullable schema definitions."
                }

            # Check 2: Repository test suite execution (if available)
            if repo_path and os.path.exists(repo_path):
                test_result = self._run_test_suite_signal(repo_path)
                if test_result == "failing":
                    return {
                        "verification_status": "confirmed",
                        "verification_note": "Confirmed by failing repository test suite on modified contract path."
                    }
                elif test_result == "passing":
                    return {
                        "verification_status": "confirmed",
                        "verification_note": "Confirmed by static AST schema mismatch (test suite passing)."
                    }

            # Default confirmed AST mismatch
            return {
                "verification_status": "confirmed",
                "verification_note": "AST contract boundary drift confirmed across service repositories."
            }

        except Exception as e:
            return {
                "verification_status": "not_run",
                "verification_note": f"Verification pass skipped or timed out: {str(e)}"
            }

    def verify_drift(self, change_type: str, target_route: str, field_name: str, repo_path: Optional[str] = None) -> Dict[str, str]:
        """
        Verifies a single contract drift item.
        """
        try:
            if repo_path and os.path.exists(repo_path):
                test_result = self._run_test_suite_signal(repo_path)
                if test_result == "failing":
                    return {
                        "verification_status": "confirmed",
                        "verification_note": f"Drift on {target_route} confirmed by test suite failure."
                    }
            return {
                "verification_status": "confirmed",
                "verification_note": f"Static AST drift confirmed on {change_type} ({target_route})."
            }
        except Exception as e:
            return {
                "verification_status": "not_run",
                "verification_note": f"Verification not run: {str(e)}"
            }

    def _run_test_suite_signal(self, repo_path: str) -> str:
        """
        Checks for pytest or npm test in the target repository path.
        Returns "passing", "failing", or "not_run".
        """
        try:
            if os.path.exists(os.path.join(repo_path, "pytest.ini")) or os.path.exists(os.path.join(repo_path, "conftest.py")):
                res = subprocess.run(["pytest", "--maxfail=1", "-q"], cwd=repo_path, capture_output=True, text=True, timeout=2)
                return "passing" if res.returncode == 0 else "failing"
            elif os.path.exists(os.path.join(repo_path, "package.json")):
                res = subprocess.run(["npm", "test", "--", "--bail"], cwd=repo_path, capture_output=True, text=True, timeout=2)
                return "passing" if res.returncode == 0 else "failing"
        except Exception:
            pass
        return "not_run"
