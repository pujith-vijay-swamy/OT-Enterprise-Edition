'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  X,
  Radio,
  Cpu,
  AlertOctagon,
  RefreshCw,
  Terminal,
  AlertCircle,
  Sparkles,
  ChevronUp,
  ChevronDown,
  History,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAudioIO } from '../hooks/useAudioIO';
import { useGeminiLive } from '../hooks/useGeminiLive';

interface ServiceEdgeData {
  id: string;
  source: string;
  target: string;
  target_path?: string;
  method?: string;
  status: string;
  confidence_tier?: string;
  verification_status?: string;
  verification_note?: string;
  ai_explanation?: string;
  issues?: string[];
}

interface ServiceNodeData {
  id: string;
  name: string;
}

interface ActivePrData {
  has_open_pr?: boolean;
  pr_number?: number;
  head_branch?: string;
  base_branch?: string;
  pr_url?: string;
}

export interface BrandVoiceAvatarProps {
  isOpen: boolean;
  onClose: () => void;
  ragContext?: {
    edges?: ServiceEdgeData[];
    services?: ServiceNodeData[];
    activePr?: ActivePrData;
  };
  breakingCount?: number;
  personaMode?: 'GUARDIAN' | 'ENFORCER';
  onTogglePersona?: () => void;
  onHighlightEdges?: (edgeIds: string[]) => void;
  onClearHighlights?: () => void;
  isEdgeNarrationActive?: boolean;
}

export const BrandVoiceAvatar: React.FC<BrandVoiceAvatarProps> = ({
  isOpen,
  onClose,
  ragContext,
  breakingCount = 0,
  personaMode = 'GUARDIAN',
  onTogglePersona,
  onHighlightEdges,
  onClearHighlights,
  isEdgeNarrationActive = false,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(false);
  const hideSubtitleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEnforcer = personaMode === 'ENFORCER';

  const hasOpenPr = Boolean(ragContext?.activePr?.has_open_pr);
  const prNumber = ragContext?.activePr?.pr_number || 0;
  const headBranch = ragContext?.activePr?.head_branch || 'main';
  const baseBranch = ragContext?.activePr?.base_branch || 'main';

  // Live refs to avoid stale closures
  const isSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  isMutedRef.current = isMuted;

  // Audio I/O Hook (Mic Capture & Audio Playback)
  const {
    isCapturing,
    isMicPermissionDenied,
    frequencyData,
    startCapture,
    stopCapture,
    playAudioChunk,
    stopPlayback,
    resetSpeechState,
  } = useAudioIO();

  // Gemini Live WebSocket & RAG Voice Engine Hook with Parallel Word-by-Word Subtitle Sync
  const {
    isConnected,
    isConnecting,
    isSpeaking,
    activeSubtitle,
    error: liveError,
    transcripts,
    connect,
    disconnect,
    sendAudioChunk,
    triggerVoiceQuery,
  } = useGeminiLive(playAudioChunk);

  isSpeakingRef.current = isSpeaking;

  // Parallel Voice-to-Subtitle Sync & Auto-Hide Lifecycle
  useEffect(() => {
    if (activeSubtitle) {
      if (hideSubtitleTimerRef.current) clearTimeout(hideSubtitleTimerRef.current);
      setIsSubtitleVisible(true);
    }
  }, [activeSubtitle]);

  useEffect(() => {
    if (!isSpeaking && activeSubtitle) {
      if (hideSubtitleTimerRef.current) clearTimeout(hideSubtitleTimerRef.current);
      // Auto-hide subtitle 3.5 seconds after speech completes
      hideSubtitleTimerRef.current = setTimeout(() => {
        setIsSubtitleVisible(false);
      }, 3500);
    }
    return () => {
      if (hideSubtitleTimerRef.current) clearTimeout(hideSubtitleTimerRef.current);
    };
  }, [isSpeaking, activeSubtitle]);

  // Extract all active breaking edges dynamically
  const activeBreakingEdges = useMemo(() => {
    const rawEdges = ragContext?.edges || [];
    return rawEdges.filter(
      (e) =>
        e.status === 'BREAKING' ||
        e.status === 'HIGH_CONFIDENCE_BREAK' ||
        e.status === 'POSSIBLE_BREAK' ||
        e.confidence_tier === 'HIGH_CONFIDENCE_BREAK' ||
        e.confidence_tier === 'POSSIBLE_BREAK' ||
        e.confidence_tier === 'BREAKING' ||
        (e.issues && e.issues.length > 0)
    );
  }, [ragContext]);

  // Construct Dynamic System Instruction RAG Context
  const formattedRagInstruction = useMemo(() => {
    let breakingDetails = '';

    if (activeBreakingEdges.length > 0) {
      breakingDetails = activeBreakingEdges
        .map(
          (e) =>
            `- Edge [${e.source} ➔ ${e.target}]: Method ${e.method || 'GET'} ${e.target_path || '/api/v1/user'}.\n  AST Issues: ${
              e.ai_explanation || (e.issues && e.issues.length > 0 ? e.issues.join('; ') : 'Breaking AST schema field mutation detected in consumer contract.')
            }`
        )
        .join('\n');
    } else {
      breakingDetails = '- All static AST boundaries healthy (0 breaking changes detected across scanned microservices).';
    }

    const servicesList = (ragContext?.services || []).map((s) => s.name).join(', ') || 'user-service, payment-gateway-service, notification-service, order-service, checkout-frontend';

    const contextSection = hasOpenPr
      ? `ACTIVE PULL REQUEST (PR #${prNumber}):
- Target Repositories: ${servicesList}
- Base Branch: ${baseBranch}
- Head Branch: ${headBranch}
- Active Breaking Contract Drifts (${activeBreakingEdges.length} detected):
${breakingDetails}
- Team Migration Policy: 'Maintain alias getters for 1 release cycle. Validate consumer AST contracts before merging.'`
      : `PRODUCTION MESH CONTEXT:
- Target Repositories: ${servicesList}
- Active Production Branch: ${baseBranch}
- Open Pull Requests: None (Production mesh is synchronized)
- Mesh AST Health: ${breakingDetails}`;

    return `You are RepoTrace AI Core Voice Assistant, an enterprise static AST boundary intelligence agent (Main Model: Gemini 2.5 Flash Native Audio / Fallback: Gemini 3 Flash Live).
Answer developer questions directly, accurately, and concisely using the real-time RAG context provided below.

${contextSection}

Persona Mode: ${
      isEnforcer
        ? 'ENFORCEMENT MODE (Strictly warn against merging breaking changes, prioritize hard blockers)'
        : 'ADVISORY MODE (Provide clear, constructive migration guidance and backward compatibility advice)'
    }

CRITICAL INSTRUCTIONS:
1. Answer the developer's specific question naturally.
2. If there are no open pull requests, talk about the overall microservice topology and health without mentioning closed PR numbers unless specifically asked.
3. If asked about breaking changes on an active open PR, explicitly list the affected endpoints and field mutations.
4. Complete every thought in 2-3 full sentences.`;
  }, [ragContext, isEnforcer, hasOpenPr, prNumber, headBranch, baseBranch, activeBreakingEdges]);

  // Handle Open Lifecycle
  useEffect(() => {
    if (isOpen) {
      connect(formattedRagInstruction);

      startCapture(
        (pcmBase64) => {
          if (!isMutedRef.current && !isSpeakingRef.current) {
            sendAudioChunk(pcmBase64);
          }
        },
        (recognizedText) => {
          if (!isMutedRef.current && !isSpeakingRef.current && recognizedText.trim()) {
            triggerVoiceQuery(recognizedText, ragContext, personaMode, 'voice');
          }
        }
      );
    } else {
      stopCapture();
      disconnect();
      stopPlayback();
      setIsDetailOpen(false);
      setIsSubtitleVisible(false);
    }

    return () => {
      stopCapture();
      disconnect();
      stopPlayback();
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    stopCapture();
    disconnect();
    stopPlayback();
    resetSpeechState();
    setIsDetailOpen(false);
    setIsSubtitleVisible(false);
    if (onClearHighlights) onClearHighlights();
    onClose();
  }, [stopCapture, disconnect, stopPlayback, resetSpeechState, onClose, onClearHighlights]);

  // Autonomous Edge Spotlight: auto-activate when Enforcer speaks about breaking changes
  useEffect(() => {
    if (isEnforcer && isSpeaking && activeBreakingEdges.length > 0 && onHighlightEdges && !isEdgeNarrationActive) {
      const breakingIds = activeBreakingEdges.map(e => e.id);
      onHighlightEdges(breakingIds);
    }
  }, [isEnforcer, isSpeaking, activeBreakingEdges, onHighlightEdges, isEdgeNarrationActive]);

  // Autonomous Return: auto-clear spotlight when speech ends
  useEffect(() => {
    if (!isSpeaking && isEdgeNarrationActive && onClearHighlights) {
      // Delay slightly so subtitle remains visible during transition
      const timer = setTimeout(() => {
        onClearHighlights();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, isEdgeNarrationActive, onClearHighlights]);

  // ESC Key Dismiss Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleQuickPrompt = (promptText: string) => {
    resetSpeechState();
    triggerVoiceQuery(promptText, ragContext, personaMode, 'voice');
  };

  if (!isOpen) return null;

  // Soundwave Reactivity Calculations
  const rawVolume = frequencyData
    ? frequencyData.reduce((acc, val) => acc + val, 0) / frequencyData.length
    : 0;

  const avgVolume = isSpeaking ? 210 : rawVolume;

  // Vibration Physics (ONLY the outer cybernetic ring vibrates on audio)
  const isVibrating = isSpeaking || avgVolume > 15;
  const vibrationIntensity = (avgVolume / 255);
  const outerRingScale = 1 + (isVibrating ? vibrationIntensity * 0.16 : 0);
  const glowOpacity = 0.6 + vibrationIntensity * 0.4;

  // Enterprise Brand Theme Styling
  const themeGlow = isEnforcer
    ? 'shadow-[0_0_80px_rgba(244,63,94,0.6)]'
    : 'shadow-[0_0_80px_rgba(6,182,212,0.6)]';
  const themeBorder = isEnforcer ? 'border-rose-500' : 'border-cyan-400';
  const themeBg = isEnforcer ? 'bg-rose-950/90' : 'bg-cyan-950/90';
  const themeText = isEnforcer ? 'text-rose-400' : 'text-cyan-400';
  const primaryBrandHex = isEnforcer ? '#f43f5e' : '#06b6d4';
  const secondaryBrandHex = isEnforcer ? '#ff0033' : '#10b981';

  // Compact Floating Mode (when edge narration is active, show mini widget over canvas)
  if (isEdgeNarrationActive) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-[340px] bg-[#0a0a0a]/95 border-2 border-rose-600 rounded-2xl p-4 shadow-[0_0_40px_rgba(244,63,94,0.3)] backdrop-blur-xl font-mono text-white animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Mini Avatar Orb */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div 
                className="absolute inset-0 rounded-full filter blur-md pointer-events-none"
                style={{
                  background: `radial-gradient(circle, rgba(244,63,94,0.6) 0%, transparent 70%)`,
                  opacity: glowOpacity,
                }}
              />
              <svg className="absolute inset-0 w-full h-full animate-[spin_6s_linear_infinite] opacity-80" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f43f5e" strokeWidth="3" strokeDasharray="10 6" />
              </svg>
              <div className="relative z-10">
                <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-rose-300 uppercase">ENFORCER ACTIVE</div>
              <div className={`text-[9px] font-bold uppercase ${
                isSpeaking ? 'text-cyan-300' : isCapturing ? 'text-emerald-300' : 'text-neutral-400'
              }`}>
                {isSpeaking ? 'NARRATING...' : isCapturing ? 'LISTENING' : 'RETURNING...'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Close */}
            <button
              onClick={handleClose}
              className="w-7 h-7 bg-neutral-800 hover:bg-rose-900 border border-neutral-600 hover:border-rose-500 rounded-full flex items-center justify-center text-neutral-300 hover:text-white cursor-pointer transition-all"
              title="Close Voice Assistant"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Live Subtitle */}
        {isSubtitleVisible && activeSubtitle ? (
          <div className="bg-black/80 border border-neutral-700 rounded-xl px-3 py-2 mb-2">
            <p className="text-[11px] font-semibold leading-relaxed text-neutral-100">
              {activeSubtitle}
            </p>
          </div>
        ) : (
          <div className="text-[10px] text-neutral-500 font-semibold mb-2">
            Spotlighting {activeBreakingEdges.length} breaking edge{activeBreakingEdges.length !== 1 ? 's' : ''} on canvas...
          </div>
        )}

        {/* Compact Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`flex-1 h-7 rounded-full text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
              isMuted
                ? 'bg-rose-950/90 border-rose-600 text-rose-300'
                : 'bg-neutral-800 border-neutral-700 text-white'
            }`}
          >
            {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-emerald-400" />}
            {isMuted ? 'MUTED' : 'MIC ON'}
          </button>
          <button
            onClick={onTogglePersona}
            className={`flex-1 h-7 rounded-full text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
              isEnforcer
                ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                : 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
            }`}
          >
            {isEnforcer ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
            {isEnforcer ? 'ENFORCER' : 'GUARDIAN'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white font-mono select-none overflow-hidden animate-in fade-in duration-300">
      
      {/* ✕ Floating Minimal Close Button (Top Right Corner Only) */}
      <button
        onClick={handleClose}
        className="fixed top-6 right-6 z-50 w-11 h-11 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 hover:border-white rounded-full flex items-center justify-center text-neutral-300 hover:text-white transition-all shadow-2xl cursor-pointer group backdrop-blur-md"
        title="Close Voice Assistant (ESC)"
      >
        <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
      </button>

      {/* Top Floating Status Pill */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1.5 bg-[#0a0a0a]/80 border border-neutral-800 rounded-full text-[10.5px] font-bold text-neutral-300 shadow-xl backdrop-blur-md">
        <Radio className={`w-3.5 h-3.5 ${themeText} animate-pulse`} />
        <span>REPOTRACE AI CORE</span>
        <span className="text-neutral-600">•</span>
        <span className="text-neutral-400 font-semibold">PR #{prNumber} ({headBranch})</span>
        <span className="text-neutral-600">•</span>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
          isSpeaking ? 'bg-cyan-950 text-cyan-300 border border-cyan-500' : isCapturing ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-neutral-800 text-neutral-400'
        }`}>
          {isSpeaking ? 'SPEAKING' : isCapturing ? 'LISTENING' : 'STANDBY'}
        </span>
      </div>

      {/* 🚀 Creative Redesigned Brand Avatar (Centered in Immersive Viewport) */}
      <div className="relative flex flex-col items-center justify-center my-auto">
        
        {/* Main Avatar Sphere Stage */}
        <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
          
          {/* Ambient Plasma Energy Field Glow */}
          <div 
            className="absolute inset-2 rounded-full filter blur-2xl pointer-events-none transition-all duration-150"
            style={{
              background: isEnforcer
                ? `radial-gradient(circle, rgba(244,63,94,0.75) 0%, rgba(136,19,55,0.25) 55%, transparent 75%)`
                : `radial-gradient(circle, rgba(6,182,212,0.75) 0%, rgba(16,185,129,0.25) 55%, transparent 75%)`,
              opacity: glowOpacity,
              transform: `scale(${1 + vibrationIntensity * 0.25})`,
            }}
          />

          {/* 💥 VIBRATING OUTER CYBERNETIC RING (Only this outer ring vibrates and ripples with voice) */}
          <div 
            className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-75"
            style={{
              transform: `scale(${outerRingScale})`,
            }}
          >
            <svg 
              className={`w-full h-full animate-[spin_10s_linear_infinite] ${
                isVibrating ? 'animate-[spin_4s_linear_infinite]' : ''
              }`} 
              viewBox="0 0 100 100"
              style={{
                transformOrigin: 'center',
                filter: isVibrating
                  ? (isEnforcer ? 'drop-shadow(0 0 12px #f43f5e)' : 'drop-shadow(0 0 12px #06b6d4)')
                  : 'none',
              }}
            >
              {/* Dashed & Notched Calibration Orbit */}
              <circle 
                cx="50" 
                cy="50" 
                r="45" 
                fill="none" 
                stroke={primaryBrandHex} 
                strokeWidth={2.5 + (isVibrating ? vibrationIntensity * 3 : 0)} 
                strokeDasharray="12 8 4 8"
                opacity={0.9} 
              />
              
              {/* 4 Cardinal Calibration Pips */}
              <circle cx="50" cy="5" r="2.5" fill={primaryBrandHex} />
              <circle cx="95" cy="50" r="2.5" fill={primaryBrandHex} />
              <circle cx="50" cy="95" r="2.5" fill={primaryBrandHex} />
              <circle cx="5" cy="50" r="2.5" fill={primaryBrandHex} />
            </svg>
          </div>

          {/* Stable Inner Counter-Rotating Hexagon Armature (Does NOT Vibrate) */}
          <svg 
            className="absolute inset-4 w-[calc(100%-32px)] h-[calc(100%-32px)] animate-[spin_6s_linear_infinite_reverse] pointer-events-none" 
            viewBox="0 0 100 100"
            style={{ transformOrigin: 'center' }}
          >
            <polygon 
              points="50,12 83,31 83,69 50,88 17,69 17,31" 
              fill="none" 
              stroke={secondaryBrandHex} 
              strokeWidth="2.5" 
              opacity="0.85" 
            />
            {/* Geometric Crosshair Alignment Nodes */}
            <line x1="50" y1="12" x2="50" y2="88" stroke={secondaryBrandHex} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.4" />
            <line x1="17" y1="31" x2="83" y2="69" stroke={secondaryBrandHex} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.4" />
          </svg>

          {/* Stable Central Quantum Neural Core (Does NOT Vibrate) */}
          <div 
            className={`relative w-32 h-32 md:w-36 md:h-36 rounded-full border-2 ${themeBorder} bg-[#040404] flex flex-col items-center justify-center p-3 z-10 overflow-hidden shadow-2xl ${themeGlow}`}
            style={{
              boxShadow: isEnforcer
                ? `0 0 ${30 + (avgVolume / 255) * 45}px rgba(244,63,94,0.95)`
                : `0 0 ${30 + (avgVolume / 255) * 45}px rgba(6,182,212,0.95)`,
            }}
          >
            {/* Core Neural Processor Iris */}
            <div className="relative z-10 flex flex-col items-center justify-center space-y-1.5">
              {isEnforcer ? (
                <AlertOctagon className="w-10 h-10 md:w-11 md:h-11 text-rose-500 animate-pulse drop-shadow-[0_0_15px_#f43f5e]" />
              ) : (
                <Cpu className="w-10 h-10 md:w-11 md:h-11 text-cyan-400 animate-pulse drop-shadow-[0_0_15px_#06b6d4]" />
              )}

              <span className={`text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 bg-black/90 border border-neutral-700 rounded-sm ${
                activeBreakingEdges.length > 0 ? 'text-rose-400 animate-pulse' : themeText
              }`}>
                {isSpeaking ? 'AI RESPONDING' : isCapturing ? 'LISTENING' : (activeBreakingEdges.length > 0 ? `${activeBreakingEdges.length} DRIFTS` : 'AST BOUNDARIES')}
              </span>
            </div>

            {/* Hologram Scanline Sweeper */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-transparent via-white/20 to-transparent pointer-events-none animate-pulse"></div>
          </div>

        </div>

        {/* 💬 Voice-Synchronized Dynamic Subtitles (Streams in exact parallel with speech) */}
        <div className="min-h-[80px] max-w-xl mx-auto flex items-center justify-center text-center mt-6 px-4">
          {isSubtitleVisible && activeSubtitle ? (
            <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#0c0c0c]/90 border border-neutral-700/80 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md">
              <p className="text-sm md:text-base font-semibold leading-relaxed text-neutral-100 tracking-wide">
                {activeSubtitle}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Ask a question about PR #{prNumber} AST boundaries...</span>
            </div>
          )}
        </div>

        {/* Quick Voice Prompt Pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap mt-2 max-w-lg">
          <button
            onClick={() => handleQuickPrompt(`What static AST contract boundaries are breaking in PR #${prNumber}?`)}
            className="px-3 py-1 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 hover:border-cyan-400 text-cyan-300 text-[11px] font-bold rounded-full cursor-pointer transition-all shadow-md flex items-center gap-1.5 backdrop-blur-sm"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>What are the breaking listed?</span>
          </button>
          <button
            onClick={() => handleQuickPrompt(`What is our team migration policy for branch ${headBranch}?`)}
            className="px-3 py-1 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 hover:border-emerald-400 text-emerald-300 text-[11px] font-bold rounded-full cursor-pointer transition-all shadow-md flex items-center gap-1.5 backdrop-blur-sm"
          >
            <span>Team Migration Policy?</span>
          </button>
        </div>

      </div>

      {/* 🎛️ Bottom Floating Action Controls */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#0a0a0a]/90 border border-neutral-800 p-2 rounded-full shadow-2xl backdrop-blur-xl">
        
        {/* Persona Mode Switch */}
        <button
          onClick={onTogglePersona}
          className={`h-9 px-3.5 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-2 cursor-pointer transition-all border ${
            isEnforcer
              ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              : 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
          }`}
          title="Toggle Persona Mode"
        >
          {isEnforcer ? <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />}
          <span>{isEnforcer ? 'ENFORCER' : 'GUARDIAN'}</span>
        </button>

        {/* Mic Toggle */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`h-9 px-3.5 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-2 cursor-pointer transition-all border ${
            isMuted
              ? 'bg-rose-950/90 border-rose-600 text-rose-300'
              : 'bg-neutral-800/90 hover:bg-neutral-700 border-neutral-700 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isMuted ? 'MUTED' : 'MIC ACTIVE'}</span>
        </button>

        {/* Detailed Transcript & Telemetry Box Toggle */}
        <button
          onClick={() => setIsDetailOpen(!isDetailOpen)}
          className={`h-9 px-3.5 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-1.5 cursor-pointer transition-all border ${
            isDetailOpen
              ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>DETAILS {transcripts.length > 0 && `(${transcripts.length})`}</span>
          {isDetailOpen ? <ChevronDown className="w-3.5 h-3.5 ml-0.5" /> : <ChevronUp className="w-3.5 h-3.5 ml-0.5" />}
        </button>

      </div>

      {/* 📜 Detailed Telemetry & Transcript Box (Slides open when Developer clicks DETAILS) */}
      {isDetailOpen && (
        <div className="fixed inset-x-4 bottom-20 max-w-2xl mx-auto z-40 bg-[#090909]/95 border-2 border-neutral-700 rounded-2xl p-5 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom-6 duration-300 text-white space-y-4">
          
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase">
              <Terminal className={`w-4 h-4 ${themeText}`} />
              <span>DETAILED CONVERSATION & AST TELEMETRY LOG</span>
            </div>
            <button
              onClick={() => setIsDetailOpen(false)}
              className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2.5 pr-2 text-xs">
            {transcripts.length === 0 ? (
              <p className="text-neutral-500 italic py-4 text-center">
                No voice queries yet. Speak or click a prompt above to generate AST telemetry.
              </p>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border ${
                    t.role === 'model'
                      ? `${themeBg} border-neutral-700 text-white`
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-1">
                    <span>{t.role === 'model' ? '🤖 REPOTRACE AI CORE' : '👤 DEVELOPER'}</span>
                    <span>{t.timestamp}</span>
                  </div>
                  <p className="leading-relaxed font-semibold">{t.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[10px] text-neutral-400">
            <span>ACTIVE AST CONTRACT DRIFTS: {activeBreakingEdges.length}</span>
            <span>MODELS: GEMINI 2.5 NATIVE AUDIO / GEMINI 3 FLASH LIVE</span>
          </div>

        </div>
      )}

      {/* Permission Denied Alert */}
      {isMicPermissionDenied && (
        <div className="fixed bottom-20 z-50 bg-rose-950 border-2 border-rose-600 px-4 py-2.5 rounded-xl text-xs text-rose-300 flex items-center gap-2 font-bold uppercase shadow-2xl">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>MICROPHONE ACCESS DENIED. PLEASE ENABLE MIC PERMISSIONS IN YOUR BROWSER.</span>
        </div>
      )}

    </div>
  );
};

export default BrandVoiceAvatar;
