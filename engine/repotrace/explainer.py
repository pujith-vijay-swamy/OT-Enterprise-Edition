import os
import hashlib
from typing import Dict, Any, Optional

class LLMExplainer:
    """
    LLM 'Explain Why' Layer for RepoTrace Detections.
    Generates plain-English advisory explanations of contract drifts using ONLY
    minimal structured metadata (endpoint, field, change_type, old_value, new_value).
    
    Enterprise Privacy Guarantee: NEVER receives full repository source code.
    Caching: Cached in-memory by unique diff signature MD5 hash.
    """

    def __init__(self, model_name: str = "gemini-3.5-flash-lite"):
        self._cache: Dict[str, str] = {}
        self.model_name = model_name
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    def get_explanation(
        self,
        change_type: str,
        target_route: str,
        field_name: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        confidence_tier: str = "HIGH_CONFIDENCE_BREAK",
        verification_status: str = "confirmed"
    ) -> str:
        """
        Generates 1-3 sentence plain-English developer explanation.
        Uses live Gemini API when GEMINI_API_KEY is present, with instant template fallback.
        """
        diff_sig = f"{target_route}:{field_name}:{change_type}:{old_value}:{new_value}:{confidence_tier}"
        sig_hash = hashlib.md5(diff_sig.encode("utf-8")).hexdigest()

        if sig_hash in self._cache:
            return self._cache[sig_hash]

        explanation = None
        if self.api_key:
            explanation = self._call_live_gemini(
                change_type=change_type,
                target_route=target_route,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                confidence_tier=confidence_tier,
                verification_status=verification_status
            )

        if not explanation:
            explanation = self._generate_advisory_explanation(
                change_type=change_type,
                target_route=target_route,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                confidence_tier=confidence_tier,
                verification_status=verification_status
            )

        self._cache[sig_hash] = explanation
        return explanation

    def _call_live_gemini(
        self,
        change_type: str,
        target_route: str,
        field_name: str,
        old_value: Optional[str],
        new_value: Optional[str],
        confidence_tier: str,
        verification_status: str
    ) -> Optional[str]:
        """
        Calls live Gemini API using google-genai or urllib HTTP fallback without leaking source code.
        """
        try:
            prompt = (
                "You are an expert API governance assistant. Write a concise, 1-2 sentence plain-English advisory "
                "explanation for a Pull Request reviewer about the following API contract drift:\n"
                f"- Route: {target_route}\n"
                f"- Change Type: {change_type}\n"
                f"- Field/Param: {field_name}\n"
                f"- Baseline Value: {old_value or 'N/A'}\n"
                f"- Proposed Value: {new_value or 'N/A'}\n"
                f"- Confidence Tier: {confidence_tier}\n"
                f"- Verification Status: {verification_status}\n\n"
                "Focus on downstream consumer client impact and runtime consequences (e.g. 404, NullPointer, 422). Keep it under 40 words."
            )

            # Try google-genai SDK if available
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                if response and response.text:
                    return response.text.strip()
            except ImportError:
                pass

            # Fallback to direct HTTP request using urllib
            import json
            import urllib.request
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
            payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
        except Exception:
            pass
        return None

    def _generate_advisory_explanation(
        self,
        change_type: str,
        target_route: str,
        field_name: str,
        old_value: Optional[str],
        new_value: Optional[str],
        confidence_tier: str,
        verification_status: str
    ) -> str:
        """
        Generates a 1-3 sentence explanation written for a PR reviewer based on minimal metadata.
        """
        confidence_note = "statically verified" if confidence_tier == "HIGH_CONFIDENCE_BREAK" else "identified via dynamic path resolution"

        if change_type == "FIELD_RENAMED":
            return (
                f"The response field '{field_name}' was renamed to '{new_value}' on route '{target_route}' ({confidence_note}). "
                f"Upstream consumer clients expecting '{field_name}' will receive undefined or null values at runtime unless updated or alias-mapped."
            )
        elif change_type == "FIELD_DELETED":
            return (
                f"Field '{field_name}' ({old_value}) was removed from the response model on '{target_route}'. "
                f"Consumer services reading this property will throw runtime NullPointer / AttributeError exceptions."
            )
        elif change_type in ("FIELD_TYPE_MUTATED", "TYPE_MISMATCH"):
            return (
                f"The data type of field '{field_name}' on '{target_route}' changed from '{old_value}' to '{new_value}'. "
                f"Downstream parsers expecting type '{old_value}' will fail JSON schema validation or type casting."
            )
        elif change_type == "ROUTE_MUTATED":
            return (
                f"The endpoint URL signature for '{target_route}' was mutated ({confidence_note}). "
                f"Consumer clients issuing HTTP requests to the baseline path will receive HTTP 404 Not Found errors."
            )
        elif change_type == "ROUTE_REMOVED":
            return (
                f"Endpoint route '{target_route}' was completely deleted from the producer service. "
                f"All cross-repository network calls targeting this route will fail with HTTP 404 Not Found."
            )
        elif change_type == "REQUIRED_PARAM_ADDED":
            return (
                f"A new mandatory parameter '{field_name}' was added to route '{target_route}' without a default value. "
                f"Legacy consumer requests omitting this parameter will be rejected with HTTP 422 Unprocessable Entity."
            )
        else:
            return (
                f"Contract drift ({change_type}) detected on endpoint '{target_route}' for field '{field_name}'. "
                f"Review downstream consumer compatibility before merging this pull request."
            )
