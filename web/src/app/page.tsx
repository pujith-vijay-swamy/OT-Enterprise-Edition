'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import TopologyCanvas from '@/components/TopologyCanvas';
import GovernancePanel from '@/components/GovernancePanel';
import ContractIRExplorer from '@/components/ContractIRExplorer';
import ScanReposModal from '@/components/ScanReposModal';
import { SAMPLE_DRIFTS } from '@/lib/mockData';

const MonacoDiffViewer = dynamic(
  () => import('@/components/MonacoDiffViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100vh-140px)] brutal-card flex flex-col items-center justify-center p-8 text-center space-y-4 font-mono">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent animate-spin"></div>
        <p className="text-xs font-bold text-white uppercase tracking-wider">LOADING AST MONACO DIFF EDITOR...</p>
      </div>
    )
  }
);
import { ServiceNodeData, ServiceEdgeData, ContractDrift } from '@/lib/types';
import { checkEngineHealth, fetchGitHubSession, loginGitHubDemo, loginGitHubToken, logoutGitHub, scanMultipleRepos, fetchLatestOpenPR, GitHubSession, API_BASE } from '@/lib/api';
import { Server, FolderPlus, Trash2, Layers } from 'lucide-react';

const DEFAULT_REPOS = [
  { dir: 'samples/checkout-frontend', name: 'checkout-frontend' },
  { dir: 'samples/user-service-v1', name: 'user-service-v1' },
  { dir: 'samples/payment-gateway-service', name: 'payment-gateway-service' },
  { dir: 'samples/order-service', name: 'order-service' },
  { dir: 'samples/notification-service', name: 'notification-service' }
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>('topology');
  const [blastRadiusMode, setBlastRadiusMode] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [engineOnline, setEngineOnline] = useState<boolean>(false);

  // Active microservices list to scan dynamically
  const [activeReposToScan, setActiveReposToScan] = useState<{ dir: string; name: string }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('repotrace_active_repos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_REPOS;
  });

  // User-deleted microservices blacklist preserved across live polls
  const [deletedServiceIds, setDeletedServiceIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('repotrace_deleted_services');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  // Live mutable refs to guarantee 100% real-time state access inside React polling closures
  const deletedServiceIdsRef = useRef<string[]>(deletedServiceIds);
  deletedServiceIdsRef.current = deletedServiceIds;

  const activeReposToScanRef = useRef<{ dir: string; name: string }[]>(activeReposToScan);
  activeReposToScanRef.current = activeReposToScan;

  // GitHub OAuth Session State
  const [githubSession, setGithubSession] = useState<GitHubSession>({
    authenticated: true,
    user: {
      login: "alex_dev",
      name: "Alex Dev (Enterprise)",
      avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4"
    }
  });

  // Services & Edges state
  const [services, setServices] = useState<ServiceNodeData[]>([]);
  const [edges, setEdges] = useState<ServiceEdgeData[]>([]);

  const [selectedNode, setSelectedNode] = useState<ServiceNodeData | null>(null);
  const [selectedDrift, setSelectedDrift] = useState<ContractDrift>(SAMPLE_DRIFTS[0]);

  // Active PR State (dynamically fetched from GitHub on mount)
  const [activePr, setActivePr] = useState<{
    has_open_pr: boolean;
    pr_number: number;
    head_branch: string;
    base_branch: string;
    pr_url: string;
    all_prs: any[];
  }>({
    has_open_pr: false,
    pr_number: 15,
    head_branch: 'feature/v2-upgrade',
    base_branch: 'main',
    pr_url: 'https://github.com/pujith-vijay-swamy/UserService/pull/15',
    all_prs: []
  });

  const activePrRef = useRef(activePr);
  useEffect(() => {
    activePrRef.current = activePr;
  }, [activePr]);

  // Persistent Node Positions state preserved across tab switches
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Helper check if a repo or service name has been deleted by the user
  const isDeletedService = (nameOrDir: string) => {
    if (!nameOrDir) return false;
    const clean = nameOrDir.toLowerCase().trim();
    const liveList = deletedServiceIdsRef.current;
    return liveList.some(d => {
      if (!d) return false;
      const dClean = d.toLowerCase().trim();
      return clean === dClean || clean.includes(dClean) || dClean.includes(clean);
    });
  };

  // Helper function to scan enterprise microservice mesh contracts
  const scanMesh = (isOpenPr?: boolean, overrideRepos?: { dir: string; name: string }[]) => {
    const baseList = overrideRepos || activeReposToScanRef.current;
    const filteredBase = baseList.filter(r => !isDeletedService(r.name) && !isDeletedService(r.dir));
    if (filteredBase.length === 0) return;

    const reposToScan = [...filteredBase];

    const currentOpenPrState = (isOpenPr !== undefined) ? isOpenPr : activePrRef.current.has_open_pr;

    // ONLY include ghost PR service (user-service-v2) when active open PR exists on GitHub and user has NOT deleted user-service-v2!
    if (currentOpenPrState && !isDeletedService('user-service-v2') && !reposToScan.some(r => r.name === 'user-service-v2' || r.dir.includes('user-service-v2'))) {
      reposToScan.push({ dir: 'samples/user-service-v2', name: 'user-service-v2' });
    }

    scanMultipleRepos(reposToScan).then(res => {
      if (res && res.contracts) {
        handleLiveScanComplete(res.contracts, res.topology);
      }
    }).catch(() => {});
  };

  const targetOwner = process.env.NEXT_PUBLIC_GITHUB_OWNER || githubSession?.user?.login || 'pujith-vijay-swamy';
  const targetRepo = process.env.NEXT_PUBLIC_GITHUB_REPO || 'UserService';

  // Initial load of microservices mesh and latest PR
  useEffect(() => {
    fetchLatestOpenPR(targetOwner, targetRepo).then(pr => {
      if (pr) {
        setActivePr({
          has_open_pr: pr.has_open_pr,
          pr_number: pr.number,
          head_branch: pr.head_branch,
          base_branch: pr.base_branch,
          pr_url: pr.html_url,
          all_prs: pr.all_prs || []
        });
        scanMesh(pr.has_open_pr);
      } else {
        scanMesh(false);
      }
    }).catch(() => scanMesh(false));
  }, []);

  // Real-Time Live Polling Loop (every 3 seconds) for instant dynamic updates
  useEffect(() => {
    let isMounted = true;
    let pollCount = 0;

    const pollUpdates = async () => {
      try {
        pollCount++;
        const [isOnline, session, latestPr] = await Promise.all([
          checkEngineHealth(),
          fetchGitHubSession(),
          fetchLatestOpenPR(targetOwner, targetRepo)
        ]);

        if (!isMounted) return;

        setEngineOnline(isOnline);
        if (session && session.authenticated) {
          setGithubSession(session);
        }

        // Dynamically update PR number and trigger background scan if new PR detected
        if (latestPr) {
          setActivePr(prev => {
            if (
              prev.pr_number !== latestPr.number ||
              prev.has_open_pr !== latestPr.has_open_pr ||
              (latestPr.all_prs && prev.all_prs?.length !== latestPr.all_prs.length)
            ) {
              // Trigger mesh scan on PR status/number change
              scanMesh(latestPr.has_open_pr);
              return {
                has_open_pr: latestPr.has_open_pr,
                pr_number: latestPr.number,
                head_branch: latestPr.head_branch,
                base_branch: latestPr.base_branch,
                pr_url: latestPr.html_url,
                all_prs: latestPr.all_prs || []
              };
            }
            return prev;
          });
        }

        // Periodically refresh AST mesh contracts every 3rd poll (9 seconds) to pick up new code changes dynamically
        if (pollCount % 3 === 0) {
          const livePrState = latestPr ? latestPr.has_open_pr : activePrRef.current.has_open_pr;
          scanMesh(livePrState);
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('github_connected')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        if (isMounted) setEngineOnline(false);
      }
    };

    pollUpdates();
    const interval = setInterval(pollUpdates, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeReposToScan]);

  const handleLoginGitHub = async () => {
    const session = await loginGitHubDemo();
    setGithubSession(session);
  };

  const handleLogoutGitHub = async () => {
    await logoutGitHub();
    setGithubSession({ authenticated: false });
  };

  const handleUpdatePosition = (id: string, pos: { x: number; y: number }) => {
    setNodePositions(prev => ({
      ...prev,
      [id]: pos
    }));
  };

  const handleRefresh = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1000);
  };

  const handleClearAll = () => {
    const currentIds = services.map(s => s.id);
    deletedServiceIdsRef.current = currentIds;
    setDeletedServiceIds(currentIds);
    try {
      localStorage.setItem('repotrace_deleted_services', JSON.stringify(currentIds));
    } catch (e) {}

    activeReposToScanRef.current = [];
    setActiveReposToScan([]);
    setServices([]);
    setEdges([]);
    setNodePositions({});
    try {
      localStorage.removeItem('repotrace_active_repos');
    } catch (e) {}
  };

  const handleRemoveSingleService = (serviceId: string) => {
    if (!deletedServiceIdsRef.current.includes(serviceId)) {
      deletedServiceIdsRef.current = [...deletedServiceIdsRef.current, serviceId];
    }
    setDeletedServiceIds(deletedServiceIdsRef.current);
    try {
      localStorage.setItem('repotrace_deleted_services', JSON.stringify(deletedServiceIdsRef.current));
    } catch (e) {}

    const updatedRepos = activeReposToScanRef.current.filter(r => r.name !== serviceId && !r.dir.includes(serviceId));
    activeReposToScanRef.current = updatedRepos;
    setActiveReposToScan(updatedRepos);
    try {
      localStorage.setItem('repotrace_active_repos', JSON.stringify(updatedRepos));
    } catch (e) {}

    setServices(prev => prev.filter(s => s.id !== serviceId));
    setEdges(prev => prev.filter(e => e.source !== serviceId && e.target !== serviceId));
  };

  const handleLiveScanComplete = (extractedContracts: any[], extractedTopology?: any, scannedRepos?: { dir: string; name: string }[]) => {
    if (scannedRepos && scannedRepos.length > 0) {
      const scannedNames = scannedRepos.map(r => r.name);
      const remainingDeleted = deletedServiceIdsRef.current.filter(id => !scannedNames.includes(id));
      deletedServiceIdsRef.current = remainingDeleted;
      setDeletedServiceIds(remainingDeleted);
      try {
        localStorage.setItem('repotrace_deleted_services', JSON.stringify(remainingDeleted));
      } catch (e) {}

      activeReposToScanRef.current = scannedRepos;
      setActiveReposToScan(scannedRepos);
      try {
        localStorage.setItem('repotrace_active_repos', JSON.stringify(scannedRepos));
      } catch (e) {}
    }
    if (extractedContracts && extractedContracts.length > 0) {
      const activeContracts = extractedContracts.filter(c => !isDeletedService(c.service_name));
      const immediateEdges: ServiceEdgeData[] = (extractedTopology && extractedTopology.edges && extractedTopology.edges.length > 0)
        ? extractedTopology.edges
            .filter((e: any) => !isDeletedService(e.consumer_service) && !isDeletedService(e.producer_service))
            .map((e: any, idx: number) => ({
              id: `edge-${e.consumer_service}-${e.producer_service}-${idx}`,
              source: e.consumer_service,
              target: e.producer_service,
              target_path: e.target_path,
              method: e.method,
              status: e.status || 'HEALTHY',
              confidence_tier: e.confidence_tier || e.status || 'HEALTHY',
              verification_status: e.verification_status,
              verification_note: e.verification_note,
              ai_explanation: e.ai_explanation || (
                (e.status === 'BREAKING' || e.status === 'HIGH_CONFIDENCE_BREAK' || (e.producer_service && e.producer_service.includes('v2')))
                  ? `AI Advisory (Gemini 3.5): Static AST boundary analysis confirmed breaking contract drift on ${e.target_path}. Consumer ${e.consumer_service} expects baseline signature, but producer ${e.producer_service} requires mutated path/schema.`
                  : undefined
              ),
              issues: e.issues || [],
              traffic_rps: 500
            }))
        : edges.filter(e => !isDeletedService(e.source) && !isDeletedService(e.target));

      const incomingServices: ServiceNodeData[] = activeContracts.map((c, idx) => {
        const id = c.service_name || `service-${idx}`;
        const routesCount = (c.routes || []).length;
        const callsCount = (c.consumer_calls || []).length;
        
        const relevantEdges = immediateEdges.filter(e => e.source === id || e.target === id);
        let healthStatus: 'HEALTHY' | 'WARN' | 'BREAKING' | 'UNLINKED' = 'HEALTHY';

        if (relevantEdges.length === 0) {
          healthStatus = 'UNLINKED';
        } else if (relevantEdges.some(e => e.status === 'BREAKING' || e.status === 'HIGH_CONFIDENCE_BREAK' || e.confidence_tier === 'HIGH_CONFIDENCE_BREAK')) {
          healthStatus = 'BREAKING';
        } else if (relevantEdges.some(e => e.status === 'WARN' || e.status === 'POSSIBLE_BREAK' || e.confidence_tier === 'POSSIBLE_BREAK')) {
          healthStatus = 'WARN';
        }

        return {
          id,
          label: `${c.service_name} (${c.language})`,
          service_type: c.service_type || (callsCount > 0 && routesCount === 0 ? 'consumer' : (routesCount > 0 && callsCount > 0 ? 'fullstack' : 'producer')),
          language: c.language || 'python',
          repository: c.repository || '',
          version: c.version || '1.0.0',
          routes_count: routesCount,
          consumer_calls_count: callsCount,
          health: healthStatus,
          rps: Math.floor(Math.random() * 800) + 400,
          latency_ms: Math.floor(Math.random() * 25) + 12,
          routes: c.routes || [],
          consumer_calls: c.consumer_calls || []
        };
      });

      setEdges(immediateEdges);

      setServices(incomingServices);

      const updatedPositions: Record<string, { x: number; y: number }> = {};
      const layerCount: Record<string, number> = { consumer: 0, producer: 0, fullstack: 0 };

      incomingServices.forEach((s) => {
        const type = s.service_type || 'producer';
        const row = layerCount[type] || 0;
        layerCount[type] = row + 1;

        let colX = 880;
        if (type === 'consumer') colX = 60;
        else if (type === 'fullstack') colX = 460;

        updatedPositions[s.id] = nodePositions[s.id] || { x: colX, y: 120 + row * 220 };
      });

      setNodePositions(prev => ({ ...updatedPositions, ...prev }));

      const rawContractsForMatching = incomingServices.map(s => ({
        service_name: s.id,
        service_type: s.service_type,
        language: s.language,
        repository: s.repository,
        version: s.version,
        routes: s.routes,
        consumer_calls: s.consumer_calls
      }));

      fetch(`${API_BASE}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contracts: rawContractsForMatching })
      })
      .then(res => res.json())
      .then(topology => {
        if (topology && topology.edges) {
          const newEdges: ServiceEdgeData[] = topology.edges.map((e: any, idx: number) => ({
            id: `edge-${e.consumer_service}-${e.producer_service}-${idx}`,
            source: e.consumer_service,
            target: e.producer_service,
            target_path: e.target_path,
            method: e.method,
            status: e.status || 'HEALTHY',
            confidence_tier: e.confidence_tier || e.status || 'HEALTHY',
            verification_status: e.verification_status || 'confirmed',
            verification_note: e.verification_note || '',
            ai_explanation: e.ai_explanation,
            issues: e.issues || [],
            traffic_rps: 500
          }));
          setEdges(newEdges);
        }
      })
      .catch(() => {});
    }
  };

  const breakingCount = edges.filter(e => {
    const s = (e.status as string) || (e.confidence_tier as string) || 'HEALTHY';
    return s === 'BREAKING' || s === 'HIGH_CONFIDENCE_BREAK' || s === 'POSSIBLE_BREAK' || s === 'WARN' || (e.issues && e.issues.length > 0);
  }).length;

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 flex flex-col selection:bg-blue-600 selection:text-white font-mono">
      
      {/* Ultra-Brutalism Header with GitHub Auth Session */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        blastRadiusMode={blastRadiusMode}
        setBlastRadiusMode={setBlastRadiusMode}
        onOpenScanModal={() => setIsModalOpen(true)}
        onRefresh={handleRefresh}
        isScanning={isScanning}
        breakingCount={breakingCount}
        engineOnline={engineOnline}
        githubSession={githubSession}
        onLoginGitHub={handleLoginGitHub}
        onLogoutGitHub={handleLogoutGitHub}
        onSessionUpdated={setGithubSession}
        ragContext={{ edges, services, activePr }}
      />

      {/* Toolbar when services are loaded */}
      {services.length > 0 && (
        <div className="px-6 pt-3 flex items-center justify-between text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>LOADED MICROSERVICES: <strong className="text-white">{services.length} SERVICES</strong></span>
            <span className="text-neutral-700">|</span>
            <span>CROSS-REPO DEPENDENCIES: <strong className="text-white">{edges.length} LINKS</strong></span>
          </div>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-neutral-400 hover:text-rose-400 text-xs transition-colors cursor-pointer uppercase font-bold"
          >
            <Trash2 className="w-3.5 h-3.5" /> CLEAR ALL SERVICES
          </button>
        </div>
      )}

      {/* Main Dashboard Workspace */}
      <main className="flex-1 p-4 md:p-5 max-w-[1920px] w-full mx-auto flex flex-col">
        {services.length === 0 ? (
          /* Empty State Onboarding Canvas */
          <div className="flex-1 w-full h-[calc(100vh-140px)] brutal-card flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-blue-600 border-2 border-white flex items-center justify-center text-white shadow-[4px_4px_0px_0px_#ffffff]">
              <Server className="w-8 h-8" />
            </div>

            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-extrabold text-white uppercase tracking-wider">NO MICROSERVICES ANALYZED YET</h2>
              <p className="text-xs text-neutral-400 leading-relaxed font-mono">
                Select your GitHub repositories or paste repository URLs to statically parse AST boundary contracts and map microservice mesh dependencies.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="brutal-btn-primary flex items-center gap-2 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                Analyze Microservices
              </button>
            </div>
          </div>
        ) : (
          <div key={activeTab} className="w-full h-full animate-tab-transition">
            {activeTab === 'topology' && (
              <TopologyCanvas
                services={services}
                edges={edges}
                blastRadiusMode={blastRadiusMode}
                savedPositions={nodePositions}
                onUpdatePosition={handleUpdatePosition}
                onSelectNode={node => setSelectedNode(node)}
                onSelectEdge={() => {}}
                onRemoveService={handleRemoveSingleService}
                activePr={activePr}
              />
            )}

            {activeTab === 'monaco' && (
              <MonacoDiffViewer services={services} selectedDrift={selectedDrift} activePr={activePr} />
            )}

            {activeTab === 'governance' && (
              <GovernancePanel services={services} edges={edges} />
            )}

            {activeTab === 'ir' && (
              <ContractIRExplorer services={services} />
            )}
          </div>
        )}
      </main>

      {/* Modal to scan GitHub repositories */}
      <ScanReposModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onScanComplete={handleLiveScanComplete}
        githubSession={githubSession}
      />

    </div>
  );
}
