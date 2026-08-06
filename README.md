# 🌐 RepoTrace AI — Cross-Repository API Observability & PR Governance

> **Passive Cross-Repository API Boundary Observability & Schema Drift PR Governance Platform**

[![Next.js](https://img.shields.io/badge/Next.js-16_Turbopack-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue?style=for-the-badge&logo=python)](https://www.python.org/)
[![React Flow](https://img.shields.io/badge/React_Flow-v12-cyan?style=for-the-badge)](https://reactflow.dev/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-Diff_Engine-emerald?style=for-the-badge)](https://microsoft.github.io/monaco-editor/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

---

## ⚡ What is RepoTrace AI?

**RepoTrace AI** is an enterprise-grade static analysis and boundary observability platform. It statically inspects microservices across disconnected Git repositories, maps producer-consumer API contracts without running code, and automatically prevents breaking schema drifts in Pull Requests via CI/CD gates.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REPOTRACE AI WEB CONSOLE                              │
│   Next.js 16 (Turbopack) • React 19 • TypeScript • Tailwind CSS v4          │
│   React Flow Graph Canvas • Monaco AST Diff Editor • Ultra-Brutalism Theme   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API (JSON)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REPOTRACE PYTHON AST ENGINE                           │
│   Python 3.11 REST Server (Port 4400) • Python AST Engine (ast stdlib)       │
│   TypeScript AST Parser • CrossRepoMatcher • ContractDiffEngine             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Static Code Inspection
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE MICROSERVICES & GITHUB CI                     │
│   GitHub REST API v3 • GitHub OAuth 2.0 • GitHub Actions PR Gate (cli.py)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔥 Key Features

- 🗺️ **Interactive 3-Tier Visual Topology Map**: Drag, pan, and zoom microservice nodes with animated dependency edges using **React Flow (`@xyflow/react`)**.
- 🔍 **Cross-Repository Static AST Parser**: Parses Python (FastAPI/Flask) & TypeScript/JavaScript (Express/Fetch/Axios) without executing code.
- 🔴 **Pulsing Red Linkage Edges (`[BREAKING]`)**: Visually flags route mutations, missing response fields, and schema type mismatches on the topology graph.
- 📝 **Monaco AST Diff Schema Viewer**: Embedded VS Code diff editor displaying inline red/green schema drift markers side-by-side.
- ⚡ **1-Click GitHub Workflow Injection**: Injects `.github/workflows/repotrace-ci.yml` directly into GitHub repositories in 1 click via GitHub REST API v3.
- 🛡️ **Automated PR Governance Gate (`repotrace pr-check`)**: Runs in GitHub Actions, posts automated sticky review comments, and blocks PR merges (`exit 1`) on breaking contract drifts.

---

## 📁 Repository Directory Structure

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
│   │   ├── 📂 app/                   # Next.js App Router & GitHub OAuth Callback
│   │   ├── 📂 components/            # React Flow Canvas, Monaco Diff, Governance Panel
│   │   └── 📂 lib/                   # API REST Connector & Domain Interfaces
│   └── .env.local                    # Frontend Environment Variables
│
├── 📂 samples/                       # 6 Ready-to-Deploy Microservice Samples
│   ├── 📂 checkout-frontend/         # React/TypeScript Consumer Frontend
│   ├── 📂 user-service-v1/           # Python/FastAPI Producer (Baseline Version)
│   ├── 📂 user-service-v2/           # Python/FastAPI Producer (PR Breaking Drift Version)
│   ├── 📂 payment-gateway-service/   # Python/Flask Payment Microservice
│   ├── 📂 order-service/             # Express/JS Order Fulfillment Microservice
│   └── 📂 notification-service/      # Node/TypeScript Worker Microservice
│
└── .env                              # Master Environment Config (GitHub Client ID/Secret)
```

---

## 👥 Colleague Microservice Assignment Table

Assign **1 sample directory** from `samples/` to each colleague to push as a standalone GitHub repository:

| Colleague | Assigned Microservice | Source Folder Path | Main File to Push | Language | Role in Analysis |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Colleague 1** | **`checkout-frontend`** | `samples/checkout-frontend/` | `src/UserProfile.tsx` | TS (React) | **Consumer**: Calls `user-service` API. |
| **Colleague 2** | **`user-service`** *(Main Branch)* | `samples/user-service-v1/` | `main.py` | Python (FastAPI) | **Producer**: Baseline server returning `email`. |
| **Colleague 2 (PR)**| **`user-service`** *(PR Branch)* | `samples/user-service-v2/` | `main.py` | Python (FastAPI) | **PR Test**: Mutates route path & renames `email` -> `user_email`. |
| **Colleague 3** | **`payment-gateway-service`** | `samples/payment-gateway-service/` | `main.py` | Python (Flask) | **Mid-Tier**: Payment processing service. |
| **Colleague 4** | **`order-service`** | `samples/order-service/` | `main.py` | Express (JS) | **Producer/Consumer**: Order fulfillment worker. |
| **Colleague 5** | **`notification-service`** | `samples/notification-service/` | `src/mailer.ts` | Node.js (TS) | **Consumer**: Push & email worker. |

---

## 🚀 Quick Start Guide

### 1. Launch the Backend Engine Server (Port 4400)
```bash
cd engine
python repotrace/server.py
```

### 2. Launch the Web Console UI (Port 3000)
```bash
cd web
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your web browser.

---

## 🛡️ Testing the PR Governance Gate

1. Open [http://localhost:3000](http://localhost:3000) ➔ click **"Analyze Microservices"**.
2. Select your microservices and click **`⚡ 1-CLICK ENABLE PR GATE`**.
3. When a developer modifies an API endpoint in a Pull Request, GitHub Actions automatically executes:
   ```bash
   python engine/repotrace/cli.py pr-check --head ./ --out-md pr_comment.md
   ```
4. RepoTrace posts an automated review comment on GitHub detailing line numbers (`main.py:L18`) and **blocks the PR merge (`exit 1`)** if breaking changes exist! 🛑

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
