# RepoTrace AI - Cross-Repository API Observability and PR Governance

> Passive Cross-Repository API Boundary Observability, Static AST Contract Drift Detection, and Live Voice AI Assistant

---

## What is RepoTrace AI?

RepoTrace AI is an enterprise-grade static analysis and boundary observability platform. It statically inspects microservices across disconnected Git repositories, maps producer-consumer API contracts without running code, and automatically prevents breaking schema drifts in Pull Requests via CI/CD gates and live voice advisory intelligence.

```text
+-----------------------------------------------------------------------------+
|                        REPOTRACE AI WEB CONSOLE                             |
|    Next.js 16 (Turbopack) | React 19 | TypeScript | Tailwind CSS v4          |
|    React Flow Graph Canvas | Monaco AST Diff Editor | Live Voice Assistant   |
+--------------------------------------┬--------------------------------------+
                                       | REST API (JSON)
                                       v
+-----------------------------------------------------------------------------+
|                        REPOTRACE PYTHON AST ENGINE                          |
|    Python 3.11 REST Server (Port 4400) | Python AST Engine (ast stdlib)     |
|    TypeScript AST Parser | CrossRepoMatcher | ContractDiffEngine            |
+--------------------------------------┬--------------------------------------+
                                       | Static Code Inspection
                                       v
+-----------------------------------------------------------------------------+
|                     ENTERPRISE MICROSERVICES AND GITHUB CI                  |
|    GitHub REST API v3 | GitHub OAuth 2.0 | GitHub Actions PR Gate (cli.py)  |
+-----------------------------------------------------------------------------+
```

---

## Key Features

### 1. Interactive Live Voice Assistant
- Powered by Gemini 2.5 Flash Native Audio as the primary live voice model, Gemini 3 Flash Live as fallback, and Gemini 3.5 Flash Lite for text-based advisory.
- Voice-Synchronized Parallel Subtitles: Listens to native browser speech synthesis word boundary events to render spoken text in parallel with the avatar voice.
- Soundwave-Reactive Hologram Avatar: Cybernetic outer ring oscillates and scales dynamically in response to microphone soundwaves and speaker frequency.
- Collapsible Telemetry Log: On-demand drawer displays complete timestamped Q&A records and active AST contract diff telemetry.

### 2. Static AST Boundary Retrieval-Augmented Generation (RAG)
- Extracts live AST dependency graph edges, active pull request metadata, and schema field diffs across connected microservices.
- Injects real-time code changes into Gemini system instructions dynamically with zero hardcoding.
- Grounded contextual answers for breaking route removals, parameter changes, and payload field renames.

### 3. Dual Persona Modes (Guardian vs Enforcer)
- Advisory Mode (Guardian): Constructive migration guidance, deprecation schedules, and backward-compatible alias suggestions.
- Enforcement Mode (Enforcer): Zero-tolerance gatekeeper mode prioritizing hard merge blockers, blast radius containment, and merge prevention.

### 4. Automatic Side-by-Side AST Schema Diff Viewer
- Monaco Editor side-by-side diffing between baseline production schemas (main branch) and proposed pull requests.
- Multi-format contract view toggles: OpenAPI / JSON Schema IR, TypeScript Interfaces, and Python source code.
- Interactive drift tabs allowing instant navigation to affected routes and fields.
- Automatic PR lifecycle reconciliation: Displays clean in-sync state (0 diffs) when pull requests are closed or merged.

### 5. Cross-Repository Static AST Parsing
- Parses Python (FastAPI / Flask) and TypeScript/JavaScript (Express / Fetch / Axios) without executing runtime code.
- Detects route path mutations, missing response fields, and schema type mismatches across microservice boundaries.

### 6. Automated PR Governance Gate
- Runs in GitHub Actions CI, posts automated sticky review comments on pull requests, and blocks merges on breaking contract drifts.
- 1-click GitHub workflow injection directly into connected repositories.

### 7. Unified Environment Configuration
- Consolidated single root environment configuration file with a clean template for contributors.

---

## Repository Directory Structure

```text
.
|-- engine/                        # Python AST Backend Engine and CLI Core
|   `-- repotrace/
|       |-- server.py              # REST API Engine Server (Port 4400)
|       |-- cli.py                 # RepoTrace Terminal CLI and PR Gate (pr-check)
|       |-- ir.py                  # ServiceContract and ConsumerCall Schemas
|       |-- matcher.py             # CrossRepoMatcher Static Topology Matcher
|       |-- diff_engine.py         # ContractDiffEngine Schema Drift Detector
|       `-- parsers/
|           |-- python_ast.py      # Python (FastAPI / Flask) AST Extractor
|           `-- ts_ast.py          # TypeScript (Express / Fetch / Axios) Extractor
|
|-- web/                           # Next.js 16 + React Flow Observability Console
|   |-- src/
|   |   |-- app/                   # Next.js App Router and RAG Voice API Route
|   |   |-- components/            # Voice Avatar, React Flow Canvas, Monaco Diff Viewer
|   |   |-- hooks/                 # Gemini Live WebSocket and Web Audio Hooks
|   |   `-- lib/                   # API REST Connector and Domain Interfaces
|   `-- next.config.ts             # Next.js Configuration with Root .env Auto-Loader
|
|-- samples/                       # Ready-to-Deploy Microservice Samples
|   |-- checkout-frontend/         # React/TypeScript Consumer Frontend
|   |-- user-service-v1/           # Python/FastAPI Producer (Baseline Version)
|   |-- user-service-v2/           # Python/FastAPI Producer (PR Breaking Drift Version)
|   |-- payment-gateway-service/   # Python/Flask Payment Microservice
|   |-- order-service/             # Express/JS Order Fulfillment Microservice
|   `-- notification-service/      # Node/TypeScript Worker Microservice
|
|-- .env                           # Unified Root Environment Configuration
`-- .env.example                   # Environment Template Example
```

---

## Colleague Microservice Assignment Table

Assign one sample directory from samples/ to each contributor:

| Contributor | Assigned Microservice | Source Path | Main File | Language | Analysis Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Contributor 1 | checkout-frontend | samples/checkout-frontend/ | src/UserProfile.tsx | TypeScript (React) | Consumer: Calls user-service API |
| Contributor 2 | user-service (Main) | samples/user-service-v1/ | main.py | Python (FastAPI) | Producer: Baseline server returning email |
| Contributor 2 (PR) | user-service (PR) | samples/user-service-v2/ | main.py | Python (FastAPI) | PR Test: Mutates path and renames email |
| Contributor 3 | payment-gateway-service | samples/payment-gateway-service/ | main.py | Python (Flask) | Mid-Tier: Payment processing service |
| Contributor 4 | order-service | samples/order-service/ | main.py | Express (JavaScript) | Producer/Consumer: Order fulfillment |
| Contributor 5 | notification-service | samples/notification-service/ | src/mailer.ts | Node.js (TypeScript) | Consumer: Push and email worker |

---

## Quick Start Guide

### Prerequisites
- Node.js v18.17+ or v20+ LTS
- Python 3.8+ (Recommended 3.10+)
- Git 2.40+
- Google Gemini API Key (from Google AI Studio)

### Step 1: Configure Environment Variables
Copy the template file to create your root configuration:
```bash
cp .env.example .env
```
Add your Gemini API Key and GitHub OAuth credentials in .env.

### Step 2: Install Frontend Dependencies
```bash
cd web
npm install
cd ..
```

### Step 3: Launch Full-Stack Application

On Windows:
```cmd
start_repotrace.bat
```
or with npm:
```bash
npm run dev
```

On macOS / Linux:
```bash
chmod +x start_repotrace.sh
./start_repotrace.sh
```

Open http://localhost:3000 in your browser.

---

## Testing the PR Governance Gate

1. Open http://localhost:3000 and select Analyze Microservices.
2. Select your microservices and enable the PR gate.
3. When a developer modifies an API endpoint in a pull request, execute:
   ```bash
   python engine/repotrace/cli.py pr-check --head ./ --out-md pr_comment.md
   ```
4. RepoTrace generates a markdown report detailing breaking lines and exits with code 1 to block unsafe merges.

---

## License

Distributed under the MIT License. See LICENSE for details.
