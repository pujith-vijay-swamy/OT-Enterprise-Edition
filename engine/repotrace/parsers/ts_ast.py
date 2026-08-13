import os
import re
from typing import List, Dict, Any, Optional
from repotrace.ir import (
    EndpointRoute, RouteParam, PayloadSchema, SchemaField,
    ServiceContract, ConsumerCall, normalize_route_path
)
from repotrace.parsers.base import BaseParser

class TypeScriptASTParser(BaseParser):
    """
    AST & Pattern Extractor for TypeScript/JavaScript (Express, Node, React, fetch, axios).
    Extracts server routes and consumer network invocations.
    """

    EXPRESS_ROUTE_REGEX = re.compile(
        r'(?:app|router|server)\s*\.\s*(get|post|put|delete|patch|options)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]'
    )
    FETCH_AXIOS_REGEX = re.compile(
        r'(?:axios|fetch|api|client|httpServices?)\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>]+>)?\s*\(\s*(?:[\'"`]([^\'"`]+)[\'"`]|`([^`]+)`)',
        re.IGNORECASE
    )
    FETCH_DIRECT_REGEX = re.compile(
        r'fetch\s*\(\s*(?:[\'"`]([^\'"`]+)[\'"`]|`([^`]+)`)(?:\s*,\s*\{\s*method\s*:\s*[\'"`]([A-Z]+)[\'"`])?',
        re.IGNORECASE
    )
    TS_INTERFACE_REGEX = re.compile(
        r'(?:interface|type)\s+([A-Za-z0-9_]+)\s*(?:=\s*)?\{([^}]+)\}',
        re.MULTILINE
    )

    def __init__(self):
        self.ts_interfaces: Dict[str, List[SchemaField]] = {}

    def parse_directory(self, root_dir: str, service_name: str = "") -> ServiceContract:
        if not service_name:
            service_name = os.path.basename(os.path.abspath(root_dir)) or "ts-service"

        contract = ServiceContract(
            service_name=service_name,
            service_type="consumer",
            language="typescript",
            repository=os.path.abspath(root_dir)
        )

        for dirpath, _, filenames in os.walk(root_dir):
            if "node_modules" in dirpath or ".next" in dirpath or "dist" in dirpath or "build" in dirpath:
                continue

            for filename in filenames:
                if filename.endswith((".js", ".jsx", ".ts", ".tsx")):
                    filepath = os.path.join(dirpath, filename)
                    rel_path = os.path.relpath(filepath, root_dir)
                    routes, consumer_calls = self.parse_file(filepath, rel_path)
                    contract.routes.extend(routes)
                    contract.consumer_calls.extend(consumer_calls)

        if contract.routes and not contract.consumer_calls:
            contract.service_type = "producer"
        elif contract.routes and contract.consumer_calls:
            contract.service_type = "fullstack"

        return contract

    NEXT_APP_ROUTE_REGEX = re.compile(
        r'export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|DELETE|PATCH|options|head)\b',
        re.IGNORECASE
    )

    def parse_file(self, filepath: str, rel_path: str = "") -> (List[EndpointRoute], List[ConsumerCall]):
        routes: List[EndpointRoute] = []
        consumer_calls: List[ConsumerCall] = []

        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            return routes, consumer_calls

        rel_path = rel_path or os.path.basename(filepath)
        normalized_rel = rel_path.replace("\\", "/").lower()
        lines = content.splitlines()

        # Parse TypeScript interfaces
        for match in self.TS_INTERFACE_REGEX.finditer(content):
            if_name = match.group(1)
            if_body = match.group(2)
            fields = []
            for field_line in if_body.splitlines():
                field_line = field_line.strip()
                if ":" in field_line:
                    parts = field_line.split(":")
                    fname = parts[0].strip().rstrip("?")
                    ftype = parts[1].strip().rstrip(";").rstrip(",")
                    is_optional = "?" in parts[0]
                    fields.append(SchemaField(name=fname, field_type=ftype, required=not is_optional))
            if fields:
                self.ts_interfaces[if_name] = fields

        # Next.js App Router API Routes (e.g. app/api/users/route.ts or src/app/api/v1/users/[id]/route.ts)
        if ("app/" in normalized_rel or "pages/api" in normalized_rel) and normalized_rel.endswith((".ts", ".js", ".tsx", ".jsx")):
            # Infer route path from directory structure
            inferred_path = ""
            if "app/" in normalized_rel:
                parts = normalized_rel.split("app/")[-1].split("/")
                if parts[-1].startswith("route."):
                    parts.pop()
                inferred_path = "/" + "/".join(parts)
            elif "pages/api/" in normalized_rel:
                parts = normalized_rel.split("pages/")[-1].split("/")
                filename_clean = parts[-1].split(".")[0]
                if filename_clean == "index":
                    parts.pop()
                else:
                    parts[-1] = filename_clean
                inferred_path = "/" + "/".join(parts)

            if inferred_path:
                # Convert Next.js param format [id] to Express format :id
                inferred_path = re.sub(r'\[([a-zA-Z0-9_]+)\]', r':\1', inferred_path)
                
                for i, line in enumerate(lines, 1):
                    for match in self.NEXT_APP_ROUTE_REGEX.finditer(line):
                        method = match.group(1).upper()
                        param_matches = re.findall(r'/:([a-zA-Z0-9_]+)', inferred_path)
                        path_params = [RouteParam(name=p, param_type="string", required=True) for p in param_matches]

                        routes.append(EndpointRoute(
                            path=inferred_path,
                            method=method,
                            handler_name=f"next_handler_L{i}",
                            source_file=rel_path,
                            line_number=i,
                            match_confidence="static",
                            path_params=path_params
                        ))

        # Parse Express Routes & NestJS Controllers
        for i, line in enumerate(lines, 1):
            for match in self.EXPRESS_ROUTE_REGEX.finditer(line):
                method = match.group(1).upper()
                raw_path = match.group(2)
                confidence = "dynamic" if ("${" in line or "+" in line) else "static"
                
                # Extract path params from Express format e.g. /users/:id
                path_params = []
                param_matches = re.findall(r'/:([a-zA-Z0-9_]+)', raw_path)
                for p in param_matches:
                    path_params.append(RouteParam(name=p, param_type="string", required=True))

                routes.append(EndpointRoute(
                    path=raw_path,
                    method=method,
                    handler_name=f"express_handler_L{i}",
                    source_file=rel_path,
                    line_number=i,
                    match_confidence=confidence,
                    path_params=path_params
                ))

            # Parse Axios / Fetch consumer calls with optional TS generic type
            for match in re.finditer(
                r'(?:axios|fetch|api|client|httpServices?)\s*\.\s*(get|post|put|delete|patch)\s*(?:<([A-Za-z0-9_]+)>)?\s*\(\s*(?:[\'"`]([^\'"`]+)[\'"`]|`([^`]+)`)',
                line,
                re.IGNORECASE
            ):
                method = match.group(1).upper()
                generic_type = match.group(2)
                target_url = match.group(3) or match.group(4)
                matched_text = match.group(0)
                confidence = "dynamic" if ("${" in matched_text or "+" in line) else "static"
                
                exp_fields = []
                if generic_type and generic_type in self.ts_interfaces:
                    exp_fields = [f.name for f in self.ts_interfaces[generic_type]]

                if target_url and ("/" in target_url or "api" in target_url):
                    if not target_url.endswith((".png", ".jpg", ".css", ".svg", ".js")):
                        consumer_calls.append(ConsumerCall(
                            target_path=target_url,
                            method=method,
                            source_file=rel_path,
                            line_number=i,
                            match_confidence=confidence,
                            caller_component=os.path.basename(filepath).split(".")[0],
                            expected_fields=exp_fields
                        ))

            for match in self.FETCH_DIRECT_REGEX.finditer(line):
                target_url = match.group(1) or match.group(2)
                method = (match.group(3) or "GET").upper()
                matched_text = match.group(0)
                confidence = "dynamic" if ("${" in matched_text or "+" in line) else "static"
                if target_url and ("/" in target_url or "api" in target_url):
                    if not target_url.endswith((".png", ".jpg", ".css", ".svg", ".js")):
                        consumer_calls.append(ConsumerCall(
                            target_path=target_url,
                            method=method,
                            source_file=rel_path,
                            line_number=i,
                            match_confidence=confidence,
                            caller_component=os.path.basename(filepath).split(".")[0]
                        ))

        return routes, consumer_calls
