'use client';

import React, { useState, useEffect } from 'react';
import { scanMultipleRepos, fetchUserGitHubRepos, installGitHubWorkflow, GitHubRepoItem, GitHubSession } from '../lib/api';
import { Plus, Trash2, RefreshCw, AlertCircle, Play, Server, Search, Lock, Globe, CheckSquare, Square, GitBranch, Sparkles, Zap, Check, ExternalLink } from 'lucide-react';

interface RepoInput {
  dir: string;
  name: string;
}

interface ScanReposModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (contracts: any[], topology: any, reposToScan?: { dir: string; name: string }[]) => void;
  githubSession: GitHubSession;
}

export const ScanReposModal: React.FC<ScanReposModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  githubSession
}) => {
  const [activeTab, setActiveTab] = useState<'remote' | 'manual'>('remote');
  const [githubRepos, setGithubRepos] = useState<GitHubRepoItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1-Click Workflow Installation State per repo ID
  const [installingWorkflowRepoId, setInstallingWorkflowRepoId] = useState<number | null>(null);
  const [installedWorkflowRepos, setInstalledWorkflowRepos] = useState<Map<string, { commitUrl: string; prUrl: string }>>(new Map());

  // Manual fallback inputs
  const [manualRepos, setManualRepos] = useState<RepoInput[]>([
    { dir: '', name: '' }
  ]);

  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom external repository input state
  const [customRepoInput, setCustomRepoInput] = useState('');

  const handleAddCustomExternalRepo = () => {
    if (!customRepoInput.trim()) return;
    const input = customRepoInput.trim();
    let fullName = input;
    if (input.includes('/')) {
      fullName = input.replace('https://github.com/', '').replace('.git', '').replace(/\/$/, '');
    }
    const newId = Date.now();
    const newRepo: GitHubRepoItem = {
      id: newId,
      name: fullName.split('/').pop() || fullName,
      full_name: fullName,
      language: 'TypeScript',
      private: false,
      html_url: input.startsWith('http') ? input : `https://github.com/${fullName}`,
      clone_url: input.startsWith('http') ? input : `https://github.com/${fullName}.git`,
      updated_at: new Date().toISOString(),
      description: 'External Microservice Repository'
    };

    setGithubRepos(prev => [newRepo, ...prev]);
    setSelectedRepoIds(prev => new Set([newId, ...Array.from(prev)]));
    setCustomRepoInput('');
  };

  // Fetch repositories from GitHub API on modal open
  useEffect(() => {
    if (isOpen) {
      setLoadingRepos(true);
      fetchUserGitHubRepos()
        .then(repos => {
          setGithubRepos(repos);
          if (repos.length >= 2) {
            setSelectedRepoIds(new Set(repos.slice(0, 4).map(r => r.id)));
          }
        })
        .finally(() => setLoadingRepos(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleRepoSelect = (repoId: number) => {
    setSelectedRepoIds(prev => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRepoIds.size === filteredRepos.length) {
      setSelectedRepoIds(new Set());
    } else {
      setSelectedRepoIds(new Set(filteredRepos.map(r => r.id)));
    }
  };

  const handleLoadEnterpriseMeshDemo = () => {
    setManualRepos([
      { dir: 'samples/checkout-frontend', name: 'checkout-frontend' },
      { dir: 'samples/user-service-v1', name: 'user-service-v1' },
      { dir: 'samples/user-service-v2', name: 'user-service-v2' },
      { dir: 'samples/payment-gateway-service', name: 'payment-gateway-service' },
      { dir: 'samples/order-service', name: 'order-service' },
      { dir: 'samples/notification-service', name: 'notification-service' }
    ]);
    setActiveTab('manual');
  };

  const handle1ClickInstallWorkflow = async (e: React.MouseEvent, repo: GitHubRepoItem) => {
    e.stopPropagation();
    setInstallingWorkflowRepoId(repo.id);
    setErrorMsg(null);
    try {
      const res = await installGitHubWorkflow(repo.full_name);
      setInstalledWorkflowRepos(prev => {
        const copy = new Map(prev);
        copy.set(repo.full_name, { commitUrl: res.commit_url, prUrl: res.pr_url });
        return copy;
      });
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to install 1-click workflow in ${repo.name}`);
    } finally {
      setInstallingWorkflowRepoId(null);
    }
  };

  // Filtered repositories based on search input
  const filteredRepos = githubRepos.filter(r =>
    r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddManualRow = () => {
    setManualRepos(prev => [...prev, { dir: '', name: '' }]);
  };

  const handleRemoveManualRow = (index: number) => {
    setManualRepos(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateManualRow = (index: number, field: keyof RepoInput, val: string) => {
    setManualRepos(prev => {
      const copy = [...prev];
      copy[index][field] = val;
      return copy;
    });
  };

  const handleRunScan = async () => {
    setErrorMsg(null);
    setIsScanning(true);
    try {
      let reposToScan: { dir: string; name: string }[] = [];

      if (activeTab === 'remote') {
        const selected = githubRepos.filter(r => selectedRepoIds.has(r.id));
        if (selected.length < 2) {
          throw new Error('Please select at least 2 microservice repositories to analyze cross-repository topology.');
        }
        reposToScan = selected.map(r => ({
          dir: r.clone_url || r.html_url,
          name: r.name
        }));
      } else {
        const validRepos = manualRepos.filter(r => r.dir.trim() !== '');
        if (validRepos.length === 0) {
          throw new Error('Please enter at least one GitHub Repository URL or Local Directory path.');
        }
        reposToScan = validRepos;
      }

      const result = await scanMultipleRepos(reposToScan);
      if (!result.contracts || result.contracts.length === 0) {
        throw new Error('No microservice AST definitions were found at the provided paths.');
      }

      onScanComplete(result.contracts, result.topology, reposToScan);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error extracting repository contracts');
    } finally {
      setIsScanning(false);
    }
  };

  const selectedCount = activeTab === 'remote' ? selectedRepoIds.size : manualRepos.filter(r => r.dir.trim()).length;
  const isRunDisabled = isScanning || (activeTab === 'remote' && selectedCount < 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 font-mono">
      <div className="bg-[#0a0a0a] border-2 border-white w-full max-w-3xl p-5 shadow-[6px_6px_0px_0px_#ffffff] space-y-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 border border-white text-white font-bold">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">ANALYZE GITHUB REPOSITORIES</h2>
              <p className="text-[10px] text-neutral-400">SELECT MICROSERVICES FOR CROSS-REPO AST BOUNDARY OBSERVABILITY</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-xs font-bold uppercase cursor-pointer">✕ CLOSE</button>
        </div>

        {/* Tab Switcher & Quick Demo Preset Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-neutral-800 pb-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('remote')}
              className={`px-2.5 py-1 text-xs font-bold uppercase transition-all border-2 cursor-pointer ${
                activeTab === 'remote'
                  ? 'bg-blue-600 text-white border-white shadow-[1.5px_1.5px_0px_0px_#ffffff]'
                  : 'bg-[#171717] text-neutral-400 border-neutral-700 hover:text-white'
              }`}
            >
              GitHub Repos ({githubRepos.length})
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-2.5 py-1 text-xs font-bold uppercase transition-all border-2 cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-blue-600 text-white border-white shadow-[1.5px_1.5px_0px_0px_#ffffff]'
                  : 'bg-[#171717] text-neutral-400 border-neutral-700 hover:text-white'
              }`}
            >
              Manual URL / Path Menu
            </button>
          </div>

          <button
            onClick={handleLoadEnterpriseMeshDemo}
            className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 uppercase cursor-pointer bg-[#171717] px-2.5 py-1 border border-neutral-700"
          >
            <Sparkles className="w-3.5 h-3.5" /> Load Demo Mesh (6 Microservices)
          </button>
        </div>

        {/* Tab 1: GitHub Remote Repos List with Search & Checkboxes */}
        {activeTab === 'remote' && (
          <div className="space-y-2.5">
            {/* Add Custom External Repo Input Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2 p-2 bg-[#171717] border border-neutral-700">
              <input
                type="text"
                placeholder="Add external repo from another user/org (e.g. 25pa1a45a2-ai/checkout-frontend)"
                value={customRepoInput}
                onChange={e => setCustomRepoInput(e.target.value)}
                className="w-full bg-black border border-neutral-700 px-2.5 py-1 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleAddCustomExternalRepo}
                disabled={!customRepoInput.trim()}
                className="w-full sm:w-auto px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase border border-white shadow-[1.5px_1.5px_0px_0px_#ffffff] cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                + ADD EXTERNAL REPO
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter repositories by name or language..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black border-2 border-neutral-700 pl-8 pr-3 py-1 text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1 bg-[#171717] hover:bg-[#262626] border border-neutral-700 text-xs font-bold text-neutral-300 uppercase shrink-0"
              >
                {selectedRepoIds.size === filteredRepos.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Repo List Container */}
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {loadingRepos ? (
                <div className="p-6 text-center text-xs text-neutral-400 uppercase font-bold flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Fetching user repositories from GitHub REST API...</span>
                </div>
              ) : filteredRepos.length > 0 ? (
                filteredRepos.map(repo => {
                  const isChecked = selectedRepoIds.has(repo.id);
                  const isInstalling = installingWorkflowRepoId === repo.id;
                  const installedData = installedWorkflowRepos.get(repo.full_name);

                  return (
                    <div
                      key={repo.id}
                      onClick={() => handleToggleRepoSelect(repo.id)}
                      className={`p-2.5 border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-blue-950/40 border-blue-600 shadow-[1.5px_1.5px_0px_0px_#2563eb]'
                          : 'bg-black border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button className="text-blue-400">
                          {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-neutral-600" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-white truncate">{repo.full_name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#171717] text-cyan-400 border border-neutral-700 uppercase">
                              {repo.language}
                            </span>
                            {repo.private ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-700 uppercase flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" /> PRIVATE
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-700 uppercase flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5" /> PUBLIC
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5 font-sans">{repo.description}</p>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Workflow Automator Action Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {installedData ? (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (installedData.commitUrl) {
                                window.open(installedData.commitUrl, '_blank', 'noopener,noreferrer');
                              }
                            }}
                            className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500 text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1 cursor-pointer"
                            title={`Open workflow file on GitHub: ${installedData.commitUrl}`}
                          >
                            <Check className="w-3 h-3 text-emerald-400" /> PR GATE ACTIVE
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        ) : (
                          <button
                            onClick={e => handle1ClickInstallWorkflow(e, repo)}
                            disabled={isInstalling}
                            className="px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-[10px] font-bold text-cyan-300 uppercase flex items-center gap-1 shadow-[1px_1px_0px_0px_#06b6d4] cursor-pointer disabled:opacity-40"
                            title="Automatically inject .github/workflows/repotrace-ci.yml PR gate into this repository"
                          >
                            {isInstalling ? <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" /> : <Zap className="w-3 h-3 text-cyan-400" />}
                            {isInstalling ? 'ENABLING...' : '⚡ 1-CLICK ENABLE PR GATE'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-neutral-500 uppercase">
                  No matching repositories found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Manual URL or File Path Inputs Menu */}
        {activeTab === 'manual' && (
          <div className="space-y-2.5">
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {manualRepos.map((repo, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-black p-2.5 border-2 border-neutral-800">
                  <div className="col-span-4">
                    <label className="text-[9px] text-neutral-400 block mb-0.5 uppercase font-bold">SERVICE NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. auth-service"
                      value={repo.name}
                      onChange={e => handleUpdateManualRow(i, 'name', e.target.value)}
                      className="w-full bg-[#171717] border-2 border-neutral-700 px-2 py-1 text-xs text-white font-bold uppercase focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-7">
                    <label className="text-[9px] text-neutral-400 block mb-0.5 uppercase font-bold flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-cyan-400" />
                      GITHUB URL OR LOCAL PATH
                    </label>
                    <input
                      type="text"
                      placeholder="https://github.com/org/repo OR D:\code\auth-service"
                      value={repo.dir}
                      onChange={e => handleUpdateManualRow(i, 'dir', e.target.value)}
                      className="w-full bg-[#171717] border-2 border-neutral-700 px-2 py-1 text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-1 text-center self-end mb-1">
                    {manualRepos.length > 1 && (
                      <button
                        onClick={() => handleRemoveManualRow(i)}
                        className="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleAddManualRow}
                className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 uppercase cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Row
              </button>

              <button
                onClick={handleLoadEnterpriseMeshDemo}
                className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 uppercase cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Reset to 6 Microservices Demo Mesh
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-950 border-2 border-rose-600 p-2 text-xs text-rose-300 flex items-center gap-2 font-bold uppercase">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-between border-t-2 border-neutral-800 pt-3">
          <span className="text-xs text-neutral-400 font-bold uppercase">
            SELECTED: <strong className="text-blue-400">{selectedCount} MICROSERVICES</strong>
          </span>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="h-[34px] px-3.5 bg-[#171717] hover:bg-[#262626] border-2 border-neutral-700 text-xs font-bold text-neutral-300 hover:text-white uppercase cursor-pointer shadow-[2px_2px_0px_0px_#000]"
            >
              Cancel
            </button>
            <button
              onClick={handleRunScan}
              disabled={isRunDisabled}
              className="h-[34px] px-4 bg-blue-600 hover:bg-blue-500 border-2 border-white text-xs font-extrabold text-white uppercase flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#ffffff] cursor-pointer disabled:opacity-40 transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isScanning ? 'FETCHING AST...' : `RUN AST ANALYSIS (${selectedCount})`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScanReposModal;
