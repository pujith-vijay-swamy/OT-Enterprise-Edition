import json
import re
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

def normalize_route_path(path: str) -> str:
    """
    Standardize parameterized route paths across Python and TypeScript.
    Converts:
      http://localhost:8000/api/v1/users/{user_id}?ref=1 -> /api/v1/users/{param}
      /api/v1/users/${id}                               -> /api/v1/users/{param}
      /api/v1/users/:id                                 -> /api/v1/users/{param}
      /api/v1/users/123                                 -> /api/v1/users/{param}
      /api/v1/users/a8f3b20c-1234-4567-890a-bcdef1234567 -> /api/v1/users/{param}
    """
    if not path:
        return "/"

    # Strip query parameters
    path = path.split('?')[0].split('#')[0]

    # Strip http://domain:port or https://domain prefix if present
    path = re.sub(r'^https?://[^/]+', '', path)

    # Ensure leading slash
    if not path.startswith("/"):
        path = "/" + path
        
    # Remove trailing slash if not root
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]

    # JS Template literal format: ${param_name} or ${...}
    path = re.sub(r'\$\{[^}]+\}', '{param}', path)
    # Python format: {param_name}
    path = re.sub(r'\{[a-zA-Z0-9_]+\}', '{param}', path)
    # Express style format: :param_name
    path = re.sub(r'/:[a-zA-Z0-9_]+', '/{param}', path)
    # UUIDs in paths e.g. /users/a8f3b20c-1234-4567-890a-bcdef1234567
    path = re.sub(r'/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=/|$)', '/{param}', path)
    # Numeric IDs in paths e.g. /users/42
    path = re.sub(r'/\d+(?=/|$)', '/{param}', path)

    return path


@dataclass
class RouteParam:
    name: str
    param_type: str = "string"
    required: bool = True
    default: Optional[Any] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SchemaField:
    name: str
    field_type: str = "string"
    required: bool = True
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ObjectSchema:
    raw_type: str = "object"
    fields: List[SchemaField] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw_type": self.raw_type,
            "fields": [f.to_dict() for f in self.fields]
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'ObjectSchema':
        if not data:
            return cls(raw_type="object", fields=[])
        fields = [SchemaField(**f) for f in data.get("fields", [])]
        return cls(raw_type=data.get("raw_type", "object"), fields=fields)

# Alias for backwards compatibility across AST parsers
PayloadSchema = ObjectSchema


@dataclass
class EndpointRoute:
    path: str
    method: str = "GET"
    normalized_path: str = ""
    handler_name: str = "unknown"
    source_file: str = ""
    line_number: int = 0
    match_confidence: str = "static"  # "static" | "dynamic"
    path_params: List[RouteParam] = field(default_factory=list)
    request_schema: Optional[ObjectSchema] = None
    response_schema: Optional[ObjectSchema] = None

    def __post_init__(self):
        if not self.normalized_path:
            self.normalized_path = normalize_route_path(self.path)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "normalized_path": self.normalized_path,
            "method": self.method,
            "handler_name": self.handler_name,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "match_confidence": self.match_confidence,
            "path_params": [p.to_dict() for p in self.path_params],
            "request_schema": self.request_schema.to_dict() if self.request_schema else None,
            "response_schema": self.response_schema.to_dict() if self.response_schema else None
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'EndpointRoute':
        params = [RouteParam(**p) for p in data.get("path_params", [])]
        req_s = ObjectSchema.from_dict(data["request_schema"]) if data.get("request_schema") else None
        res_s = ObjectSchema.from_dict(data["response_schema"]) if data.get("response_schema") else None

        return cls(
            path=data["path"],
            method=data.get("method", "GET"),
            normalized_path=data.get("normalized_path") or normalize_route_path(data["path"]),
            handler_name=data.get("handler_name", "unknown"),
            source_file=data.get("source_file", ""),
            line_number=data.get("line_number", 0),
            match_confidence=data.get("match_confidence", "static"),
            path_params=params,
            request_schema=req_s,
            response_schema=res_s
        )


@dataclass
class ConsumerCall:
    target_path: str
    target_service_hint: str = ""
    normalized_path: str = ""
    method: str = "GET"
    caller_function: str = "unknown"
    caller_component: str = "unknown"
    source_file: str = ""
    line_number: int = 0
    match_confidence: str = "static"  # "static" | "dynamic"
    expected_response_fields: List[str] = field(default_factory=list)
    expected_fields: List[str] = field(default_factory=list)

    def __post_init__(self):
        if not self.normalized_path:
            self.normalized_path = normalize_route_path(self.target_path)
        if self.expected_fields and not self.expected_response_fields:
            self.expected_response_fields = self.expected_fields
        elif self.expected_response_fields and not self.expected_fields:
            self.expected_fields = self.expected_response_fields

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target_service_hint": self.target_service_hint,
            "target_path": self.target_path,
            "normalized_path": self.normalized_path,
            "method": self.method,
            "caller_function": self.caller_function,
            "caller_component": self.caller_component,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "match_confidence": self.match_confidence,
            "expected_response_fields": self.expected_response_fields,
            "expected_fields": self.expected_fields
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'ConsumerCall':
        exp = data.get("expected_response_fields") or data.get("expected_fields") or []
        return cls(
            target_path=data["target_path"],
            target_service_hint=data.get("target_service_hint", ""),
            normalized_path=data.get("normalized_path") or normalize_route_path(data["target_path"]),
            method=data.get("method", "GET"),
            caller_function=data.get("caller_function") or data.get("caller_component") or "unknown",
            caller_component=data.get("caller_component") or data.get("caller_function") or "unknown",
            source_file=data.get("source_file", ""),
            line_number=data.get("line_number", 0),
            match_confidence=data.get("match_confidence", "static"),
            expected_response_fields=exp,
            expected_fields=exp
        )


@dataclass
class ServiceContract:
    service_name: str
    service_type: str = "producer" # "producer", "consumer", "fullstack"
    language: str = "python"
    repository: str = ""
    version: str = "1.0.0"
    routes: List[EndpointRoute] = field(default_factory=list)
    consumer_calls: List[ConsumerCall] = field(default_factory=list)
    schema_version: str = "repotrace.contract.v1"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "service_name": self.service_name,
            "service_type": self.service_type,
            "language": self.language,
            "repository": self.repository,
            "version": self.version,
            "routes": [r.to_dict() for r in self.routes],
            "consumer_calls": [c.to_dict() for c in self.consumer_calls]
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    def save_json(self, output_path: str):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(self.to_json())

    @classmethod
    def load_json(cls, file_path: str) -> 'ServiceContract':
        with open(file_path, "r", encoding="utf-8") as f:
            return cls.from_json(f.read())

    @classmethod
    def from_json(cls, json_str: str) -> 'ServiceContract':
        data = json.loads(json_str)
        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: dict) -> 'ServiceContract':
        routes = [EndpointRoute.from_dict(r) for r in data.get("routes", [])]
        consumer_calls = [ConsumerCall.from_dict(c) for c in data.get("consumer_calls", [])]
        return cls(
            service_name=data.get("service_name", "unknown"),
            service_type=data.get("service_type", "producer"),
            language=data.get("language", "unknown"),
            repository=data.get("repository", ""),
            version=data.get("version", "1.0.0"),
            routes=routes,
            consumer_calls=consumer_calls
        )
