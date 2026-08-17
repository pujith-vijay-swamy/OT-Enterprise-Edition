'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, AlertOctagon } from 'lucide-react';
import BrandVoiceAvatar from './BrandVoiceAvatar';

interface JarvisLogoProps {
  breakingCount?: number;
  engineOnline?: boolean;
  onRefreshMesh?: () => void;
  ragContext?: {
    edges?: any[];
    services?: any[];
    activePr?: any;
  };
  onHighlightEdges?: (edgeIds: string[]) => void;
  onClearHighlights?: () => void;
  isEdgeNarrationActive?: boolean;
}

export const JarvisLogo: React.FC<JarvisLogoProps> = ({
  breakingCount = 0,
  engineOnline = true,
  onRefreshMesh,
  ragContext,
  onHighlightEdges,
  onClearHighlights,
  isEdgeNarrationActive,
}) => {
  // Voice Persona Mode: 'GUARDIAN' (Default normal mode) or 'ENFORCER' (Triggered on breaking changes)
  const [personaMode, setPersonaMode] = useState<'GUARDIAN' | 'ENFORCER'>('GUARDIAN');
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);

  // Auto-adapt persona mode based on real-time mesh contract health:
  // Normal state (0 breaking drifts) -> GUARDIAN
  // Any breaking drifts detected (> 0) -> ENFORCER
  useEffect(() => {
    if (breakingCount > 0) {
      setPersonaMode('ENFORCER');
    } else {
      setPersonaMode('GUARDIAN');
    }
  }, [breakingCount]);

  const togglePersona = () => {
    setPersonaMode((prev) => (prev === 'GUARDIAN' ? 'ENFORCER' : 'GUARDIAN'));
  };

  const isEnforcer = personaMode === 'ENFORCER';

  return (
    <div className="relative font-mono flex items-center">
      
      {/* Brand Logo & Neural Arc Reactor */}
      <div 
        onClick={() => setIsVoiceOverlayOpen(true)}
        className="flex items-center gap-3 cursor-pointer group select-none"
        title="Click to launch RepoTrace Interactive Live Voice Assistant"
      >
        {/* Animated Sci-Fi AI Core Arc Reactor (Border-free clean container) */}
        <div className="relative w-9 h-9 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 shrink-0">
          
          {/* Rotating Outer Cybernetic Ring */}
          <svg className="absolute inset-0 w-full h-full animate-[spin_8s_linear_infinite] opacity-70" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke={isEnforcer ? '#f43f5e' : '#06b6d4'} strokeWidth="3" strokeDasharray="12 8 4 8" />
          </svg>

          {/* Counter-Rotating Inner Hexagon Ring */}
          <svg className="absolute inset-0 w-full h-full animate-[spin_5s_linear_infinite_reverse] opacity-80" viewBox="0 0 100 100">
            <polygon points="50,12 83,31 83,69 50,88 17,69 17,31" fill="none" stroke={isEnforcer ? '#ff0033' : '#10b981'} strokeWidth="2.5" />
          </svg>

          {/* Central Pulsing AI Core Iris */}
          <div className="relative z-10 flex items-center justify-center">
            {isEnforcer ? (
              <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse drop-shadow-[0_0_8px_#f43f5e]" />
            ) : (
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse drop-shadow-[0_0_8px_#06b6d4]" />
            )}
          </div>

          {/* Hologram Scanline Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none animate-pulse"></div>
        </div>

        {/* Brand Text & Status Badges */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider uppercase text-white">
              REPOTRACE
            </h1>
            <span className="text-[9.5px] font-bold px-2 py-0.5 bg-[#171717] text-cyan-400 border border-[#404040]">
              ENTERPRISE v2.4
            </span>

            {/* Live Frequency Equalizer Bars */}
            <div className="hidden sm:flex items-center gap-0.5 h-3.5 px-1 bg-black/80 border border-neutral-800">
              <span className={`w-0.5 bg-cyan-400 animate-[bounce_0.6s_infinite] ${isEnforcer ? '!bg-rose-500' : ''}`} style={{ height: '80%' }}></span>
              <span className={`w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_0.1s] ${isEnforcer ? '!bg-rose-400' : ''}`} style={{ height: '100%' }}></span>
              <span className={`w-0.5 bg-cyan-400 animate-[bounce_0.5s_infinite_0.2s] ${isEnforcer ? '!bg-rose-500' : ''}`} style={{ height: '40%' }}></span>
              <span className={`w-0.5 bg-indigo-400 animate-[bounce_0.7s_infinite_0.3s] ${isEnforcer ? '!bg-rose-600' : ''}`} style={{ height: '90%' }}></span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10.5px] text-neutral-400 font-bold uppercase tracking-wide">
              STATIC AST BOUNDARY OBSERVABILITY
            </p>
            <span className="text-[9px] text-neutral-600">|</span>
            <span className={`text-[9.5px] font-extrabold uppercase flex items-center gap-1 ${
              breakingCount > 0 ? 'text-rose-400 animate-pulse' : (isEnforcer ? 'text-rose-300' : 'text-emerald-400')
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${breakingCount > 0 ? 'bg-rose-500 animate-ping' : (isEnforcer ? 'bg-rose-500' : 'bg-emerald-400')}`}></span>
              {breakingCount > 0 ? `${breakingCount} DRIFT VIOLATIONS` : 'MESH NOMINAL'}
            </span>
          </div>
        </div>

      </div>

      {/* Interactive OmniTrace Voice Avatar Modal Overlay */}
      <BrandVoiceAvatar
        isOpen={isVoiceOverlayOpen}
        onClose={() => setIsVoiceOverlayOpen(false)}
        ragContext={ragContext}
        breakingCount={breakingCount}
        personaMode={personaMode}
        onTogglePersona={togglePersona}
        onHighlightEdges={onHighlightEdges}
        onClearHighlights={onClearHighlights}
        isEdgeNarrationActive={isEdgeNarrationActive}
      />

    </div>
  );
};

export default JarvisLogo;
