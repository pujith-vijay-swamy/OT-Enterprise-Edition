'use client';

import React, { useState } from 'react';
import { ServiceNodeData } from '../lib/types';
import { FileCode, Copy, Check, Terminal, Layers } from 'lucide-react';

interface ContractIRExplorerProps {
  services: ServiceNodeData[];
}

export const ContractIRExplorer: React.FC<ContractIRExplorerProps> = ({ services }) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [copied, setCopied] = useState<boolean>(false);

  const activeService = services.find(s => s.id === selectedServiceId) || services[0];

  const handleCopyJson = () => {
    if (activeService) {
      navigator.clipboard.writeText(JSON.stringify(activeService, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-4 p-1 font-mono">
      
      {/* Microservice Selection Sidebar */}
      <div className="lg:w-72 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-3 border-b-2 border-[#262626]">
          <Layers className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Scanned Services</h3>
        </div>

        <div className="space-y-2 overflow-y-auto flex-1">
          {services.map(service => (
            <button
              key={service.id}
              onClick={() => setSelectedServiceId(service.id)}
              className={`w-full text-left p-3 border-2 uppercase font-bold text-xs transition-all flex items-center justify-between cursor-pointer ${
                (activeService?.id === service.id)
                  ? 'bg-blue-600 text-white border-white shadow-[2px_2px_0px_0px_#ffffff]'
                  : 'bg-black text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600'
              }`}
            >
              <div className="truncate">
                <div className="truncate font-extrabold">{service.id}</div>
                <div className="text-[10px] opacity-80">{service.language} • {service.routes_count} routes</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main JSON IR Code Terminal Panel */}
      <div className="flex-1 bg-[#0a0a0a] border-2 border-[#262626] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)] flex flex-col overflow-hidden">
        <div className="bg-black px-4 py-3 border-b-2 border-[#262626] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-white font-bold uppercase">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>CONTRACT IR SPECIFICATION: omnitrace.contract.v1 ({activeService?.id})</span>
          </div>

          <button
            onClick={handleCopyJson}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#171717] hover:bg-[#262626] border-2 border-neutral-700 text-white font-bold text-xs uppercase cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY JSON IR'}
          </button>
        </div>

        <div className="flex-1 p-4 bg-black overflow-y-auto">
          <pre className="text-xs text-emerald-400 font-mono leading-relaxed select-all">
            {activeService ? JSON.stringify(activeService, null, 2) : '// Select a microservice to inspect Contract IR'}
          </pre>
        </div>
      </div>

    </div>
  );
};

export default ContractIRExplorer;
