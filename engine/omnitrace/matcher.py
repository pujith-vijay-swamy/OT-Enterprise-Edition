from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from omnitrace.ir import ServiceContract, EndpointRoute, ConsumerCall, normalize_route_path

@dataclass
class ServiceDependencyEdge:
    consumer_service: str
    producer_service: str
    consumer_call: ConsumerCall
    matched_route: Optional[EndpointRoute]
    status: str  # HEALTHY | WARN | BREAKING | MISSING_PRODUCER
    issues: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "consumer_service": self.consumer_service,
            "producer_service": self.producer_service,
            "target_path": self.consumer_call.target_path,
            "normalized_path": self.consumer_call.normalized_path,
            "method": self.consumer_call.method,
            "consumer_file": self.consumer_call.source_file,
            "consumer_line": self.consumer_call.line_number,
            "producer_file": self.matched_route.source_file if self.matched_route else None,
            "producer_line": self.matched_route.line_number if self.matched_route else None,
            "status": self.status,
            "issues": self.issues
        }

@dataclass
class TopologyGraph:
    services: List[ServiceContract]
    edges: List[ServiceDependencyEdge]
    unmatched_consumer_calls: List[Dict[str, Any]]
    unmatched_producer_routes: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "services": [s.to_dict() for s in self.services],
            "edges": [e.to_dict() for e in self.edges],
            "unmatched_consumer_calls": self.unmatched_consumer_calls,
            "unmatched_producer_routes": self.unmatched_producer_routes
        }


def get_route_base_prefix(path: str) -> str:
    """Extract base route prefix, e.g. /api/v1/users from /api/v1/users/{param}"""
    norm = normalize_route_path(path)
    parts = [p for p in norm.split('/') if p and not p.startswith('{')]
    return '/' + '/'.join(parts[:3]) if len(parts) >= 3 else '/' + '/'.join(parts)


class CrossRepoMatcher:
    """
    Matches consumer network calls to upstream producer routes across disconnected repositories.
    Evaluates every consumer call against all producers for exact matches, payload compatibility,
    and mutated route signature drifts.
    """

    def __init__(self, contracts: Optional[List[ServiceContract]] = None):
        self.contracts = contracts or []

    def build_topology(self, contracts: Optional[List[ServiceContract]] = None) -> Dict[str, Any]:
        target_contracts = contracts if contracts is not None else self.contracts

        producers = [c for c in target_contracts if c.service_type in ("producer", "fullstack")]
        consumers = [c for c in target_contracts if c.service_type in ("consumer", "fullstack")]

        edges: List[ServiceDependencyEdge] = []
        unmatched_consumer_calls = []
        matched_producer_keys = set()

        for consumer in consumers:
            for call in consumer.consumer_calls:
                method = call.method.upper()
                call_norm_path = normalize_route_path(call.target_path)
                call_base_prefix = get_route_base_prefix(call_norm_path)

                matched_any_producer = False

                for producer in producers:
                    if producer.service_name == consumer.service_name:
                        continue

                    # 1. Search for exact route match first
                    exact_matches = [r for r in producer.routes if r.method.upper() == method and r.normalized_path == call_norm_path]
                    
                    if exact_matches:
                        route = exact_matches[0]
                        matched_producer_keys.add((producer.service_name, method, route.path))
                        matched_any_producer = True
                        
                        status = "HEALTHY"
                        issues = []

                        # Check expected response fields compatibility
                        if call.expected_response_fields and route.response_schema:
                            available_fields = {f.name for f in route.response_schema.fields}
                            missing_fields = [f for f in call.expected_response_fields if f not in available_fields]
                            if missing_fields:
                                status = "BREAKING"
                                issues.append(f"Response schema missing fields expected by consumer: {', '.join(missing_fields)}")

                        edges.append(ServiceDependencyEdge(
                            consumer_service=consumer.service_name,
                            producer_service=producer.service_name,
                            consumer_call=call,
                            matched_route=route,
                            status=status,
                            issues=issues
                        ))

                    # 2. If no exact match, check fuzzy route prefix match
                    else:
                        prefix_matches = [
                            r for r in producer.routes 
                            if get_route_base_prefix(r.normalized_path) == call_base_prefix
                            or (call.target_service_hint and call.target_service_hint in producer.service_name)
                        ]
                        if prefix_matches:
                            route = prefix_matches[0]
                            matched_producer_keys.add((producer.service_name, route.method.upper(), route.path))
                            matched_any_producer = True
                            edges.append(ServiceDependencyEdge(
                                consumer_service=consumer.service_name,
                                producer_service=producer.service_name,
                                consumer_call=call,
                                matched_route=route,
                                status="BREAKING",
                                issues=[f"Route path mutated from baseline contract: Consumer calls '{call.target_path}' but producer hosts '{route.path}'"]
                            ))

                if not matched_any_producer:
                    unmatched_consumer_calls.append({
                        "consumer_service": consumer.service_name,
                        "call": call.to_dict()
                    })

        # Identify unused or uncalled producer routes
        unmatched_producer_routes = []
        for producer in producers:
            for route in producer.routes:
                if (producer.service_name, route.method.upper(), route.path) not in matched_producer_keys:
                    unmatched_producer_routes.append({
                        "producer_service": producer.service_name,
                        "route": route.to_dict()
                    })

        graph = TopologyGraph(
            services=target_contracts,
            edges=edges,
            unmatched_consumer_calls=unmatched_consumer_calls,
            unmatched_producer_routes=unmatched_producer_routes
        )
        return graph.to_dict()
