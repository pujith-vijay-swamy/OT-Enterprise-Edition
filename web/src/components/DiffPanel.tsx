'use client';

import { useState } from 'react';
import { diffContracts } from '@/lib/api';
import { ServiceContract, DiffResult } from '@/lib/types';
import { Loader2, AlertCircle, ShieldAlert, GitCommit, FileCode, CheckCircle } from 'lucide-react';

export default function DiffPanel({ services }: { services: ServiceContract[] }) {
  const [serviceA, setServiceA] = useState<string>('');
  const [serviceB, setServiceB] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!serviceA || !serviceB) return;
    
    setLoading(true);
    setError(null);
    try {
      const contractA = services.find(s => s.service_name === serviceA);
      const contractB = services.find(s => s.service_name === serviceB);
      const result = await diffContracts(contractA, contractB);
      setDiffResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to compute diff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 p-6 space-y-6">
      <div className="flex items-end gap-4 p-4 bg-slate-950 rounded-lg border border-slate-800">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-slate-400">Service A (Old)</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-3 py-2 outline-none focus:border-blue-500"
            value={serviceA}
            onChange={(e) => setServiceA(e.target.value)}
          >
            <option value="">Select Service</option>
            {services.map(s => (
              <option key={s.service_name} value={s.service_name}>{s.service_name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-slate-400">Service B (New)</label>
          <select 
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-3 py-2 outline-none focus:border-blue-500"
            value={serviceB}
            onChange={(e) => setServiceB(e.target.value)}
          >
            <option value="">Select Service</option>
            {services.map(s => (
              <option key={s.service_name} value={s.service_name}>{s.service_name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCompare}
          disabled={!serviceA || !serviceB || loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2 rounded font-medium transition-colors flex items-center justify-center h-[42px] min-w-[120px]"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Compare'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {diffResult && (
        <div className="flex-1 overflow-y-auto space-y-4 pb-12">
          <h3 className="text-lg font-medium text-white mb-4">Diff Results</h3>
          
          {(!diffResult.drift_items || diffResult.drift_items.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 bg-slate-950/50 rounded-lg border border-slate-800 text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
              <p>No contract drift detected.</p>
            </div>
          ) : (
            diffResult.drift_items.map((item, i) => (
              <div key={i} className="bg-slate-950 rounded-lg border border-slate-800 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5
                      ${item.severity === 'BREAKING' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {item.severity === 'BREAKING' && <ShieldAlert className="w-3.5 h-3.5" />}
                      {item.severity}
                    </span>
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded border border-slate-700 font-mono">
                      {item.change_type}
                    </span>
                    <span className="font-mono text-sm text-slate-300 bg-slate-900 px-2 py-1 rounded">
                      {item.target_endpoint}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-rose-500/5 border border-rose-500/10 rounded p-3">
                    <div className="text-xs font-medium text-rose-400/70 mb-1 uppercase tracking-wider">Old Value</div>
                    <pre className="text-rose-300 text-sm font-mono whitespace-pre-wrap">
                      {JSON.stringify(item.old_value, null, 2) || 'undefined'}
                    </pre>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-3">
                    <div className="text-xs font-medium text-emerald-400/70 mb-1 uppercase tracking-wider">New Value</div>
                    <pre className="text-emerald-300 text-sm font-mono whitespace-pre-wrap">
                      {JSON.stringify(item.new_value, null, 2) || 'undefined'}
                    </pre>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-medium text-slate-300">Description</h4>
                  <p className="text-sm text-slate-400">{item.description}</p>
                </div>

                {item.remediation && (
                  <div className="space-y-1.5 bg-blue-500/5 border border-blue-500/10 rounded p-3">
                    <h4 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Suggested Remediation
                    </h4>
                    <p className="text-sm text-slate-300">{item.remediation}</p>
                  </div>
                )}

                {item.git_context && (
                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-800/50">
                    {item.git_context.commit_sha && (
                      <div className="flex items-center gap-1.5">
                        <GitCommit className="w-3.5 h-3.5" />
                        <span className="font-mono">{item.git_context.commit_sha.substring(0,7)}</span>
                      </div>
                    )}
                    {item.git_context.file_line && (
                      <div className="flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5" />
                        <span className="font-mono">{item.git_context.file_line}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
