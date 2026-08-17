import React, { useState } from 'react';
import { Network, GitCompare, ShieldAlert, Cpu, RefreshCw, FolderPlus, Server, Activity, LogOut, UserCheck, Key, Check, AlertCircle } from 'lucide-react';
import { GitHubSession, loginGitHubToken } from '../lib/api';
import JarvisLogo from './JarvisLogo';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  blastRadiusMode: boolean;
  setBlastRadiusMode: (val: boolean) => void;
  onOpenScanModal: () => void;
  onRefresh: () => void;
  isScanning: boolean;
  breakingCount: number;
  engineOnline: boolean;
  githubSession?: GitHubSession;
  onLoginGitHub: () => void;
  onLogoutGitHub: () => void;
  onSessionUpdated?: (session: GitHubSession) => void;
  ragContext?: {
    edges?: any[];
    services?: any[];
    activePr?: any;
  };
  onHighlightEdges?: (edgeIds: string[]) => void;
  onClearHighlights?: () => void;
  isEdgeNarrationActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  blastRadiusMode,
  setBlastRadiusMode,
  onOpenScanModal,
  onRefresh,
  isScanning,
  breakingCount,
  engineOnline,
  githubSession,
  onLoginGitHub,
  onLogoutGitHub,
  onSessionUpdated,
  ragContext,
  onHighlightEdges,
  onClearHighlights,
  isEdgeNarrationActive,
}) => {
  const isAuth = Boolean(githubSession && githubSession.authenticated && githubSession.user);
  const user = githubSession?.user;

  // GitHub Auth Modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [patToken, setPatToken] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!patToken.trim()) return;

    setIsAuthenticating(true);
    try {
      const session = await loginGitHubToken(patToken.trim());
      if (onSessionUpdated) onSessionUpdated(session);
      setIsAuthModalOpen(false);
      setPatToken('');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to authenticate with token');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleQuickDemoLogin = () => {
    onLoginGitHub();
    setIsAuthModalOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0a0a0a] border-b-2 border-[#262626] px-6 py-3 font-mono">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Logo and Status Badge */}
        <div className="flex items-center gap-3">
          {/* OmniTrace Interactive Brand Avatar Logo */}
          <JarvisLogo breakingCount={breakingCount} engineOnline={engineOnline} onRefreshMesh={onRefresh} ragContext={ragContext} onHighlightEdges={onHighlightEdges} onClearHighlights={onClearHighlights} isEdgeNarrationActive={isEdgeNarrationActive} />

          {/* User GitHub Session Badge */}
          {isAuth ? (
            <div className="flex items-center gap-2.5 ml-3 px-3 py-1.5 bg-[#171717] border-2 border-neutral-700 text-xs">
              <img
                src={user?.avatar_url || 'https://avatars.githubusercontent.com/u/583231?v=4'}
                alt={user?.login}
                className="w-5.5 h-5.5 border border-white shrink-0"
              />
              <div className="text-[10.5px]">
                <div className="flex items-center gap-1 font-bold text-white">
                  <span>@{user?.login}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <span className="text-[8.5px] text-emerald-400 font-bold uppercase">CONNECTED</span>
              </div>
              <button
                onClick={onLogoutGitHub}
                title="Disconnect GitHub session"
                className="text-neutral-500 hover:text-rose-400 ml-1 p-0.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-2 ml-3 px-3 py-1.5 bg-[#171717] hover:bg-[#262626] border-2 border-cyan-500 text-xs font-bold text-cyan-400 uppercase shadow-[2px_2px_0px_0px_#06b6d4] cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              LOG IN WITH GITHUB
            </button>
          )}

          {/* Engine Status Indicator */}
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 bg-[#171717] border-2 border-[#262626] text-xs">
            <Server className={`w-3.5 h-3.5 ${engineOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="text-neutral-400">ENGINE:</span>
            <span className={`font-bold ${engineOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
              {engineOnline ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#171717] p-1 border-2 border-neutral-700 text-xs">
          <button
            onClick={() => setActiveTab('topology')}
            className={`flex items-center gap-2 px-3 py-1.5 font-bold transition-all duration-200 ease-out uppercase cursor-pointer ${
              activeTab === 'topology'
                ? 'bg-blue-600 text-white border border-white shadow-[2px_2px_0px_0px_#ffffff] scale-[1.02]'
                : 'text-neutral-400 hover:text-white hover:bg-[#262626] active:scale-95'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Topology Map
          </button>

          <button
            onClick={() => setActiveTab('monaco')}
            className={`flex items-center gap-2 px-3 py-1.5 font-bold transition-all duration-200 ease-out uppercase cursor-pointer ${
              activeTab === 'monaco'
                ? 'bg-blue-600 text-white border border-white shadow-[2px_2px_0px_0px_#ffffff] scale-[1.02]'
                : 'text-neutral-400 hover:text-white hover:bg-[#262626] active:scale-95'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            AST Diff
          </button>

          <button
            onClick={() => setActiveTab('governance')}
            className={`flex items-center gap-2 px-3 py-1.5 font-bold transition-all duration-200 ease-out uppercase cursor-pointer ${
              activeTab === 'governance'
                ? 'bg-blue-600 text-white border border-white shadow-[2px_2px_0px_0px_#ffffff] scale-[1.02]'
                : 'text-neutral-400 hover:text-white hover:bg-[#262626] active:scale-95'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Governance
          </button>

          <button
            onClick={() => setActiveTab('ir')}
            className={`flex items-center gap-2 px-3 py-1.5 font-bold transition-all duration-200 ease-out uppercase cursor-pointer ${
              activeTab === 'ir'
                ? 'bg-blue-600 text-white border border-white shadow-[2px_2px_0px_0px_#ffffff] scale-[1.02]'
                : 'text-neutral-400 hover:text-white hover:bg-[#262626] active:scale-95'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Contract IR
          </button>
        </div>

        {/* Right Side Action Controls */}
        <div className="flex items-center gap-2.5">
          
          {/* Blast Radius Toggle */}
          <button
            onClick={() => setBlastRadiusMode(!blastRadiusMode)}
            className={`h-[34px] flex items-center gap-2 px-3 text-xs font-bold border-2 transition-all uppercase cursor-pointer ${
              blastRadiusMode
                ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-[2px_2px_0px_0px_#f43f5e]'
                : 'bg-[#171717] text-neutral-400 border-neutral-700 hover:text-white shadow-[2px_2px_0px_0px_#000]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>BLAST RADIUS: {blastRadiusMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isScanning}
            className="h-[34px] w-[34px] flex items-center justify-center bg-[#171717] hover:bg-[#262626] border-2 border-neutral-700 text-neutral-300 hover:text-white shadow-[2px_2px_0px_0px_#000] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh AST state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          </button>

          {/* Analyze Microservices CTA */}
          <button
            onClick={onOpenScanModal}
            className="h-[34px] px-3.5 bg-blue-600 hover:bg-blue-500 border-2 border-white text-white text-xs font-extrabold uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#ffffff] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Analyze Microservices</span>
          </button>

        </div>

      </div>

      {/* GitHub Auth Modal Dialog */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 font-mono">
          <div className="bg-[#0a0a0a] border-2 border-white w-full max-w-md p-6 shadow-[6px_6px_0px_0px_#ffffff] space-y-4">
            
            <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 border border-white text-white font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">GITHUB AUTHENTICATION</h3>
              </div>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-neutral-400 hover:text-white text-xs font-bold uppercase cursor-pointer">✕ CLOSE</button>
            </div>

            {/* 1-Click Direct GitHub OAuth Button */}
            <button
              onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || 'Ov23liH6AZE8ReibuQmV';
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
                const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/callback/github`);
                window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user`;
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 border-2 border-white text-white text-xs font-extrabold uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#ffffff] cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              ⚡ AUTHORIZE WITH GITHUB OAUTH
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="border-t-2 border-neutral-800 w-full"></div>
              <span className="bg-[#0a0a0a] px-2 text-[9px] text-neutral-500 font-bold uppercase absolute">OR ENTER TOKEN</span>
            </div>

            {/* Token Form */}
            <form onSubmit={handleTokenSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1 uppercase flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  placeholder="ghp_... or github_pat_..."
                  value={patToken}
                  onChange={e => setPatToken(e.target.value)}
                  className="w-full bg-black border-2 border-neutral-700 px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Grants read-only access to query public & private repositories from your GitHub account.
                </p>
              </div>

              {authError && (
                <div className="bg-rose-950 border-2 border-rose-600 p-2 text-xs text-rose-300 flex items-center gap-2 font-bold uppercase">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating || !patToken.trim()}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 border-2 border-white text-white text-xs font-extrabold uppercase shadow-[2px_2px_0px_0px_#ffffff] cursor-pointer disabled:opacity-40"
              >
                {isAuthenticating ? 'AUTHENTICATING...' : 'CONNECT GITHUB TOKEN'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="border-t-2 border-neutral-800 w-full"></div>
              <span className="bg-[#0a0a0a] px-2 text-[9px] text-neutral-500 font-bold uppercase absolute">OR</span>
            </div>

            {/* Enterprise Quick OAuth Demo Login */}
            <button
              onClick={handleQuickDemoLogin}
              className="w-full py-2 bg-[#171717] hover:bg-[#262626] border-2 border-neutral-700 text-xs font-bold text-neutral-200 uppercase flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              QUICK DEMO SESSION (@alex_dev)
            </button>

          </div>
        </div>
      )}

    </header>
  );
};

export default Header;
