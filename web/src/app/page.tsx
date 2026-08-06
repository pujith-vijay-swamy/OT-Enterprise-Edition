'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import TopologyCanvas from '@/components/TopologyCanvas';
import MonacoDiffViewer from '@/components/MonacoDiffViewer';
import GovernancePanel from '@/components/GovernancePanel';
import ContractIRExplorer from '@/components/ContractIRExplorer';
import ScanReposModal from '@/components/ScanReposModal';
import { SAMPLE_DRIFTS } from '@/lib/mockData';
import { ServiceNodeData, ServiceEdgeData, ContractDrift } from '@/lib/types';
import { checkEngineHealth, fetchGitHubSession, loginGitHubDemo, loginGitHubToken, logoutGitHub, GitHubSession } from '@/lib/api';
import { Server, FolderPlus, Trash2, Layers } from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>('topology');
  const [blastRadiusMode, setBlastRadiusMode] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [engineOnline, setEngineOnline] = useState<boolean>(false);

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

  // Persistent Node Positions state preserved across tab switches
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Check Python API Server engine status & GitHub Session concurrently
  useEffect(() => {
    let isMounted = true;

    const verifyHealth = async () => {
      try {
        const [isOnline, session] = await Promise.all([
          checkEngineHealth(),
          fetchGitHubSession()
        ]);

        if (!isMounted) return;

        setEngineOnline(isOnline);
        if (session && session.authenticated) {
          setGithubSession(session);
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('github_connected')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        if (isMounted) setEngineOnline(false);
      }
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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
    setServices([]);
    setEdges([]);
    setNodePositions({});
  };

  const handleRemoveSingleService = (serviceId: string) => {
    setServices(prev => {
      const remaining = prev.filter(s => s.id !== serviceId);
      
      const rawContractsForMatching = remaining.map(s => ({
        service_name: s.id,
        service_type: s.service_type,
        language: s.language,
        repository: s.repository,
        version: s.version,
        routes: s.routes,
        consumer_calls: s.consumer_calls
      }));

      if (rawContractsForMatching.length > 0) {
        fetch('http://localhost:4400/api/match', {
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
              issues: e.issues || [],
              traffic_rps: 500
            }));
            setEdges(newEdges);
          }
        })
        .catch(() => {});
      } else {
        setEdges([]);
      }

      return remaining;
    });
  };

  const handleLiveScanComplete = (extractedContracts: any[], extractedTopology?: any) => {
    if (extractedContracts && extractedContracts.length > 0) {
      const incomingServices: ServiceNodeData[] = extractedContracts.map((c, idx) => {
        const id = c.service_name || `service-${idx}`;
        const routesCount = (c.routes || []).length;
        const callsCount = (c.consumer_calls || []).length;
        
        let healthStatus: 'HEALTHY' | 'WARN' | 'BREAKING' = 'HEALTHY';
        if (routesCount === 0 && callsCount === 0) healthStatus = 'WARN';

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

      if (extractedTopology && extractedTopology.edges) {
        const immediateEdges: ServiceEdgeData[] = extractedTopology.edges.map((e: any, idx: number) => ({
          id: `edge-${e.consumer_service}-${e.producer_service}-${idx}`,
          source: e.consumer_service,
          target: e.producer_service,
          target_path: e.target_path,
          method: e.method,
          status: e.status || 'HEALTHY',
          issues: e.issues || [],
          traffic_rps: 500
        }));
        setEdges(immediateEdges);
      }

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

      fetch('http://localhost:4400/api/match', {
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
            issues: e.issues || [],
            traffic_rps: 500
          }));
          setEdges(newEdges);
        }
      })
      .catch(() => {});
    }
  };

  const breakingCount = edges.filter(e => e.status === 'BREAKING').length;

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
          <>
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
              />
            )}

            {activeTab === 'monaco' && (
              <MonacoDiffViewer services={services} selectedDrift={selectedDrift} />
            )}

            {activeTab === 'governance' && (
              <GovernancePanel services={services} edges={edges} />
            )}

            {activeTab === 'ir' && (
              <ContractIRExplorer services={services} />
            )}
          </>
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
