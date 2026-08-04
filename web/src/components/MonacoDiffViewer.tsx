'use client';

import React, { useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { SAMPLE_DRIFTS, V1_USER_SERVICE_CODE, V2_USER_SERVICE_CODE } from '../lib/mockData';
import { ContractDrift, ServiceNodeData } from '../lib/types';
import { GitCommit, User, Calendar, FileCode, AlertTriangle, ShieldCheck, ArrowRight, Code, Layers, Database } from 'lucide-react';

interface MonacoDiffViewerProps {
  services?: ServiceNodeData[];
  selectedDrift?: ContractDrift;
}

export const MonacoDiffViewer: React.FC<MonacoDiffViewerProps> = ({ services = [], selectedDrift: initialDrift }) => {
  const [activeDrift, setActiveDrift] = useState<ContractDrift>(initialDrift || SAMPLE_DRIFTS[0]);
  const [selectedServiceA, setSelectedServiceA] = useState<string>('user-service-v1');
  const [selectedServiceB, setSelectedServiceB] = useState<string>('user-service-v2');

  // Automatically select version pair (v1 vs v2) or breaking pair on initial load or service update
  useEffect(() => {
    if (services && services.length >= 2) {
      // 1. Look for explicit version pairs (e.g. user-service-v1 vs user-service-v2)
      const v1 = services.find(s => s.id.toLowerCase().includes('v1'));
      const v2 = services.find(s => s.id.toLowerCase().includes('v2'));

      if (v1 && v2) {
        setSelectedServiceA(v1.id);
        setSelectedServiceB(v2.id);
        return;
      }

      // 2. Look for breaking services vs healthy consumers
      const breaking = services.find(s => s.health === 'BREAKING');
      const healthy = services.find(s => s.health === 'HEALTHY' && s.id !== breaking?.id);

      if (breaking && healthy) {
        setSelectedServiceA(healthy.id);
        setSelectedServiceB(breaking.id);
        return;
      }

      // 3. Default to first two services in list
      setSelectedServiceA(services[0].id);
      setSelectedServiceB(services[1].id);
    }
  }, [services]);

  const serviceA = services.find(s => s.id === selectedServiceA) || (services.length > 0 ? services[0] : null);
  const serviceB = services.find(s => s.id === selectedServiceB) || (services.length > 1 ? services[1] : null);

  const codeOriginal = serviceA ? JSON.stringify(serviceA.routes, null, 2) : V1_USER_SERVICE_CODE;
  const codeModified = serviceB ? JSON.stringify(serviceB.routes, null, 2) : V2_USER_SERVICE_CODE;

  const labelA = serviceA ? serviceA.id : 'user-service-v1 (Baseline)';
  const labelB = serviceB ? serviceB.id : 'user-service-v2 (Target Drift)';

  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col gap-4 p-1 font-mono">
      
      {/* Top Controller Bar */}
      <div className="bg-[#0a0a0a] border-2 border-[#262626] p-3.5 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Service Comparison Selectors */}
        {services.length >= 2 ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400" />
              Compare Microservices:
            </span>
            <select
              value={selectedServiceA}
              onChange={e => setSelectedServiceA(e.target.value)}
              className="bg-[#171717] border-2 border-neutral-700 px-3 py-1 text-xs text-white font-bold uppercase focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.id} ({s.language})</option>
              ))}
            </select>

            <span className="text-xs text-neutral-400 font-extrabold">VS</span>

            <select
              value={selectedServiceB}
              onChange={e => setSelectedServiceB(e.target.value)}
              className="bg-[#171717] border-2 border-neutral-700 px-3 py-1 text-xs text-white font-bold uppercase focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.id} ({s.language})</option>
              ))}
            </select>
          </div>
        ) : (
          /* Drift Selector Tabs when <= 1 service loaded */
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
            <span className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5 mr-2">
              <Code className="w-4 h-4 text-blue-400" />
              Detected Schema Drifts:
            </span>
            {SAMPLE_DRIFTS.map(drift => (
              <button
                key={drift.id}
                onClick={() => setActiveDrift(drift)}
                className={`px-3 py-1 text-xs font-bold uppercase transition-all border-2 shrink-0 flex items-center gap-2 cursor-pointer ${
                  activeDrift.id === drift.id
                    ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-[2px_2px_0px_0px_#f43f5e]'
                    : 'bg-[#171717] text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {drift.method} {drift.target_route} ({drift.change_type})
              </button>
            ))}
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase px-3 py-1 bg-black border-2 border-neutral-700 text-white font-bold flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5 text-blue-400" />
            AST SCHEMA SIDE-BY-SIDE DIFF
          </span>
        </div>
      </div>

      {/* Monaco Diff Panel Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        
        {/* Monaco Diff Editor (3 Columns) */}
        <div className="lg:col-span-3 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
          <div className="bg-black px-4 py-2.5 border-b-2 border-[#262626] flex items-center justify-between text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-2 text-white font-bold uppercase">
              <FileCode className="w-4 h-4 text-blue-400" />
              <span>{labelA} ➔ {labelB}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-emerald-400 font-bold uppercase">{labelA}</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
              <span className="text-rose-400 font-bold uppercase">{labelB}</span>
            </div>
          </div>

          <div className="flex-1 min-h-[380px]">
            <DiffEditor
              height="100%"
              language="json"
              original={codeOriginal}
              modified={codeModified}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                renderSideBySide: true,
                scrollBeyondLastLine: false,
                smoothScrolling: true
              }}
            />
          </div>
        </div>

        {/* Local AST Repository Context (1 Column) */}
        <div className="lg:col-span-1 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] p-4 flex flex-col gap-4 overflow-y-auto">
          
          <div>
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3 border-b-2 border-neutral-800 pb-2">
              AST Boundary Context
            </h3>

            <div className="bg-black p-3.5 border-2 border-neutral-800 space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-neutral-500 block uppercase font-mono mb-1">BASELINE MICROSERVICE (LEFT)</span>
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Database className="w-3.5 h-3.5 shrink-0" />
                  <span>{labelA}</span>
                </div>
                <span className="text-[11px] text-neutral-400 block truncate mt-0.5">{serviceA?.repository || 'AST Baseline Schema'}</span>
                <span className="text-[10px] text-neutral-500">ROUTES: {serviceA?.routes_count || 3}</span>
              </div>

              <div className="border-t border-neutral-800 pt-2.5">
                <span className="text-[10px] text-neutral-500 block uppercase font-mono mb-1">TARGET MICROSERVICE (RIGHT)</span>
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <Database className="w-3.5 h-3.5 shrink-0" />
                  <span>{labelB}</span>
                </div>
                <span className="text-[11px] text-neutral-400 block truncate mt-0.5">{serviceB?.repository || 'AST Target Schema'}</span>
                <span className="text-[10px] text-neutral-500">ROUTES: {serviceB?.routes_count || 3}</span>
              </div>

              <div className="border-t border-neutral-800 pt-2 text-[11px] text-neutral-400 uppercase">
                STATUS: <strong className="text-white">LIVE AST DIFF PARSED</strong>
              </div>
            </div>
          </div>

          {/* Remediation Box */}
          <div className="mt-auto bg-black p-3.5 border-2 border-neutral-800 text-xs">
            <h4 className="font-bold text-white mb-1.5 flex items-center gap-1.5 uppercase">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Automated Fix Guidance
            </h4>
            <p className="text-neutral-400 leading-relaxed text-[11px]">
              Ensure target microservice maintains backwards compatibility for routes and field schemas used by upstream consumers.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

export default MonacoDiffViewer;
