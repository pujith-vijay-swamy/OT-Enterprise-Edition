<div align="center">

# 🌐 RepoTrace AI Enterprise
### Cross-Repository Static AST Boundary Observability & Voice-Guided PR Governance

[![Next.js](https://img.shields.io/badge/Next.js-16_Turbopack-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Gemini Live](https://img.shields.io/badge/Gemini_Flash-Live_Voice_API-8E75C2?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![React Flow](https://img.shields.io/badge/React_Flow-v12-FF0072?style=for-the-badge)](https://reactflow.dev/)
[![Monaco Diff](https://img.shields.io/badge/Monaco_Editor-Diff_Engine-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br/>

**RepoTrace AI** is an enterprise-grade static analysis, microservice boundary observability, and AI-assisted PR governance platform. It statically inspects microservices across disconnected Git repositories, maps producer-consumer API contracts without executing runtime code, and blocks breaking schema drifts before they reach production.

<br/>

[Explore Features](#-key-capabilities) • [Architecture](#-system-architecture) • [Quick Start](#-quick-start) • [PR Governance Gate](#-automated-pr-governance-gate) • [Live Voice Assistant](#-live-voice-avatar-assistant)

</div>

---

## ⚡ System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REPOTRACE AI WEB CONSOLE                              │
│   Next.js 16 (Turbopack) • React 19 • TypeScript • Tailwind CSS v4          │
│   React Flow Graph Canvas • Monaco AST Diff Editor • Ultra-Brutalism Theme   │
│   Soundwave-Reactive Hologram Voice Avatar • Subtitle Lockstep Sync         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API & WebSocket
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REPOTRACE STATIC AST & RAG ENGINE                        │
│   Python 3.11 REST Server (Port 4400) • Python AST Engine (ast stdlib)       │
│   TypeScript AST Parser • CrossRepoMatcher • ContractDiffEngine             │
│   Gemini 2.5 Flash Native Audio • Gemini 3 Flash Live • 3.5 Flash Lite RAG  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Static Code Inspection
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE MICROSERVICES & GITHUB CI                     │
│   GitHub REST API v3 • GitHub OAuth 2.0 • GitHub Actions PR Gate (cli.py)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Capabilities

### 🎙️ 1. Interactive Live Voice Assistant
* **Gemini Flash Audio Core**: Powered by **Gemini 2.5 Flash Native Audio** with high-availability fallbacks (**Gemini 3 Flash Live** & **Gemini 3.5 Flash Lite**).
* **Parallel Word-by-Word Subtitles**: Uses native browser `SpeechSynthesisUtterance.onboundary` events to stream spoken words in lockstep with the voice output.
* **Soundwave-Reactive Hologram Avatar**: Cybernetic outer ring oscillates, vibrates, and scales dynamically in response to microphone soundwaves and speaker frequency.
* **Collapsible Telemetry Drawer**: Instant slide-up drawer displaying complete timestamped Q&A conversation logs and active AST telemetry.

### 🧠 2. Static AST Boundary Retrieval-Augmented Generation (RAG)
* **100% Dynamic RAG Pipeline**: Statically parses live AST dependency graph edges, active pull request metadata, and schema field diffs across connected microservices with zero hardcoded fixtures.
* **Grounded Context Injection**: Real-time code changes, endpoint mutations, and field renames are dynamically formatted and injected into Gemini system instructions.

### 🎭 3. Dual Persona Modes

| Persona Mode | Tone & Strategy | Behavior & Voice Response |
| :--- | :--- | :--- |
| **🛡️ Guardian (Advisory)** | Constructive, educational, and collaborative. | Guides the developer on how to migrate smoothly: recommends backward-compatible alias getters (e.g. `user_email -> email`), deprecation schedules, and TypeScript interface updates. |
| **🚨 Enforcer (Gatekeeper)** | Assertive, authoritative, zero-tolerance. | Acts as a strict merge blocker: warns that the PR will break downstream consumer microservices, details line-level breaking mutations, and explains why CI merge is blocked. |

### 📝 4. Automatic Monaco Side-by-Side AST Diff Viewer
* **Automated Side-by-Side Diffing**: Compares production baseline (`main` branch) against proposed pull requests.
* **Multi-Format Contract Representations**:
  * **`[📋 AST Schema IR]`**: Formal OpenAPI / JSON Schema with exact property and requirement definitions.
  * **`[⚡ TypeScript Interface]`**: Strongly-typed TypeScript consumer interface diffs (`UserResponse` vs `UserResponseV2`).
  * **`[📝 Source (main.py)]`**: Underlying FastAPI / Pydantic Python source code diff with inline breaking comments.
* **Real-Time PR Lifecycle Synchronization**: Automatically reconciles and displays clean in-sync state (**0 drifts**) when a PR is closed or merged on GitHub.

### 🗺️ 5. Interactive 3-Tier Visual Topology Map
* **React Flow Mesh**: Pan, drag, zoom, and inspect microservice dependencies across producer and consumer services.
* **Pulsing Breaking Linkage Edges**: Visually highlights breaking route mutations, missing response fields, and schema type mismatches.
* **Blast Radius Analysis**: One-click blast radius toggle to instantly identify all downstream consumers impacted by upstream API changes.

### 🛡️ 6. Automated PR Governance Gate (`repotrace pr-check`)
* **GitHub Actions CI/CD Gate**: Runs directly in CI workflows, generates markdown diff reports, and **blocks PR merges (`exit 1`)** if breaking contract drifts are detected.
* **1-Click Workflow Injection**: Injects `.github/workflows/repotrace-ci.yml` directly into connected GitHub repositories via GitHub REST API v3.

---

## 📁 Repository Structure

```text
.
├── 📂 engine/                        # Python AST Backend Engine & CLI Core
│   └── 📂 repotrace/
│       ├── server.py                 # REST API Engine Server (Port 4400)
│       ├── cli.py                    # RepoTrace Terminal CLI & PR Gate (`pr-check`)
│       ├── ir.py                     # ServiceContract & ConsumerCall Schemas
│       ├── matcher.py                # CrossRepoMatcher Static Topology Matcher
│       ├── diff_engine.py            # ContractDiffEngine Schema Drift Detector
│       └── 📂 parsers/
│           ├── python_ast.py         # Python (FastAPI / Flask) AST Extractor
│           └── ts_ast.py             # TypeScript (Express / Fetch / Axios) Extractor
│
├── 📂 web/                           # Next.js 16 + React Flow Observability Console
│   ├── 📂 src/
│   │   ├── 📂 app/                   # Next.js App Router & RAG Voice API Route
│   │   ├── 📂 components/            # Voice Avatar, React Flow Canvas, Monaco Diff Viewer
│   │   ├── 📂 hooks/                 # Gemini Live WebSocket & Web Audio Hooks
│   │   └── 📂 lib/                   # API REST Connector & Domain Interfaces
│   └── next.config.ts                # Next.js Configuration with Root .env Auto-Loader
│
├── 📂 samples/                       # Ready-to-Deploy Microservice Samples
│   ├── 📂 checkout-frontend/         # React/TypeScript Consumer Frontend
│   ├── 📂 user-service-v1/           # Python/FastAPI Producer (Baseline Version)
│   ├── 📂 user-service-v2/           # Python/FastAPI Producer (PR Breaking Drift Version)
│   ├── 📂 payment-gateway-service/   # Python/Flask Payment Microservice
│   ├── 📂 order-service/             # Express/JS Order Fulfillment Microservice
│   └── 📂 notification-service/      # Node/TypeScript Worker Microservice
│
├── .env                              # Single Unified Root Environment Configuration
└── .env.example                      # Environment Template Example
```

---

## 🛠️ Quick Start Guide

### Prerequisites
* **Node.js**: `v18.17+` or `v20+ (LTS)`
* **Python**: `3.8+` (Recommended `3.10` / `3.11` / `3.12`)
* **Git**: `2.40+`
* **Google Gemini API Key**: Free tier available from [Google AI Studio](https://aistudio.google.com/app/apikey)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/pujith-vijay-swamy/OT-Enterprise-Edition.git
cd OT-Enterprise-Edition
```

### Step 2: Configure Environment Variables
Copy the template to create your single root `.env` configuration:
```bash
cp .env.example .env
```
Fill in your `GEMINI_API_KEY` and optional `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

### Step 3: Install Frontend Dependencies
```bash
cd web
npm install
cd ..
```

### Step 4: Run the Full-Stack Platform

* **On Windows**:
  ```cmd
  start_repotrace.bat
  ```
  *or via npm:*
  ```bash
  npm run dev
  ```

* **On macOS / Linux**:
  ```bash
  chmod +x start_repotrace.sh
  ./start_repotrace.sh
  ```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🛡️ Automated PR Governance Gate

To run the static AST contract gate locally or in your CI/CD pipeline:

```bash
# Analyze a PR branch against baseline and output a Markdown review comment
python engine/repotrace/cli.py pr-check --head ./ --out-md pr_comment.md
```

If breaking changes are detected:
* Details affected routes and line numbers (e.g. `main.py:L18`).
* Generates a GitHub-formatted sticky review comment (`pr_comment.md`).
* Returns exit code `1` to block the PR merge automatically.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
