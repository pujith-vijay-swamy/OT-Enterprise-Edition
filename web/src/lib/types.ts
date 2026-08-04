export type HealthStatus = 'HEALTHY' | 'WARN' | 'BREAKING';

export type ServiceType = 'producer' | 'consumer' | 'fullstack';

export type Language = 'python' | 'typescript' | 'go' | 'java';

export interface RouteParam {
  name: string;
  param_type: string;
  required: boolean;
}

export interface SchemaField {
  name: string;
  field_type: string;
  required: boolean;
  description?: string;
}

export interface EndpointRoute {
  path: string;
  normalized_path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler_name: string;
  source_file: string;
  line_number: number;
  path_params: RouteParam[];
  request_fields?: SchemaField[];
  response_fields?: SchemaField[];
}

export interface ConsumerCall {
  target_path: string;
  normalized_path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  source_file: string;
  line_number: number;
  caller_component: string;
  expected_fields: string[];
  [key: string]: any;
}

export interface ServiceNodeData {
  [key: string]: any;
  id: string;
  label: string;
  service_type: ServiceType;
  language: Language;
  repository: string;
  version: string;
  routes_count: number;
  consumer_calls_count: number;
  health: HealthStatus;
  rps: number;
  latency_ms: number;
  is_selected_blast?: boolean;
  is_impacted_blast?: boolean;
  routes: EndpointRoute[];
  consumer_calls: ConsumerCall[];
}

export interface ServiceEdgeData {
  id: string;
  source: string;
  target: string;
  target_path: string;
  method: string;
  status: HealthStatus;
  issues: string[];
  traffic_rps: number;
}

export interface GitCommitContext {
  commit_sha: string;
  author: string;
  author_email: string;
  commit_message: string;
  timestamp: string;
  line_number: number;
  file_path: string;
}

export interface ContractDrift {
  id: string;
  service_name: string;
  change_type: 'FIELD_DELETED' | 'FIELD_TYPE_MUTATED' | 'FIELD_RENAMED' | 'REQUIRED_PARAM_ADDED' | 'ROUTE_REMOVED';
  severity: 'BREAKING' | 'WARNING';
  target_route: string;
  method: string;
  field_name: string;
  old_value: string;
  new_value: string;
  description: string;
  git_context: GitCommitContext;
  remediation_suggestion: string;
}

export interface GovernancePolicy {
  production_gate: 'STRICT_BLOCK' | 'WARN_ONLY';
  staging_gate: 'STRICT_BLOCK' | 'WARN_ONLY';
  max_allowed_drifts: number;
  grace_period_days: number;
  require_pr_approval: boolean;
}

export interface MTTDMetricPoint {
  date: string;
  mttd_minutes: number;
  mttr_hours: number;
  detected_drifts: number;
  blocked_prs: number;
}

export interface Route {
  path: string;
  method: string;
  [key: string]: any;
}

export interface ServiceContract {
  service_name: string;
  service_type: string;
  language: string;
  routes: Route[];
  consumer_calls: ConsumerCall[];
  [key: string]: any;
}

export interface Edge {
  consumer_service: string;
  producer_service: string;
  target_path: string;
  method: string;
  status: 'HEALTHY' | 'BREAKING' | 'MISSING_PRODUCER';
  issues: any[];
}

export interface TopologyData {
  services: ServiceContract[];
  edges: Edge[];
  unmatched_consumer_calls: any[];
  unmatched_producer_routes: any[];
}

export interface DriftItem {
  severity: 'BREAKING' | 'WARNING';
  change_type: string;
  target_endpoint: string;
  field_name: string;
  old_value: any;
  new_value: any;
  description: string;
  git_context?: {
    commit_sha?: string;
    author?: string;
    file_line?: string;
  };
  remediation?: string;
}

export interface DiffResult {
  drift_items?: DriftItem[];
  drifts?: any[];
  has_breaking_changes?: boolean;
  [key: string]: any;
}
