'use client';

import React, { useState } from 'react';
import { GovernancePolicy, ServiceNodeData, ServiceEdgeData } from '../lib/types';
import { installGitHubWorkflow } from '../lib/api';
import { ShieldCheck, Sliders, Activity, GitPullRequest, CheckCircle2, XCircle, AlertTriangle, Layers, Check, Zap, RefreshCw, ExternalLink } from 'lucide-react';

interface GovernancePanelProps {
  services?: ServiceNodeData[];
  edges?: ServiceEdgeData[];
}

export const GovernancePanel: React.FC<GovernancePanelProps> = ({ services = [], edges = [] }) => {
  const [policy, setPolicy] = useState<GovernancePolicy>({
    production_gate: 'STRICT_BLOCK',
    staging_gate: 'WARN_ONLY',
    max_allowed_drifts: 0,
    grace_period_days: 14,
    require_pr_approval: true
  });

  const [installingServiceId, setInstallingServiceId] = useState<string | null>(null);
  const [installedMap, setInstalledMap] = useState<Map<string, string>>(new Map());

  const breakingEdges = edges.filter(e => e.status === 'BREAKING');
  const breakingCount = breakingEdges.length;

  const toggleProdGate = () => {
    setPolicy(p => ({
      ...p,
      production_gate: p.production_gate === 'STRICT_BLOCK' ? 'WARN_ONLY' : 'STRICT_BLOCK'
    }));
  };

  const toggleStagingGate = () => {
    setPolicy(p => ({
      ...p,
      staging_gate: p.staging_gate === 'STRICT_BLOCK' ? 'WARN_ONLY' : 'STRICT_BLOCK'
    }));
  };

  const handle1ClickInstall = async (service: ServiceNodeData) => {
    setInstallingServiceId(service.id);
    try {
      const repoName = service.repository.includes('/') ? service.repository : `enterprise-org/${service.id}`;
      const res = await installGitHubWorkflow(repoName);
      setInstalledMap(prev => {
        const copy = new Map(prev);
        copy.set(service.id, res.commit_url);
        return copy;
      });
    } catch (err: any) {
      console.error('Workflow install error:', err);
    } finally {
      setInstallingServiceId(null);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-140px)] overflow-y-auto space-y-6 p-1 font-mono">
      
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-[#0a0a0a] p-4 border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-400 block uppercase font-bold">ACTIVE MICROSERVICES</span>
            <div className="text-2xl font-extrabold text-white mt-1">{services.length} LOADED</div>
            <span className="text-[10px] text-emerald-400 font-bold">AST BOUNDARIES PARSED</span>
          </div>
          <div className="w-10 h-10 bg-blue-950 border-2 border-blue-600 flex items-center justify-center text-blue-400 font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-4 border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-400 block uppercase font-bold">DEPENDENCY LINKS</span>
            <div className="text-2xl font-extrabold text-white mt-1">{edges.length} LINKS</div>
            <span className="text-[10px] text-cyan-400 font-bold">CROSS-REPO MESH</span>
          </div>
          <div className="w-10 h-10 bg-cyan-950 border-2 border-cyan-600 flex items-center justify-center text-cyan-400 font-bold">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-4 border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-400 block uppercase font-bold">BREAKING DRIFTS</span>
            <div className="text-2xl font-extrabold text-rose-400 mt-1">{breakingCount} VIOLATIONS</div>
            <span className="text-[10px] text-rose-400 font-bold">PR GATE ENFORCEMENT</span>
          </div>
          <div className="w-10 h-10 bg-rose-950 border-2 border-rose-600 flex items-center justify-center text-rose-400 font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-4 border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-400 block uppercase font-bold">PRODUCTION GATE</span>
            <div className="text-2xl font-extrabold text-white mt-1">{policy.production_gate}</div>
            <span className="text-[10px] text-emerald-400 font-bold">AUTOMATED CI/CD BLOCK</span>
          </div>
          <div className="w-10 h-10 bg-emerald-950 border-2 border-emerald-600 flex items-center justify-center text-emerald-400 font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main Governance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Policy Controls Column */}
        <div className="lg:col-span-1 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] p-5 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b-2 border-[#262626]">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Automated Policy Enforcement Rules</h3>
          </div>

          <div className="space-y-4 text-xs font-mono">
            
            {/* Prod Gate Switch */}
            <div className="bg-black p-3.5 border-2 border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase">PRODUCTION PR GATE</span>
                <button
                  onClick={toggleProdGate}
                  className={`px-2.5 py-0.5 text-[10px] font-bold border uppercase cursor-pointer ${
                    policy.production_gate === 'STRICT_BLOCK'
                      ? 'bg-rose-950 text-rose-300 border-rose-600'
                      : 'bg-amber-950 text-amber-300 border-amber-600'
                  }`}
                >
                  {policy.production_gate}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Automatically triggers non-zero exit code (`exit 1`) in GitHub Actions when breaking contract drifts are introduced.
              </p>
            </div>

            {/* Staging Gate Switch */}
            <div className="bg-black p-3.5 border-2 border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase">STAGING PR GATE</span>
                <button
                  onClick={toggleStagingGate}
                  className={`px-2.5 py-0.5 text-[10px] font-bold border uppercase cursor-pointer ${
                    policy.staging_gate === 'STRICT_BLOCK'
                      ? 'bg-rose-950 text-rose-300 border-rose-600'
                      : 'bg-amber-950 text-amber-300 border-amber-600'
                  }`}
                >
                  {policy.staging_gate}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Posts inline warning sticky review comment on GitHub PRs without failing stage deployment build.
              </p>
            </div>

            {/* Contract Rules */}
            <div className="space-y-2 pt-2 border-t border-neutral-800 text-[11px]">
              <div className="flex items-center gap-2 text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Fail PR on removed response schema fields</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Reject mutated path parameters</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Require explicit route versioning</span>
              </div>
            </div>
          </div>
        </div>

        {/* Microservices Governance Matrix (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#262626]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Loaded Microservices Compliance Matrix</h3>
            </div>
            <span className="text-xs text-neutral-400 font-bold uppercase">{services.length} REPOSITORIES</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-black text-neutral-400 border-b-2 border-neutral-800 uppercase font-bold">
                <tr>
                  <th className="p-3">COMPLIANCE</th>
                  <th className="p-3">SERVICE NAME</th>
                  <th className="p-3">LANGUAGE</th>
                  <th className="p-3">ROUTES</th>
                  <th className="p-3">1-CLICK PR GATE</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-neutral-800">
                {services.length > 0 ? (
                  services.map((s, idx) => {
                    const isBreaking = s.health === 'BREAKING';
                    const isInstalling = installingServiceId === s.id;
                    const commitUrl = installedMap.get(s.id);

                    return (
                      <tr key={idx} className="hover:bg-[#171717]">
                        <td className="p-3 font-bold">
                          {isBreaking ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 uppercase bg-rose-950 text-rose-300 border border-rose-600 font-bold text-[10px]">
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              BLOCKED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 uppercase bg-emerald-950 text-emerald-400 border border-emerald-600 font-bold text-[10px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              PASSED
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-white font-extrabold">{s.id}</td>
                        <td className="p-3 text-neutral-400 uppercase">{s.language}</td>
                        <td className="p-3 text-blue-400 font-bold">{s.routes_count} routes</td>
                        <td className="p-3">
                          {commitUrl ? (
                            <button
                              onClick={() => {
                                if (commitUrl) {
                                  window.open(commitUrl, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500 text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1 cursor-pointer w-max"
                              title={`Open workflow file on GitHub: ${commitUrl}`}
                            >
                              <Check className="w-3 h-3 text-emerald-400" /> ACTIVE
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handle1ClickInstall(s)}
                              disabled={isInstalling}
                              className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-[10px] font-bold text-cyan-300 uppercase flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_0px_#06b6d4] disabled:opacity-40"
                              title="Inject .github/workflows/omnitrace-ci.yml PR gate into this microservice"
                            >
                              {isInstalling ? <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" /> : <Zap className="w-3 h-3 text-cyan-400" />}
                              {isInstalling ? 'ENABLING...' : '⚡ 1-CLICK ENABLE'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-neutral-500 text-xs uppercase">
                      No microservices analyzed yet. Click "Analyze Microservices" to import repositories.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Audit Log Table */}
      <div className="bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-blue-400" />
            Active Dependency Contract Audit Executions
          </h3>
          <span className="text-xs text-neutral-400 uppercase font-bold">POLICY: {policy.production_gate}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-black text-neutral-400 border-b-2 border-neutral-800 uppercase font-bold">
              <tr>
                <th className="p-3">GATE RESULT</th>
                <th className="p-3">CONSUMER ➔ PRODUCER</th>
                <th className="p-3">TARGET ROUTE</th>
                <th className="p-3 font-bold">ISSUES DETECTED</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-neutral-800">
              {breakingEdges.length > 0 ? (
                breakingEdges.map((e, idx) => (
                  <tr key={idx} className="hover:bg-[#171717]">
                    <td className="p-3 font-bold">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 uppercase bg-rose-950 text-rose-300 border border-rose-600 font-bold">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        BLOCKED
                      </span>
                    </td>
                    <td className="p-3 text-white font-extrabold">{e.source} ➔ {e.target}</td>
                    <td className="p-3 text-blue-400 font-bold">{e.target_path}</td>
                    <td className="p-3 text-rose-400 font-bold">{e.issues?.join(', ') || 'Missing required field'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-neutral-500 text-xs uppercase">
                    Zero contract violations detected across loaded microservices mesh.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default GovernancePanel;
