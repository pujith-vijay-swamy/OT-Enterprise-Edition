'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Handle,
  Position,
  EdgeProps,
  getBezierPath,
  useNodesState,
  useEdgesState,
  NodeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ServiceNodeData, ServiceEdgeData } from '../lib/types';
import { Database, Globe, Activity, ShieldAlert, ArrowRight, X } from 'lucide-react';

const spotlightStyles = `
@keyframes spotlight-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px #f43f5e) drop-shadow(0 0 16px #f43f5e); }
  50% { filter: drop-shadow(0 0 14px #ff1744) drop-shadow(0 0 28px #ff1744) drop-shadow(0 0 40px rgba(255,23,68,0.4)); }
}
`;

interface TopologyCanvasProps {
  services: ServiceNodeData[];
  edges: ServiceEdgeData[];
  blastRadiusMode: boolean;
  highlightedEdgeIds?: string[];
  savedPositions: Record<string, { x: number; y: number }>;
  onUpdatePosition: (id: string, pos: { x: number; y: number }) => void;
  onSelectNode: (service: ServiceNodeData) => void;
  onSelectEdge: (edge: ServiceEdgeData) => void;
  onRemoveService?: (serviceId: string) => void;
  activePr?: {
    has_open_pr: boolean;
    pr_number: number;
    head_branch: string;
    base_branch: string;
    pr_url: string;
    all_prs?: any[];
  };
}

// Ultra-Brutalist Microservice Node Component
const ServiceNodeComponent = ({ data }: { data: any }) => {
  const isGhost = Boolean(data.is_ghost || data.is_ghost_pr);
  const isV2 = isGhost || Boolean(data.id?.toLowerCase().endsWith('-v2') || data.id?.toLowerCase().includes('pr-'));
  const isV1 = Boolean(data.id?.toLowerCase().endsWith('-v1') || data.is_v1_baseline);
  const isBranchNode = (isV1 || isV2) && Boolean(data.has_open_pr || isGhost);
  const prNumber = data.pr_number || (data.has_open_pr ? (data.pr_number || 0) : 0);
  const headBranch = data.head_branch || (data.has_open_pr ? (data.head_branch || 'main') : 'main');

  const isBreaking = data.health === 'BREAKING' || isGhost;
  const isWarn = data.health === 'WARN' && !isGhost;
  const isUnlinked = data.health === 'UNLINKED' && !isGhost;

  // Derive the canonical repo name (strip -v1 / -v2 suffix)
  const canonicalName = data.id.replace(/-v[12]$/i, '');

  let borderStyle = 'border-2 border-neutral-700 bg-[#0a0a0a] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)]';
  let badgeStyle = 'bg-emerald-950 text-emerald-400 border border-emerald-700 font-bold';
  let healthDotColor = 'bg-emerald-500';

  if (isGhost || isBreaking) {
    borderStyle = 'border-2 border-dashed border-rose-500 bg-[#1c0609]/95 backdrop-blur-md shadow-[0_0_25px_rgba(244,63,94,0.4)] ring-2 ring-rose-500/50';
    badgeStyle = 'bg-rose-950 text-rose-300 border border-rose-600 font-extrabold animate-pulse';
    healthDotColor = 'bg-rose-500 animate-ping';
  } else if (isWarn) {
    borderStyle = 'border-2 border-amber-600 bg-[#171105] shadow-[4px_4px_0px_0px_#f59e0b]';
    badgeStyle = 'bg-amber-950 text-amber-300 border border-amber-600 font-bold';
    healthDotColor = 'bg-amber-500';
  } else if (isUnlinked) {
    borderStyle = 'border-2 border-neutral-700 bg-[#0d0d0d] shadow-[4px_4px_0px_0px_rgba(255,255,255,0.06)]';
    badgeStyle = 'bg-[#1c1c1c] text-neutral-400 border border-neutral-700 font-bold';
    healthDotColor = 'bg-neutral-500';
  }

  let cardEffect = '';
  if (data.is_selected_blast) {
    cardEffect = 'ring-2 ring-blue-500 shadow-[4px_4px_0px_0px_#3b82f6]';
  } else if (data.is_impacted_blast) {
    cardEffect = 'ring-2 ring-rose-500 shadow-[4px_4px_0px_0px_#f43f5e]';
  }

  const isSpotlighted = Boolean(data.is_spotlighted);
  const isDimmed = Boolean(data.is_dimmed);

  let spotlightClass = '';
  if (isSpotlighted) {
    spotlightClass = 'ring-4 ring-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.8)] scale-[1.03] transition-all duration-500';
  } else if (isDimmed) {
    spotlightClass = 'opacity-20 filter blur-[0.5px] transition-all duration-500';
  }

  return (
    <div
      className={`p-4 min-w-[285px] max-w-[315px] ${borderStyle} ${cardEffect} ${spotlightClass} group relative font-mono transition-all duration-300`}
    >
      {/* Dynamic Enforcer Active Spotlight Banner */}
      {isSpotlighted && (
        <div className="w-full px-2 py-1 mb-2 bg-rose-600 border border-rose-400 text-white text-[9.5px] font-extrabold flex items-center justify-between shadow-[0_0_12px_#f43f5e] animate-pulse">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: '3s' }} />
            <span>🚨 ENFORCER SPOTLIGHT</span>
          </span>
          <span className="bg-black/50 px-1.5 py-0.5 rounded text-[8.5px] font-bold">IMPACTED</span>
        </div>
      )}

      {/* Branch Context Banner — shows this is the SAME repo on different branches */}
      {isBranchNode && (
        <div className={`w-full px-2.5 py-1.5 mb-2.5 text-[10px] font-extrabold flex items-center justify-between ${
          isV2
            ? 'bg-rose-950/90 border border-rose-600 text-rose-200 shadow-[2px_2px_0px_0px_#f43f5e]'
            : 'bg-emerald-950/90 border border-emerald-700 text-emerald-200 shadow-[2px_2px_0px_0px_#22c55e]'
        }`}>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isV2 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
            {isV2 ? (
              <>{prNumber > 0 ? `🔀 PR #${prNumber}` : `🔀 ${headBranch}`} — FEATURE BRANCH</>
            ) : (
              <>🌿 PRODUCTION — MAIN BRANCH</>
            )}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 font-mono uppercase ${
            isV2 ? 'bg-rose-900 text-white' : 'bg-emerald-900 text-emerald-100'
          }`}>
            {isV2 ? headBranch : 'main'}
          </span>
        </div>
      )}

      {/* Remove Single Service Button */}
      {data.onRemoveService && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onRemoveService(data.id);
          }}
          title="Remove microservice"
          className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-[#171717] border-2 border-neutral-500 text-neutral-300 hover:text-rose-400 hover:border-rose-600 flex items-center justify-center shadow-[2px_2px_0px_0px_#000] opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Handles on all 4 boundaries to prevent looping lines */}
      <Handle type="target" position={Position.Left} id="target-left" className="!bg-neutral-400 !w-3 !h-3 !border-2 !border-black" />
      <Handle type="target" position={Position.Top} id="target-top" className="!bg-neutral-400 !w-3 !h-3 !border-2 !border-black" />
      <Handle type="source" position={Position.Right} id="source-right" className="!bg-neutral-400 !w-3 !h-3 !border-2 !border-black" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!bg-neutral-400 !w-3 !h-3 !border-2 !border-black" />
      
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-[#171717] text-white border border-neutral-600 shrink-0 relative">
            {data.service_type === 'consumer' ? (
              <Globe className="w-4 h-4 text-cyan-400" />
            ) : (
              <Database className="w-4 h-4 text-indigo-400" />
            )}
            <span className={`absolute -top-1 -right-1 w-2 h-2 ${healthDotColor}`}></span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-extrabold text-white uppercase truncate">
                {isBranchNode ? canonicalName : data.label}
              </h3>
              {isV2 && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-600 uppercase flex items-center gap-1 shadow-[1px_1px_0px_0px_#f43f5e]">
                  🔀 {prNumber > 0 ? `PR #${prNumber}` : headBranch}
                </span>
              )}
              {isV1 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 uppercase flex items-center gap-1">
                  🌿 MAIN
                </span>
              )}
            </div>
            {isBranchNode && (
              <span className="text-[10px] text-neutral-500 font-mono">repo: {canonicalName}</span>
            )}
            {!isBranchNode && (
              <span className="text-[10px] text-neutral-400">{data.version}</span>
            )}
          </div>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase shrink-0 ${badgeStyle}`}>
          {isGhost ? 'BREAKING' : data.health}
        </span>
      </div>

      {/* Ghost PR Proposed Breaking Drifts Box */}
      {isGhost && (
        <div className="bg-black/90 p-2.5 border border-rose-800/80 text-[10.5px] font-mono space-y-1 mb-3 shadow-inner">
          <div className="font-extrabold text-rose-400 uppercase text-[9.5px] flex items-center justify-between border-b border-rose-900/80 pb-1 mb-1.5">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              Proposed Schema Drifts (4)
            </span>
            <span className="text-rose-300 font-extrabold">BLOCKED</span>
          </div>
          <div className="text-[10px] font-semibold text-rose-300 flex items-center justify-between">
            <span>• FIELD_RENAMED</span>
            <span className="text-neutral-400 font-mono">email → user_email</span>
          </div>
          <div className="text-[10px] font-semibold text-rose-300 flex items-center justify-between">
            <span>• FIELD_DELETED</span>
            <span className="text-rose-400 font-mono">is_active</span>
          </div>
          <div className="text-[10px] font-semibold text-rose-300 flex items-center justify-between">
            <span>• ROUTE_MUTATED</span>
            <span className="text-neutral-400 font-mono">/users/&#123;tenant_id&#125;</span>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 mb-3 bg-black p-2 border border-neutral-800 text-xs font-mono">
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-mono">THROUGHPUT</span>
          <span className="font-bold text-neutral-200">{data.rps} req/s</span>
        </div>
        <div>
          <span className="text-[9px] text-neutral-500 block uppercase font-mono">LATENCY</span>
          <span className="font-bold text-neutral-200">{data.latency_ms} ms</span>
        </div>
      </div>

      {/* Endpoints & Consumer Calls Count */}
      <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-2 font-mono">
        <span>ROUTES: <strong className="text-white">{data.routes_count}</strong></span>
        <span>CALLS: <strong className="text-white">{data.consumer_calls_count}</strong></span>
      </div>
    </div>
  );
};

// Ultra-Brutalist Edge Component
const CustomHealthEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.3
  });

  const status = (data?.status as string) || (data?.confidence_tier as string) || 'HEALTHY';
  const confidenceTier = (data?.confidence_tier as string) || status;

  const isHighConfidenceBreak = status === 'HIGH_CONFIDENCE_BREAK' || status === 'BREAKING' || confidenceTier === 'HIGH_CONFIDENCE_BREAK';
  const isPossibleBreak = status === 'POSSIBLE_BREAK' || status === 'WARN' || confidenceTier === 'POSSIBLE_BREAK';

  let strokeColor = '#22c55e'; // Green
  let strokeDash = 'none';
  let badgeStyle = 'bg-black text-neutral-200 border-neutral-700';

  if (isHighConfidenceBreak) {
    strokeColor = '#f43f5e'; // Rose
    strokeDash = '6 4';
    badgeStyle = 'bg-rose-950 text-rose-300 border-rose-600 font-extrabold shadow-[2px_2px_0px_0px_#f43f5e]';
  } else if (isPossibleBreak) {
    strokeColor = '#f59e0b'; // Amber
    strokeDash = '4 4';
    badgeStyle = 'bg-amber-950 text-amber-300 border-amber-600 font-bold shadow-[2px_2px_0px_0px_#f59e0b]';
  }

  const labelText = data?.endpoint_count && (data.endpoint_count as number) > 1
    ? `${data.endpoint_count} CALLS LINKED`
    : `${String(data?.method || 'GET')} ${String(data?.target_path || '')}`;

  const tierBadgeText = isHighConfidenceBreak
    ? ' [HIGH CONFIDENCE BREAK]'
    : isPossibleBreak
    ? ' [POSSIBLE BREAK]'
    : '';

  const isSpotlighted = Boolean(data?.isSpotlighted);
  const isDimmed = Boolean(data?.isDimmed);

  return (
    <g style={{ opacity: isDimmed ? 0.12 : 1, transition: 'opacity 0.5s ease' }}>
      <path
        id={id}
        style={{
          ...style,
          stroke: isSpotlighted ? '#ff1744' : strokeColor,
          strokeWidth: isSpotlighted ? 4 : (isHighConfidenceBreak ? 2.5 : 2),
          strokeDasharray: strokeDash,
          animation: isSpotlighted ? 'dash 0.6s linear infinite, spotlight-pulse 1.5s ease-in-out infinite' : (isHighConfidenceBreak ? 'dash 1s linear infinite' : 'none'),
          filter: isSpotlighted ? 'drop-shadow(0 0 8px #f43f5e) drop-shadow(0 0 16px #f43f5e)' : undefined
        }}
        className="react-flow__edge-path cursor-pointer hover:stroke-width-4 transition-all"
        d={edgePath}
        markerEnd={markerEnd}
      />

      {/* Label Badge on Edge */}
      {Boolean(data?.target_path) && (
        <foreignObject
          width={280}
          height={34}
          x={(sourceX + targetX) / 2 - 140}
          y={(sourceY + targetY) / 2 - 17}
          className="overflow-visible pointer-events-auto"
        >
          <div
            className={`text-[10px] font-mono px-2.5 py-1 border-2 text-center truncate cursor-pointer transition-all hover:scale-105 uppercase font-bold ${badgeStyle} ${isSpotlighted ? 'ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]' : 'shadow-[2px_2px_0px_0px_#000]'}`}
          >
            {labelText}{tierBadgeText}
          </div>
        </foreignObject>
      )}
    </g>
  );
};

const nodeTypes = { serviceNode: ServiceNodeComponent };
const edgeTypes = { healthEdge: CustomHealthEdge };

// Dynamic Auto-Layout Algorithm for Clean 3-Tier Enterprise Microservice Mesh Layout
function calculateAutoLayout(
  services: ServiceNodeData[],
  savedPositions?: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  
  let consumerRow = 0;
  let fullstackRow = 0;
  let producerRow = 0;

  const CONSUMER_X = 60;
  const FULLSTACK_X = 520;
  const PRODUCER_X = 980;

  const Y_START = 80;
  const Y_STEP = 360;

  services.forEach((s, idx) => {
    // If user saved a custom dragged coordinate, preserve it
    if (savedPositions && savedPositions[s.id] && savedPositions[s.id].x > 0 && savedPositions[s.id].y > 0) {
      positions[s.id] = savedPositions[s.id];
      return;
    }

    const isGhost = Boolean(s.is_ghost || s.is_ghost_pr || s.id.toLowerCase().includes('-v2'));
    const isConsumer = s.service_type === 'consumer' || ((s.consumer_calls_count || 0) > 0 && (s.routes_count || 0) === 0);
    const isFullstack = s.service_type === 'fullstack' || ((s.consumer_calls_count || 0) > 0 && (s.routes_count || 0) > 0);

    if (isGhost) {
      positions[s.id] = { x: PRODUCER_X, y: Y_START + Math.max(producerRow, 1) * Y_STEP };
      producerRow += 1;
    } else if (isConsumer) {
      positions[s.id] = { x: CONSUMER_X, y: Y_START + consumerRow * Y_STEP };
      consumerRow += 1;
    } else if (isFullstack) {
      positions[s.id] = { x: FULLSTACK_X, y: Y_START + fullstackRow * Y_STEP };
      fullstackRow += 1;
    } else {
      positions[s.id] = { x: PRODUCER_X, y: Y_START + producerRow * Y_STEP };
      producerRow += 1;
    }
  });

  return positions;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  services,
  edges,
  blastRadiusMode,
  highlightedEdgeIds,
  savedPositions,
  onUpdatePosition,
  onSelectNode,
  onSelectEdge,
  onRemoveService,
  activePr
}) => {
  const [selectedBlastSourceId, setSelectedBlastSourceId] = useState<string | null>(services[0]?.id || null);
  const [activeSelectedEdge, setActiveSelectedEdge] = useState<ServiceEdgeData | null>(null);

  // Track canvas movement to show MiniMap ONLY while panning / moving nodes / zooming
  const [isCanvasMoving, setIsCanvasMoving] = useState<boolean>(false);
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMove = useCallback(() => {
    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    setIsCanvasMoving(true);
    moveTimerRef.current = setTimeout(() => {
      setIsCanvasMoving(false);
    }, 1200);
  }, []);

  const handleMoveStart = useCallback(() => {
    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    setIsCanvasMoving(true);
  }, []);

  const handleMoveEnd = useCallback(() => {
    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    moveTimerRef.current = setTimeout(() => {
      setIsCanvasMoving(false);
    }, 1200);
  }, []);

  // Compute dynamic health status for each service based on connected edge statuses
  const servicesWithDynamicHealth: ServiceNodeData[] = useMemo(() => {
    return services.map(s => {
      const connectedEdges = edges.filter(e => e.source === s.id || e.target === s.id);
      const hasBreaking = connectedEdges.some(e => 
        e.status === 'BREAKING' || e.status === 'HIGH_CONFIDENCE_BREAK' || e.confidence_tier === 'HIGH_CONFIDENCE_BREAK'
      );

      const hasWarn = connectedEdges.some(e => 
        e.status === 'WARN' || e.status === 'POSSIBLE_BREAK' || e.confidence_tier === 'POSSIBLE_BREAK'
      );

      let health: 'HEALTHY' | 'WARN' | 'BREAKING' | 'UNLINKED' = s.health || 'HEALTHY';
      if (hasBreaking) {
        health = 'BREAKING';
      } else if (hasWarn) {
        health = 'WARN';
      } else if (connectedEdges.length === 0 && edges.length > 0) {
        // ONLY mark UNLINKED if edges have loaded and this standalone service has 0 mesh connections!
        health = 'UNLINKED';
      } else {
        health = s.health || 'HEALTHY';
      }

      return {
        ...s,
        health
      };
    });
  }, [services, edges]);

  // Compute blast radius downstream impacted services recursively
  const impactedServiceIds = useMemo(() => {
    if (!blastRadiusMode || !selectedBlastSourceId) return new Set<string>();

    const impacted = new Set<string>();
    const queue = [selectedBlastSourceId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const consumers = edges.filter(e => e.target === current).map(e => e.source);
      for (const consumer of consumers) {
        if (!impacted.has(consumer)) {
          impacted.add(consumer);
          queue.push(consumer);
        }
      }
    }

    return impacted;
  }, [blastRadiusMode, selectedBlastSourceId, edges]);

  // Dynamic layout grid positions with zero overlapping
  const autoLayoutPositions: Record<string, { x: number; y: number }> = useMemo(() => {
    return calculateAutoLayout(servicesWithDynamicHealth, savedPositions);
  }, [servicesWithDynamicHealth, savedPositions]);

  const validServiceIds = useMemo(() => new Set(servicesWithDynamicHealth.map(s => s.id)), [servicesWithDynamicHealth]);

  // Clean, Deduplicated Edges to prevent tangled lines
  const initialEdges: Edge[] = useMemo(() => {
    const validEdges = edges.filter(e => validServiceIds.has(e.source) && validServiceIds.has(e.target));
    
    const pairGroups = new Map<string, ServiceEdgeData[]>();
    validEdges.forEach(e => {
      const key = `${e.source}->${e.target}`;
      if (!pairGroups.has(key)) pairGroups.set(key, []);
      pairGroups.get(key)!.push(e);
    });

    const consolidated: Edge[] = [];
    pairGroups.forEach((groupEdges, key) => {
      const primary = groupEdges[0];
      const hasBreaking = groupEdges.some(e => 
        e.status === 'BREAKING' || e.status === 'HIGH_CONFIDENCE_BREAK' || e.confidence_tier === 'HIGH_CONFIDENCE_BREAK'
      );

      const hasWarn = groupEdges.some(e => 
        e.status === 'WARN' || e.status === 'POSSIBLE_BREAK' || e.confidence_tier === 'POSSIBLE_BREAK'
      );
      
      let status: 'HEALTHY' | 'WARN' | 'BREAKING' = 'HEALTHY';
      if (hasBreaking) status = 'BREAKING';
      else if (hasWarn) status = 'WARN';

      const hasHighlights = highlightedEdgeIds && highlightedEdgeIds.length > 0;

      consolidated.push({
        id: `consolidated-${key}`,
        source: primary.source,
        target: primary.target,
        type: 'healthEdge',
        data: {
          raw_edge: primary,
          status: hasBreaking ? 'HIGH_CONFIDENCE_BREAK' : (hasWarn ? 'POSSIBLE_BREAK' : status),
          confidence_tier: hasBreaking ? 'HIGH_CONFIDENCE_BREAK' : (hasWarn ? 'POSSIBLE_BREAK' : 'HEALTHY'),
          target_path: primary.target_path,
          method: primary.method,
          endpoint_count: groupEdges.length,
          issues: groupEdges.flatMap(e => e.issues || []),
          isSpotlighted: hasHighlights && highlightedEdgeIds.some(hid => 
            groupEdges.some(ge => ge.id === hid)
          ),
          isDimmed: hasHighlights && !highlightedEdgeIds.some(hid => 
            groupEdges.some(ge => ge.id === hid)
          )
        }
      });
    });

    return consolidated;
  }, [edges, validServiceIds, highlightedEdgeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Keep edgesState updated immediately when edges prop changes
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Identify all services impacted by the highlighted breaking edges (for node spotlight)
  const spotlightServiceIds = useMemo(() => {
    if (!highlightedEdgeIds || highlightedEdgeIds.length === 0) return new Set<string>();
    const set = new Set<string>();
    edges.forEach(e => {
      if (highlightedEdgeIds.includes(e.id)) {
        set.add(e.source);
        set.add(e.target);
      }
    });
    // Also include any node marked BREAKING
    servicesWithDynamicHealth.forEach(s => {
      if (s.health === 'BREAKING') {
        set.add(s.id);
      }
    });
    return set;
  }, [highlightedEdgeIds, edges, servicesWithDynamicHealth]);

  const hasEdgeHighlights = Boolean(highlightedEdgeIds && highlightedEdgeIds.length > 0);

  // Smoothly sync nodes state while preserving ReactFlow's initialized node objects & measured dimensions
  useEffect(() => {
    setNodes(prevNodes => {
      const prevMap = new Map(prevNodes.map(n => [n.id, n]));

      return servicesWithDynamicHealth.map((s, idx) => {
        const existing = prevMap.get(s.id);
        const isSelectedBlast = blastRadiusMode && s.id === selectedBlastSourceId;
        const isImpactedBlast = blastRadiusMode && impactedServiceIds.has(s.id);
        const isSpotlightedNode = hasEdgeHighlights && spotlightServiceIds.has(s.id);
        const isDimmedNode = hasEdgeHighlights && !spotlightServiceIds.has(s.id);

        const pos = (savedPositions && savedPositions[s.id]) || existing?.position || autoLayoutPositions[s.id] || {
          x: s.service_type === 'consumer' ? 60 : (s.service_type === 'fullstack' ? 520 : 980),
          y: 80 + idx * 360
        };

        return {
          id: s.id,
          type: 'serviceNode',
          position: pos,
          data: {
            ...s,
            is_spotlighted: isSpotlightedNode,
            is_dimmed: isDimmedNode,
            is_selected_blast: isSelectedBlast,
            is_impacted_blast: isImpactedBlast,
            onRemoveService,
            has_open_pr: Boolean(activePr ? activePr.has_open_pr : false),
            pr_number: activePr?.pr_number || 0,
            head_branch: activePr?.head_branch || 'main'
          }
        };
      });
    });
  }, [servicesWithDynamicHealth, savedPositions, autoLayoutPositions, blastRadiusMode, selectedBlastSourceId, impactedServiceIds, onRemoveService, setNodes, activePr, hasEdgeHighlights, spotlightServiceIds]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const service = servicesWithDynamicHealth.find(s => s.id === node.id);
      if (service) {
        if (blastRadiusMode) {
          setSelectedBlastSourceId(node.id);
        }
        if (onSelectNode) {
          onSelectNode(service);
        }
      }
    },
    [servicesWithDynamicHealth, blastRadiusMode, onSelectNode]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const edgeData = edge.data?.raw_edge as ServiceEdgeData;
      if (edgeData) {
        setActiveSelectedEdge(edgeData);
        if (onSelectEdge) onSelectEdge(edgeData);
      }
    },
    [onSelectEdge]
  );

  const selectedSourceService = servicesWithDynamicHealth.find(s => s.id === selectedBlastSourceId);
  const impactedCount = impactedServiceIds.size;
  const totalImpactedRps = Array.from(impactedServiceIds).reduce((acc, id) => {
    const s = servicesWithDynamicHealth.find(srv => srv.id === id);
    return acc + (s?.rps || 0);
  }, 0);

  return (
    <div className="relative w-full h-[calc(100vh-140px)] border-2 border-[#262626] overflow-hidden bg-[#050505] brutal-card">
      
      {highlightedEdgeIds && highlightedEdgeIds.length > 0 && (
        <style dangerouslySetInnerHTML={{ __html: spotlightStyles }} />
      )}

      {/* Top Banner overlay for Blast Radius Mode */}
      {blastRadiusMode && (
        <div className="absolute top-4 left-4 z-20 bg-[#0a0a0a] border-2 border-rose-600 p-4 shadow-[4px_4px_0px_0px_#f43f5e] max-w-sm font-mono">
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">BLAST RADIUS SIMULATOR ACTIVE</h4>
          </div>
          <p className="text-[11px] text-neutral-400 mb-3 leading-relaxed">
            Click any service node to trace downstream breaking impact across consumers.
          </p>

          {selectedSourceService && (
            <div className="bg-black p-2.5 border border-neutral-800 text-xs space-y-1">
              <div className="text-blue-400 font-bold">Selected Upstream: {selectedSourceService.label}</div>
              <div className="flex items-center justify-between text-neutral-300">
                <span>Downstream Apps Impacted:</span>
                <strong className="text-rose-400">{impactedCount} services</strong>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span>Impacted Traffic:</span>
                <strong className="text-rose-400">{totalImpactedRps} req/s</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Edge Inspector Modal */}
      {activeSelectedEdge && (
        <div className="absolute top-4 right-4 z-30 bg-[#0a0a0a] border-2 border-white p-4 shadow-[6px_6px_0px_0px_#ffffff] max-w-md space-y-3 font-mono">
          <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span>{activeSelectedEdge.source}</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
              <span>{activeSelectedEdge.target}</span>
            </div>
            <button onClick={() => setActiveSelectedEdge(null)} className="text-neutral-400 hover:text-white font-bold">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black p-2.5 border border-neutral-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">ENDPOINT:</span>
              <span className="text-blue-400 font-bold">{activeSelectedEdge.method} {activeSelectedEdge.target_path}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">CONTRACT HEALTH:</span>
              <span className={`font-bold ${activeSelectedEdge.status === 'BREAKING' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {activeSelectedEdge.status}
              </span>
            </div>
          </div>

          {activeSelectedEdge.issues && activeSelectedEdge.issues.length > 0 && (
            <div className="bg-rose-950 p-2.5 border border-rose-600 text-xs text-rose-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 uppercase">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Detected Contract Drifts:
              </div>
              {activeSelectedEdge.issues.map((issue, idx) => (
                <div key={idx} className="text-[11px] text-rose-300">• {issue}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Draggable React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMove={handleMove}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
        onNodeDrag={handleMove}
        onNodeDragStart={handleMoveStart}
        onNodeDragStop={(_, node) => {
          handleMoveEnd();
          if (onUpdatePosition && node?.id && node?.position) {
            onUpdatePosition(node.id, node.position);
          }
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
      >
        <Background color="#262626" gap={24} size={1.5} />
        <Controls />
        <MiniMap
          nodeColor={node => {
            const data = node.data as ServiceNodeData;
            if (data?.health === 'BREAKING') return '#f43f5e';
            if (data?.health === 'WARN') return '#f59e0b';
            return '#22c55e';
          }}
          maskColor="rgba(5, 5, 5, 0.85)"
          className={`!bg-[#0a0a0a] !border-2 !border-neutral-700 shadow-[4px_4px_0px_0px_#000] transition-all duration-500 ease-in-out ${
            isCanvasMoving ? '!opacity-100 !scale-100' : '!opacity-0 !scale-90 !pointer-events-none'
          }`}
        />
      </ReactFlow>

      {/* Minimal Legend Footer — Centered horizontally at the bottom of the canvas */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-[#0a0a0a] border-2 border-neutral-700 px-5 py-2 text-xs flex items-center gap-6 font-mono shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-emerald-500 border border-white"></span>
          <span className="text-white font-bold uppercase">Healthy Link</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-amber-500 border border-white"></span>
          <span className="text-white font-bold uppercase">Warning Link</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-rose-500 border border-white animate-ping"></span>
          <span className="text-white font-bold uppercase">Breaking Drift</span>
        </div>
      </div>
    </div>
  );
};

export default TopologyCanvas;
