import ast
import os
from typing import List, Dict, Any, Optional
from omnitrace.ir import (
    EndpointRoute, RouteParam, PayloadSchema, SchemaField,
    ServiceContract, ConsumerCall, normalize_route_path
)
from omnitrace.parsers.base import BaseParser

class PythonASTParser(BaseParser):
    """
    Static AST Parser for Python applications (FastAPI, Flask, requests/httpx calls).
    """

    def __init__(self):
        self.pydantic_models: Dict[str, List[SchemaField]] = {}

    def parse_directory(self, root_dir: str, service_name: str = "") -> ServiceContract:
        if not service_name:
            service_name = os.path.basename(os.path.abspath(root_dir)) or "python-service"

        contract = ServiceContract(
            service_name=service_name,
            service_type="producer",
            language="python",
            repository=os.path.abspath(root_dir)
        )

        # First pass: collect Pydantic models across files
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                if filename.endswith(".py"):
                    filepath = os.path.join(dirpath, filename)
                    self._collect_pydantic_models(filepath)

        # Second pass: extract endpoints and client consumer calls
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                if filename.endswith(".py"):
                    filepath = os.path.join(dirpath, filename)
                    rel_path = os.path.relpath(filepath, root_dir)
                    routes, consumer_calls = self.parse_file(filepath, rel_path)
                    contract.routes.extend(routes)
                    contract.consumer_calls.extend(consumer_calls)

        if contract.consumer_calls and not contract.routes:
            contract.service_type = "consumer"
        elif contract.consumer_calls and contract.routes:
            contract.service_type = "fullstack"

        return contract

    def _collect_pydantic_models(self, filepath: str):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=filepath)
        except Exception:
            return

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                # Check if inherits BaseModel or dataclass
                is_model = any(
                    (isinstance(b, ast.Name) and b.id in ("BaseModel", "Schema")) or
                    (isinstance(b, ast.Attribute) and b.attr in ("BaseModel", "Schema"))
                    for b in node.bases
                )
                if is_model or node.name.endswith("Schema") or node.name.endswith("Response") or node.name.endswith("Request"):
                    fields = []
                    for item in node.body:
                        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                            field_name = item.target.id
                            field_type = self._ast_to_str(item.annotation)
                            has_default = item.value is not None
                            fields.append(SchemaField(
                                name=field_name,
                                field_type=field_type,
                                required=not has_default
                            ))
                    self.pydantic_models[node.name] = fields

    def parse_file(self, filepath: str, rel_path: str = "") -> (List[EndpointRoute], List[ConsumerCall]):
        routes: List[EndpointRoute] = []
        consumer_calls: List[ConsumerCall] = []

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                code_text = f.read()
                tree = ast.parse(code_text, filename=filepath)
        except Exception:
            return routes, consumer_calls

        rel_path = rel_path or os.path.basename(filepath)

        for node in ast.walk(tree):
            # Check for route handlers: FunctionDef or AsyncFunctionDef
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                extracted_routes = self._extract_routes_from_func(node, rel_path)
                routes.extend(extracted_routes)

            # Check for outbound client calls (requests.get, httpx.post, aiohttp)
            if isinstance(node, ast.Call):
                call_info = self._extract_consumer_call(node, rel_path)
                if call_info:
                    consumer_calls.append(call_info)

        return routes, consumer_calls

    def _extract_routes_from_func(self, node: ast.AST, rel_path: str) -> List[EndpointRoute]:
        routes = []
        func_name = node.name

        for decorator in node.decorator_list:
            path = None
            method = "GET"
            response_model_name = None

            # Handle @app.get("/path"), @router.post("/path", response_model=Model)
            if isinstance(decorator, ast.Call):
                func = decorator.func
                # Check decorator attribute e.g. app.get or router.post
                if isinstance(func, ast.Attribute):
                    attr_name = func.attr.lower()
                    if attr_name in ("get", "post", "put", "delete", "patch", "options", "head"):
                        method = attr_name.upper()
                        if decorator.args:
                            path = self._eval_str_literal(decorator.args[0])
                        # Look for path/response_model in keywords
                        for kw in decorator.keywords:
                            if kw.arg in ("path", "rule"):
                                path = self._eval_str_literal(kw.value)
                            elif kw.arg == "response_model":
                                if isinstance(kw.value, ast.Name):
                                    response_model_name = kw.value.id
                    elif attr_name == "route":  # Flask @app.route('/path', methods=['GET', 'POST'])
                        if decorator.args:
                            path = self._eval_str_literal(decorator.args[0])
                        for kw in decorator.keywords:
                            if kw.arg == "methods" and isinstance(kw.value, (ast.List, ast.Tuple)):
                                methods = [self._eval_str_literal(elt) for elt in kw.value.elts]
                                if methods:
                                    method = methods[0].upper()

            if path:
                # Extract path params from function signature
                path_params = []
                for arg in node.args.args:
                    if arg.arg not in ("self", "cls", "request", "db", "session"):
                        param_type = self._ast_to_str(arg.annotation) if arg.annotation else "string"
                        path_params.append(RouteParam(
                            name=arg.arg,
                            param_type=param_type,
                            required=True
                        ))

                # Build response schema if response model found
                res_schema = None
                if response_model_name and response_model_name in self.pydantic_models:
                    res_schema = PayloadSchema(fields=self.pydantic_models[response_model_name])
                else:
                    # Inferred basic schema from function args/annotations
                    fields = []
                    for arg in node.args.args:
                        if arg.arg in ("payload", "data", "body", "item", "user_in", "req"):
                            arg_type = self._ast_to_str(arg.annotation)
                            if arg_type in self.pydantic_models:
                                fields.extend(self.pydantic_models[arg_type])
                            else:
                                fields.append(SchemaField(name=arg.arg, field_type=arg_type))
                    if fields:
                        res_schema = PayloadSchema(fields=fields)

                route = EndpointRoute(
                    path=path,
                    method=method,
                    handler_name=func_name,
                    source_file=rel_path,
                    line_number=node.lineno,
                    path_params=path_params,
                    response_schema=res_schema
                )
                routes.append(route)

        return routes

    def _extract_consumer_call(self, node: ast.Call, rel_path: str) -> Optional[ConsumerCall]:
        func = node.func
        if isinstance(func, ast.Attribute):
            obj_name = ""
            if isinstance(func.value, ast.Name):
                obj_name = func.value.id
            attr_name = func.attr.lower()

            if obj_name in ("requests", "httpx", "client", "session", "http") and attr_name in ("get", "post", "put", "delete", "patch"):
                if node.args:
                    url = self._eval_str_literal(node.args[0])
                    if url:
                        return ConsumerCall(
                            target_path=url,
                            method=attr_name.upper(),
                            source_file=rel_path,
                            line_number=node.lineno,
                            caller_component=obj_name
                        )
        return None

    def _eval_str_literal(self, node: ast.AST) -> str:
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        elif isinstance(node, ast.Str):
            return node.s
        elif isinstance(node, ast.JoinedStr):  # f-strings e.g. f"/api/users/{user_id}"
            parts = []
            for elt in node.values:
                if isinstance(elt, (ast.Constant, ast.Str)):
                    parts.append(self._eval_str_literal(elt))
                else:
                    parts.append("{param}")
            return "".join(parts)
        return ""

    def _ast_to_str(self, node: Optional[ast.AST]) -> str:
        if node is None:
            return "any"
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._ast_to_str(node.value)}.{node.attr}"
        elif isinstance(node, ast.Subscript):
            return f"{self._ast_to_str(node.value)}[{self._ast_to_str(node.slice)}]"
        elif isinstance(node, ast.Constant):
            return str(node.value)
        return "string"
