import { ServiceNodeData, ServiceEdgeData, ContractDrift, GovernancePolicy, MTTDMetricPoint } from './types';

export const INITIAL_SERVICES: ServiceNodeData[] = [
  {
    id: 'user-service',
    label: 'user-service (FastAPI)',
    service_type: 'producer',
    language: 'python',
    repository: 'github.com/omnitrace/user-service',
    version: 'v2.0.0-rc1',
    routes_count: 3,
    consumer_calls_count: 0,
    health: 'BREAKING',
    rps: 1420,
    latency_ms: 18,
    routes: [
      {
        path: '/api/v1/users/{tenant_id}/{user_id}',
        normalized_path: '/api/v1/users/{param}/{param}',
        method: 'GET',
        handler_name: 'get_user_profile_v2',
        source_file: 'main.py',
        line_number: 18,
        path_params: [
          { name: 'tenant_id', param_type: 'string', required: true },
          { name: 'user_id', param_type: 'string', required: true }
        ],
        response_fields: [
          { name: 'id', field_type: 'str', required: true },
          { name: 'user_email', field_type: 'str', required: true, description: 'Renamed from email' },
          { name: 'user_role', field_type: 'str', required: true }
        ]
      },
      {
        path: '/api/v1/users',
        normalized_path: '/api/v1/users',
        method: 'POST',
        handler_name: 'create_user',
        source_file: 'main.py',
        line_number: 26,
        path_params: [],
        response_fields: [
          { name: 'id', field_type: 'str', required: true },
          { name: 'user_email', field_type: 'str', required: true }
        ]
      }
    ],
    consumer_calls: []
  },
  {
    id: 'checkout-frontend',
    label: 'checkout-frontend (React TS)',
    service_type: 'consumer',
    language: 'typescript',
    repository: 'github.com/omnitrace/checkout-frontend',
    version: 'v1.4.2',
    routes_count: 0,
    consumer_calls_count: 2,
    health: 'BREAKING',
    rps: 890,
    latency_ms: 45,
    routes: [],
    consumer_calls: [
      {
        target_path: '/api/v1/users/${userId}',
        normalized_path: '/api/v1/users/{param}',
        method: 'GET',
        source_file: 'src/UserProfile.tsx',
        line_number: 12,
        caller_component: 'UserProfileCard',
        expected_fields: ['id', 'email', 'is_active']
      }
    ]
  },
  {
    id: 'payment-gateway',
    label: 'payment-gateway (Express)',
    service_type: 'fullstack',
    language: 'typescript',
    repository: 'github.com/omnitrace/payment-gateway',
    version: 'v3.1.0',
    routes_count: 4,
    consumer_calls_count: 3,
    health: 'BREAKING',
    rps: 2150,
    latency_ms: 32,
    routes: [
      {
        path: '/api/v1/payments/charge',
        normalized_path: '/api/v1/payments/charge',
        method: 'POST',
        handler_name: 'chargePayment',
        source_file: 'src/routes/payment.ts',
        line_number: 44,
        path_params: [],
        response_fields: [
          { name: 'charge_id', field_type: 'string', required: true },
          { name: 'status', field_type: 'string', required: true }
        ]
      }
    ],
    consumer_calls: [
      {
        target_path: '/api/v1/users/${id}',
        normalized_path: '/api/v1/users/{param}',
        method: 'GET',
        source_file: 'src/services/userClient.ts',
        line_number: 28,
        caller_component: 'UserValidationService',
        expected_fields: ['id', 'email', 'is_active']
      }
    ]
  },
  {
    id: 'order-service',
    label: 'order-service (Python FastAPI)',
    service_type: 'fullstack',
    language: 'python',
    repository: 'github.com/omnitrace/order-service',
    version: 'v2.3.0',
    routes_count: 5,
    consumer_calls_count: 2,
    health: 'WARN',
    rps: 1100,
    latency_ms: 24,
    routes: [
      {
        path: '/api/v1/orders/{order_id}',
        normalized_path: '/api/v1/orders/{param}',
        method: 'GET',
        handler_name: 'get_order',
        source_file: 'orders/api.py',
        line_number: 55,
        path_params: [{ name: 'order_id', param_type: 'str', required: true }]
      }
    ],
    consumer_calls: [
      {
        target_path: '/api/v1/payments/charge',
        normalized_path: '/api/v1/payments/charge',
        method: 'POST',
        source_file: 'orders/checkout.py',
        line_number: 89,
        caller_component: 'CheckoutFlow',
        expected_fields: ['charge_id', 'status']
      }
    ]
  },
  {
    id: 'notification-service',
    label: 'notification-service (Node.js)',
    service_type: 'consumer',
    language: 'typescript',
    repository: 'github.com/omnitrace/notification-service',
    version: 'v1.1.0',
    routes_count: 0,
    consumer_calls_count: 1,
    health: 'BREAKING',
    rps: 340,
    latency_ms: 12,
    routes: [],
    consumer_calls: [
      {
        target_path: '/api/v1/users/${id}',
        normalized_path: '/api/v1/users/{param}',
        method: 'GET',
        source_file: 'src/mailer.ts',
        line_number: 19,
        caller_component: 'EmailDispatcher',
        expected_fields: ['email']
      }
    ]
  },
  {
    id: 'analytics-worker',
    label: 'analytics-worker (Python)',
    service_type: 'consumer',
    language: 'python',
    repository: 'github.com/omnitrace/analytics-worker',
    version: 'v1.0.1',
    routes_count: 0,
    consumer_calls_count: 1,
    health: 'HEALTHY',
    rps: 520,
    latency_ms: 15,
    routes: [],
    consumer_calls: [
      {
        target_path: '/api/v1/orders/{order_id}',
        normalized_path: '/api/v1/orders/{param}',
        method: 'GET',
        source_file: 'worker.py',
        line_number: 40,
        caller_component: 'OrderAnalyticsPipeline',
        expected_fields: ['order_id']
      }
    ]
  }
];

export const INITIAL_EDGES: ServiceEdgeData[] = [
  {
    id: 'e-checkout-user',
    source: 'checkout-frontend',
    target: 'user-service',
    target_path: '/api/v1/users/{user_id}',
    method: 'GET',
    status: 'BREAKING',
    issues: [
      "Endpoint 'GET /api/v1/users/{user_id}' was removed in v2.0.0",
      "Consumer expects field 'email' which was renamed to 'user_email'",
      "Consumer expects field 'is_active' which was deleted from producer response schema"
    ],
    traffic_rps: 890
  },
  {
    id: 'e-payment-user',
    source: 'payment-gateway',
    target: 'user-service',
    target_path: '/api/v1/users/{user_id}',
    method: 'GET',
    status: 'BREAKING',
    issues: [
      "Endpoint signature changed to require tenant_id path parameter",
      "Field 'email' missing in payload"
    ],
    traffic_rps: 1240
  },
  {
    id: 'e-notification-user',
    source: 'notification-service',
    target: 'user-service',
    target_path: '/api/v1/users/{user_id}',
    method: 'GET',
    status: 'BREAKING',
    issues: [
      "Missing expected field 'email' in user-service response model"
    ],
    traffic_rps: 340
  },
  {
    id: 'e-order-payment',
    source: 'order-service',
    target: 'payment-gateway',
    target_path: '/api/v1/payments/charge',
    method: 'POST',
    status: 'HEALTHY',
    issues: [],
    traffic_rps: 980
  },
  {
    id: 'e-analytics-order',
    source: 'analytics-worker',
    target: 'order-service',
    target_path: '/api/v1/orders/{order_id}',
    method: 'GET',
    status: 'HEALTHY',
    issues: [],
    traffic_rps: 520
  }
];

export const SAMPLE_DRIFTS: ContractDrift[] = [
  {
    id: 'drift-1',
    service_name: 'user-service',
    change_type: 'ROUTE_REMOVED',
    severity: 'BREAKING',
    target_route: '/api/v1/users/{user_id}',
    method: 'GET',
    field_name: 'route_path',
    old_value: 'GET /api/v1/users/{user_id}',
    new_value: 'GET /api/v1/users/{tenant_id}/{user_id}',
    description: 'Endpoint route GET /api/v1/users/{user_id} was removed and signature altered to require tenant_id',
    git_context: {
      commit_sha: 'a8f3b20c',
      author: 'alex_dev',
      author_email: 'alex@omnitrace.io',
      commit_message: 'Refactor user-service model for multi-tenant isolation',
      timestamp: '2026-07-29T14:32:10Z',
      line_number: 18,
      file_path: 'main.py'
    },
    remediation_suggestion: 'Restore legacy route handler GET /api/v1/users/{user_id} with tenant resolution fallback.'
  },
  {
    id: 'drift-2',
    service_name: 'user-service',
    change_type: 'FIELD_RENAMED',
    severity: 'BREAKING',
    target_route: '/api/v1/users',
    method: 'POST',
    field_name: 'email',
    old_value: 'email: str',
    new_value: 'user_email: str',
    description: 'Response payload field \'email\' was renamed to \'user_email\'',
    git_context: {
      commit_sha: 'a8f3b20c',
      author: 'alex_dev',
      author_email: 'alex@omnitrace.io',
      commit_message: 'Refactor user-service model for multi-tenant isolation',
      timestamp: '2026-07-29T14:32:10Z',
      line_number: 26,
      file_path: 'main.py'
    },
    remediation_suggestion: 'Add pydantic field alias @Field(..., alias="email") to maintain backwards compatibility.'
  },
  {
    id: 'drift-3',
    service_name: 'user-service',
    change_type: 'FIELD_DELETED',
    severity: 'BREAKING',
    target_route: '/api/v1/users',
    method: 'POST',
    field_name: 'is_active',
    old_value: 'is_active: bool',
    new_value: 'None',
    description: 'Field \'is_active\' was completely removed from response model UserResponseV2',
    git_context: {
      commit_sha: 'c4e10b9d',
      author: 'sam_backend',
      author_email: 'sam@omnitrace.io',
      commit_message: 'Remove legacy boolean status flags',
      timestamp: '2026-07-29T11:15:04Z',
      line_number: 12,
      file_path: 'main.py'
    },
    remediation_suggestion: 'Deprecate field before deletion and provide default boolean True flag.'
  }
];

export const INITIAL_GOVERNANCE_POLICY: GovernancePolicy = {
  production_gate: 'STRICT_BLOCK',
  staging_gate: 'WARN_ONLY',
  max_allowed_drifts: 0,
  grace_period_days: 14,
  require_pr_approval: true
};

export const MTTD_ANALYTICS_DATA: MTTDMetricPoint[] = [
  { date: 'Jul 23', mttd_minutes: 42, mttr_hours: 3.4, detected_drifts: 12, blocked_prs: 4 },
  { date: 'Jul 24', mttd_minutes: 35, mttr_hours: 2.8, detected_drifts: 8, blocked_prs: 3 },
  { date: 'Jul 25', mttd_minutes: 18, mttr_hours: 1.5, detected_drifts: 15, blocked_prs: 7 },
  { date: 'Jul 26', mttd_minutes: 12, mttr_hours: 1.1, detected_drifts: 5, blocked_prs: 2 },
  { date: 'Jul 27', mttd_minutes: 4,  mttr_hours: 0.6, detected_drifts: 9, blocked_prs: 5 },
  { date: 'Jul 28', mttd_minutes: 1,  mttr_hours: 0.2, detected_drifts: 14, blocked_prs: 8 },
  { date: 'Jul 29', mttd_minutes: 0.5, mttr_hours: 0.1, detected_drifts: 6, blocked_prs: 4 }
];

export const V1_USER_SERVICE_CODE = `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="User Microservice", version="1.0.0")

class UserResponse(BaseModel):
    id: str
    email: str
    is_active: bool
    role: str = "member"

@app.get("/api/v1/users/{user_id}", response_model=UserResponse)
def get_user_profile(user_id: str):
    return UserResponse(id=user_id, email="alice@omnitrace.io", is_active=True, role="admin")

@app.post("/api/v1/users", response_model=UserResponse)
def create_user(payload: UserCreateRequest):
    return UserResponse(id="usr_999", email=payload.email, is_active=True)`;

export const V2_USER_SERVICE_CODE = `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="User Microservice", version="2.0.0")

class UserResponseV2(BaseModel):
    id: str
    user_email: str  # [BREAKING DRIFT] Renamed from 'email' -> 'user_email'
    # [BREAKING DRIFT] 'is_active' field deleted
    user_role: str = "member"

@app.get("/api/v1/users/{tenant_id}/{user_id}", response_model=UserResponseV2)
def get_user_profile_v2(tenant_id: str, user_id: str):
    # [BREAKING DRIFT] Route signature changed & added tenant_id
    return UserResponseV2(id=user_id, user_email="alice@omnitrace.io", user_role="admin")

@app.post("/api/v1/users", response_model=UserResponseV2)
def create_user(payload: UserCreateRequest):
    return UserResponseV2(id="usr_999", user_email=payload.user_email)`;
