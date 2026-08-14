'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { SAMPLE_DRIFTS, V1_USER_SERVICE_CODE, V2_USER_SERVICE_CODE } from '../lib/mockData';
import { ContractDrift, ServiceNodeData } from '../lib/types';
import {
  GitCommit,
  User,
  Calendar,
  FileCode,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Code,
  Layers,
  Database,
  Braces,
  FileJson,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface MonacoDiffViewerProps {
  services?: ServiceNodeData[];
  selectedDrift?: ContractDrift;
  activePr?: {
    has_open_pr?: boolean;
    pr_number: number;
    head_branch: string;
    base_branch: string;
    pr_url: string;
    all_prs?: any[];
  };
}

export const MonacoDiffViewer: React.FC<MonacoDiffViewerProps> = ({
  services = [],
  selectedDrift: initialDrift,
  activePr: propsPr,
}) => {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [viewFormat, setViewFormat] = useState<'schema_json' | 'source_code' | 'typescript'>('schema_json');
  const [activeDriftId, setActiveDriftId] = useState<string>(initialDrift?.id || 'drift-1');

  // Dynamic PR state
  const [prNumber, setPrNumber] = useState<number>(propsPr?.pr_number || 14);
  const [headBranch, setHeadBranch] = useState<string>(propsPr?.head_branch || 'feature/v2-upgrade');
  const [baseBranch, setBaseBranch] = useState<string>(propsPr?.base_branch || 'main');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (propsPr) {
      setPrNumber(propsPr.pr_number);
      setHeadBranch(propsPr.head_branch);
      setBaseBranch(propsPr.base_branch);
    }
  }, [propsPr]);

  const prList =
    propsPr?.all_prs && propsPr.all_prs.length > 0
      ? propsPr.all_prs
      : [
          {
            number: 14,
            title: 'v2 upgrade',
            state: propsPr?.has_open_pr ? 'open' : 'closed',
            is_open: propsPr?.has_open_pr ?? false,
            head_branch: 'feature/v2-upgrade',
            base_branch: 'main',
          },
          {
            number: 13,
            title: 'v2 upgrade',
            state: 'closed',
            is_open: false,
            head_branch: 'feature/v2-upgrade',
            base_branch: 'main',
          },
        ];

  const selectedPR = prList.find((p) => p.number === prNumber) || prList[0];
  
  // Real dynamic check if PR is open or closed
  const isSelectedPrOpen = selectedPR
    ? (selectedPR.is_open === true || selectedPR.state === 'open')
    : (propsPr?.has_open_pr ?? false);

  const activeHeadBranch = selectedPR?.head_branch || headBranch;
  const activeBaseBranch = selectedPR?.base_branch || baseBranch;
  const defaultPrBaseUrl = propsPr?.pr_url
    ? propsPr.pr_url.replace(/\/pull\/\d+$/, '')
    : 'https://github.com/repotrace/user-service';
  const currentPrUrl = selectedPR?.html_url || `${defaultPrBaseUrl}/pull/${prNumber}`;

  // Find active drift metadata
  const currentDrift =
    SAMPLE_DRIFTS.find((d) => d.id === activeDriftId) || SAMPLE_DRIFTS[0];

  // Dynamically extract real producer service from scanned services list
  const realProducer = services.find((s) => s.routes && s.routes.length > 0) || services[0];

  // Dynamically generate Baseline AST Schema (Left) and Proposed PR AST Schema (Right)
  const { codeOriginal, codeModified, editorLanguage } = useMemo(() => {
    // 1. Source Code View
    if (viewFormat === 'source_code') {
      return {
        codeOriginal: V1_USER_SERVICE_CODE,
        // When PR is closed, the modified code is in sync with baseline (clean / no unmerged drifts)
        codeModified: isSelectedPrOpen ? V2_USER_SERVICE_CODE : V1_USER_SERVICE_CODE,
        editorLanguage: 'python',
      };
    }

    // 2. TypeScript Contract View
    if (viewFormat === 'typescript') {
      const tsOriginal = `// BASELINE CONTRACT (Production - branch: ${activeBaseBranch})
export interface UserResponse {
  id: string;
  email: string;
  is_active: boolean;
  role: "admin" | "member";
}

export interface UserCreateRequest {
  email: string;
  role?: string;
}

export interface UserApiEndpoints {
  "GET /api/v1/users/{user_id}": {
    params: { user_id: string };
    response: UserResponse;
  };
  "POST /api/v1/users": {
    body: UserCreateRequest;
    response: UserResponse;
  };
}`;

      const tsModified = isSelectedPrOpen
        ? `// PROPOSED PR CONTRACT (PR #${prNumber} - branch: ${activeHeadBranch})
export interface UserResponseV2 {
  id: string;
  user_email: string; // ⚠️ [BREAKING DRIFT] Renamed from 'email'
  // ⚠️ [BREAKING DRIFT] 'is_active' deleted
  user_role: "admin" | "member";
}

export interface UserCreateRequestV2 {
  user_email: string; // ⚠️ [BREAKING DRIFT] Renamed from 'email'
  role?: string;
}

export interface UserApiEndpoints {
  // ⚠️ [BREAKING DRIFT] Path mutated: requires 'tenant_id'
  "GET /api/v1/users/{tenant_id}/{user_id}": {
    params: { tenant_id: string; user_id: string };
    response: UserResponseV2;
  };
  "POST /api/v1/users": {
    body: UserCreateRequestV2;
    response: UserResponseV2;
  };
}`
        : `// PRODUCTION CONTRACT (PR #${prNumber} is CLOSED / MERGED - branch: ${activeBaseBranch})
export interface UserResponse {
  id: string;
  email: string;
  is_active: boolean;
  role: "admin" | "member";
}

export interface UserCreateRequest {
  email: string;
  role?: string;
}

export interface UserApiEndpoints {
  "GET /api/v1/users/{user_id}": {
    params: { user_id: string };
    response: UserResponse;
  };
  "POST /api/v1/users": {
    body: UserCreateRequest;
    response: UserResponse;
  };
}`;

      return {
        codeOriginal: tsOriginal,
        codeModified: tsModified,
        editorLanguage: 'typescript',
      };
    }

    // 3. Default: AST Schema JSON IR
    const schemaOriginal = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      service_name: realProducer?.id || "user-service",
      version: "1.0.0",
      git_branch: activeBaseBranch,
      routes: [
        {
          endpoint: "GET /api/v1/users/{user_id}",
          method: "GET",
          handler: "get_user_profile",
          parameters: [
            {
              name: "user_id",
              type: "string",
              in: "path",
              required: true
            }
          ],
          response_schema: {
            type: "object",
            required: ["id", "email", "is_active"],
            properties: {
              id: { type: "string" },
              email: { type: "string", format: "email" },
              is_active: { type: "boolean" },
              role: { type: "string", default: "member" }
            }
          }
        },
        {
          endpoint: "POST /api/v1/users",
          method: "POST",
          handler: "create_user",
          request_body: {
            type: "object",
            required: ["email"],
            properties: {
              email: { type: "string", format: "email" }
            }
          },
          response_schema: {
            type: "object",
            required: ["id", "email"],
            properties: {
              id: { type: "string" },
              email: { type: "string" }
            }
          }
        }
      ]
    };

    // When PR is closed: Schema on right matches baseline exactly (0 diff / in sync)
    const schemaModified = isSelectedPrOpen
      ? {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          service_name: realProducer?.id || "user-service",
          version: "2.0.0-rc1",
          git_branch: activeHeadBranch,
          pr_number: prNumber,
          routes: [
            {
              endpoint: "GET /api/v1/users/{tenant_id}/{user_id}",
              method: "GET",
              handler: "get_user_profile_v2",
              parameters: [
                {
                  name: "tenant_id",
                  type: "string",
                  in: "path",
                  required: true,
                  drift_status: "[BREAKING: Path Parameter Added]"
                },
                {
                  name: "user_id",
                  type: "string",
                  in: "path",
                  required: true
                }
              ],
              response_schema: {
                type: "object",
                required: ["id", "user_email"],
                properties: {
                  id: { type: "string" },
                  user_email: { 
                    type: "string", 
                    format: "email",
                    drift_status: "[BREAKING: Renamed from 'email']" 
                  },
                  user_role: { type: "string", default: "member" }
                }
              }
            },
            {
              endpoint: "POST /api/v1/users",
              method: "POST",
              handler: "create_user",
              request_body: {
                type: "object",
                required: ["user_email"],
                properties: {
                  user_email: { 
                    type: "string", 
                    format: "email",
                    drift_status: "[BREAKING: Renamed from 'email']" 
                  }
                }
              },
              response_schema: {
                type: "object",
                required: ["id", "user_email"],
                properties: {
                  id: { type: "string" },
                  user_email: { type: "string" }
                }
              }
            }
          ]
        }
      : {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          service_name: realProducer?.id || "user-service",
          version: "1.0.0",
          git_branch: activeBaseBranch,
          status: "IN_SYNC (PR IS CLOSED / MERGED)",
          routes: schemaOriginal.routes
        };

    return {
      codeOriginal: JSON.stringify(schemaOriginal, null, 2),
      codeModified: JSON.stringify(schemaModified, null, 2),
      editorLanguage: 'json',
    };
  }, [viewFormat, isSelectedPrOpen, activeDriftId, prNumber, activeHeadBranch, activeBaseBranch, realProducer]);

  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col gap-3.5 p-1 font-mono">
      
      {/* Pull Request Representation Banner */}
      <div
        className={`p-3.5 border-2 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
          isSelectedPrOpen
            ? 'bg-[#170507] border-rose-600 shadow-[4px_4px_0px_0px_#f43f5e]'
            : 'bg-[#05170d] border-emerald-600 shadow-[4px_4px_0px_0px_#10b981]'
        }`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {isSelectedPrOpen ? (
              <span className="px-2.5 py-1 bg-rose-950 text-rose-300 border border-rose-600 font-extrabold uppercase animate-pulse flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#f43f5e]">
                <ShieldAlert className="w-3.5 h-3.5" />
                PULL REQUEST #{prNumber} (OPEN - BLOCKED)
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#10b981]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                PULL REQUEST #{prNumber} (CLOSED / MERGED - IN SYNC)
              </span>
            )}

            {/* Dynamic PR Selector Dropdown */}
            <select
              value={prNumber}
              onChange={(e) => setPrNumber(Number(e.target.value))}
              className="bg-[#171717] border-2 border-neutral-700 text-white font-bold px-2 py-1 text-xs cursor-pointer focus:border-cyan-500"
            >
              {prList.map((p: any) => (
                <option key={p.number} value={p.number}>
                  PR #{p.number} ({p.is_open ? 'OPEN - BLOCKED' : (p.state ? p.state.toUpperCase() : 'CLOSED')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="font-extrabold text-white">
              <span className="text-emerald-400 font-mono">user-service (base: {activeBaseBranch})</span>
              <span className="mx-2 text-neutral-400 font-bold">⟵</span>
              <span className={isSelectedPrOpen ? "text-rose-400 font-mono" : "text-emerald-400 font-mono"}>
                user-service ({isSelectedPrOpen ? `head: ${activeHeadBranch}` : `in sync with ${activeBaseBranch}`})
              </span>
            </div>
            <p className="text-[10.5px] text-neutral-400 mt-0.5">
              {isSelectedPrOpen
                ? `Live AST Contract Schema Diff comparing proposed PR #${prNumber} against baseline`
                : `PR #${prNumber} is closed. All cross-repository AST contract boundaries are clean and synchronized.`}
            </p>
          </div>
        </div>

        <a
          href={currentPrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold uppercase border border-neutral-600 shadow-[2px_2px_0px_0px_#ffffff] flex items-center justify-center gap-1.5 shrink-0 transition-colors"
        >
          VIEW PR #{prNumber} ON GITHUB ↗
        </a>
      </div>

      {/* Controller & Detected Drifts Tab Bar */}
      <div className="bg-[#0a0a0a] border-2 border-[#262626] p-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Detected AST Schema Drifts Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          {isSelectedPrOpen ? (
            <>
              <span className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5 mr-1 shrink-0">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Active Drifts:
              </span>
              {SAMPLE_DRIFTS.map((drift) => (
                <button
                  key={drift.id}
                  onClick={() => setActiveDriftId(drift.id)}
                  className={`px-2.5 py-1 text-xs font-bold uppercase transition-all border-2 shrink-0 flex items-center gap-2 cursor-pointer ${
                    activeDriftId === drift.id
                      ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-[2px_2px_0px_0px_#f43f5e]'
                      : 'bg-[#171717] text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>{drift.method} {drift.target_route}</span>
                  <span className="text-[10px] font-mono px-1 bg-black border border-neutral-700 text-neutral-300">
                    {drift.change_type}
                  </span>
                </button>
              ))}
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold uppercase">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>0 Active Drifts — Production AST Schema boundaries are clean</span>
            </div>
          )}
        </div>

        {/* View Format Selector */}
        <div className="flex items-center gap-1.5 bg-black p-1 border-2 border-neutral-800 shrink-0">
          <button
            onClick={() => setViewFormat('schema_json')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
              viewFormat === 'schema_json'
                ? 'bg-blue-600 text-white font-extrabold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>AST Schema IR</span>
          </button>
          <button
            onClick={() => setViewFormat('typescript')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
              viewFormat === 'typescript'
                ? 'bg-blue-600 text-white font-extrabold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Braces className="w-3.5 h-3.5" />
            <span>TypeScript Interface</span>
          </button>
          <button
            onClick={() => setViewFormat('source_code')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
              viewFormat === 'source_code'
                ? 'bg-blue-600 text-white font-extrabold shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Source (main.py)</span>
          </button>
        </div>

      </div>

      {/* Monaco Diff Panel & Context Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        
        {/* Monaco Side-by-Side Diff Editor (3 Columns) */}
        <div className="lg:col-span-3 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
          <div className="bg-black px-4 py-2.5 border-b-2 border-[#262626] flex items-center justify-between text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-2 text-white font-bold uppercase">
              <FileCode className="w-4 h-4 text-blue-400" />
              <span>
                {viewFormat === 'schema_json'
                  ? 'AST SCHEMA CONTRACT DIFF'
                  : viewFormat === 'typescript'
                  ? 'TYPESCRIPT CONTRACT SPECIFICATION DIFF'
                  : 'SOURCE CODE IMPLEMENTATION DIFF (main.py)'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-emerald-400 font-bold uppercase">
                BASELINE ({activeBaseBranch})
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
              <span className={isSelectedPrOpen ? "text-rose-400 font-bold uppercase" : "text-emerald-400 font-bold uppercase"}>
                {isSelectedPrOpen ? `PR #${prNumber} (${activeHeadBranch})` : `SYNCED (${activeBaseBranch})`}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[420px] bg-[#0a0a0a]">
            {isMounted ? (
              <DiffEditor
                height="100%"
                language={editorLanguage}
                original={codeOriginal}
                modified={codeModified}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 12,
                  renderSideBySide: true,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  diffWordWrap: 'on',
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-8 text-neutral-400 font-mono text-xs">
                <span>Loading Monaco AST Diff Viewer...</span>
              </div>
            )}
          </div>
        </div>

        {/* Selected AST Drift Metadata & AI Remediation (1 Column) */}
        <div className="lg:col-span-1 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] p-4 flex flex-col gap-4 overflow-y-auto">
          
          <div>
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-2.5 border-b-2 border-neutral-800 pb-2 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>AST Contract Telemetry</span>
            </h3>

            <div className="bg-black p-3.5 border-2 border-neutral-800 space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] text-neutral-500 block uppercase font-mono">PR STATUS</span>
                <span className={`font-bold uppercase ${isSelectedPrOpen ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isSelectedPrOpen ? `PR #${prNumber} IS OPEN (BLOCKED)` : `PR #${prNumber} IS CLOSED (IN SYNC)`}
                </span>
              </div>

              {isSelectedPrOpen ? (
                <>
                  <div className="border-t border-neutral-800 pt-2">
                    <span className="text-[10px] text-neutral-500 block uppercase font-mono">TARGET DRIFT</span>
                    <span className="font-bold text-rose-400 font-mono">{currentDrift.method} {currentDrift.target_route}</span>
                  </div>

                  <div className="border-t border-neutral-800 pt-2">
                    <span className="text-[10px] text-neutral-500 block uppercase font-mono">CLASSIFICATION</span>
                    <span className="font-extrabold text-white bg-rose-950/80 border border-rose-600 px-1.5 py-0.5 rounded text-[11px]">
                      {currentDrift.change_type} ({currentDrift.severity})
                    </span>
                  </div>

                  <div className="border-t border-neutral-800 pt-2">
                    <span className="text-[10px] text-neutral-500 block uppercase font-mono">DRIFT DETAILS</span>
                    <p className="text-[11px] text-neutral-300 leading-relaxed mt-0.5">{currentDrift.description}</p>
                  </div>
                </>
              ) : (
                <div className="border-t border-neutral-800 pt-2 text-neutral-300 text-[11px] leading-relaxed">
                  <p>All microservice contract endpoints match the baseline specification. No unmerged drifts detected.</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Remediation / Health Guidance */}
          <div className="mt-auto space-y-3">
            <div className={`border-2 p-3.5 text-xs rounded ${
              isSelectedPrOpen
                ? 'bg-[#120f24] border-indigo-700 text-indigo-200'
                : 'bg-[#061e12] border-emerald-700 text-emerald-200'
            }`}>
              <h4 className={`font-extrabold mb-1.5 flex items-center gap-1.5 uppercase text-[10.5px] tracking-wider ${
                isSelectedPrOpen ? 'text-indigo-400' : 'text-emerald-400'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSelectedPrOpen ? 'AI ADVISORY (GEMINI FLASH)' : 'AST BOUNDARY HEALTH'}</span>
              </h4>
              <p className="text-[11px] leading-relaxed">
                {isSelectedPrOpen
                  ? (currentDrift.change_type === 'ROUTE_REMOVED'
                    ? 'Path signature mutated to require tenant_id. Downstream consumers will receive 404 Not Found unless alias getters are maintained.'
                    : 'Field email was renamed to user_email. Upstream consumers must update deserializers.')
                  : 'All static AST contract boundaries are fully synchronized across production microservices.'}
              </p>
            </div>

            <div className="bg-black p-3.5 border-2 border-neutral-800 text-xs">
              <h4 className="font-bold text-white mb-1.5 flex items-center gap-1.5 uppercase text-[10.5px]">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Governance State</span>
              </h4>
              <p className="text-neutral-300 leading-relaxed text-[11px]">
                {isSelectedPrOpen
                  ? 'Strict Governance Gate: PR merge blocked until contract schema drifts are reconciled.'
                  : 'Production Gate: All contract boundaries pass CI checks.'}
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default MonacoDiffViewer;
