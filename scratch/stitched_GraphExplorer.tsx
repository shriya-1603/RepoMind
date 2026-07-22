import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search, GitBranch,
  ChevronLeft, ChevronRight, Binary, Loader2,
  Database, RefreshCw, WifiOff, Map as MapIcon, Layers,
} from 'lucide-react';

import CustomNode from '../components/CustomNode';
import CustomEdge from '../components/CustomEdge';
import RealGraphNodeComponent, { realNodeTypeConfig } from '../components/RealGraphNode';
import SubsystemNode from '../components/SubsystemNode';
import NodeDetailsPanel from '../components/NodeDetailsPanel';
import SubsystemDetailsPanel from '../components/SubsystemDetailsPanel';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { ExplorerHeader } from '../components/ExplorerHeader';
import type { NavPathItem } from '../components/ExplorerHeader';
import { SystemMinimap } from '../components/SystemMinimap';

import { mockFileNodes, mockDependencyEdges, mockASTData } from '../data/mockRepositoryData';
import type { FileNode, ASTNode } from '../data/mockRepositoryData';
import { useRealGraphData } from '../hooks/useRealGraphData';
import type { RealGraphNode, RealGraphEdge, RepositoryActivityData, RecentCommit } from '../services/repoApi';
import { getRepositoryActivity } from '../services/repoApi';
import { useRepo } from '../contexts/RepoContext';

import { useExplorerState } from '../hooks/useExplorerState';
import { useExplorerLayout } from '../hooks/useExplorerLayout';
import { useExplorerCamera } from '../hooks/useExplorerCamera';
import { ExplorerContext } from '../contexts/ExplorerContext';

// ── React Flow node/edge type registrations ───────────────────────────────────
const nodeTypes = {
  customNode: CustomNode,
  realNode: RealGraphNodeComponent,
  subsystemNode: SubsystemNode,
};
const edgeTypes = { customEdge: CustomEdge };


// ── AST Tree View (unchanged) ─────────────────────────────────────────────────
const ASTTreeView: React.FC<{
  node: ASTNode;
  depth?: number;
  onHover: (n: ASTNode | null) => void;
  hoveredNode: ASTNode | null;
}> = ({ node, depth = 0, onHover, hoveredNode }) => {
  const [isOpen, setIsOpen] = useState(true);
  const isHovered = hoveredNode === node;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col font-mono text-[10px]" style={{ paddingLeft: depth ? '12px' : '0px' }}>
      <div
        onMouseEnter={() => onHover(node)}
        onMouseLeave={() => onHover(null)}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 py-1 px-1.5 rounded transition-colors cursor-crosshair ${
          isHovered ? 'bg-[#FF4500]/10 text-[#FF6F61]' : 'text-slate-400 hover:text-slate-300'
        }`}
      >
        {hasChildren && (
          <span className={`text-[8px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
        )}
        <span className="text-[#FF6F61] font-semibold">{node.type}</span>
        {node.name && (
          <>
            <span className="text-slate-655">:</span>
            <span className="text-[#DAA520] truncate max-w-[100px]">{node.name}</span>
          </>
        )}
        <span className="text-slate-700 ml-auto">L{node.range[0]}-{node.range[1]}</span>
      </div>
      {hasChildren && isOpen && (
        <div className="border-l border-white/5 ml-2 mt-0.5 space-y-0.5">
          {node.children!.map((child, idx) => (
            <ASTTreeView
              key={idx}
              node={child}
              depth={depth + 1}
              onHover={onHover}
              hoveredNode={hoveredNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Code Inspector Panel (unchanged) ──────────────────────────────────────────
const CodeInspector: React.FC<{ node: FileNode; onClose: () => void }> = ({ node, onClose }) => {
  const typeColors: Record<string, string> = {
    component: '#FF6F61', hook: '#DAA520', util: '#F5E8D8',
    type: '#FF4500', context: '#FF8C00', api: '#FFA500', page: '#FFA07A', config: '#94a3b8',
  };
  const color = typeColors[node.type] || '#FF4500';

  const [activeTab, setActiveTab] = useState<'preview' | 'ast'>('preview');
  const [isGeneratingAst, setIsGeneratingAst] = useState(false);
  const [generatedAst, setGeneratedAst] = useState<ASTNode | null>(null);
  const [hoveredAstNode, setHoveredAstNode] = useState<ASTNode | null>(null);

  const astData = mockASTData[node.id] || generatedAst;

  const triggerAstGeneration = () => {
    setIsGeneratingAst(true);
    setTimeout(() => {
      const mockDynamicAst: ASTNode = {
        name: node.name,
        type: 'Program',
        range: [1, Math.min(25, node.linesOfCode)],
        children: [
          { name: `import * from './types'`, type: 'ImportDeclaration', range: [1, 1] },
          { name: node.name.split('.')[0], type: 'ExportNamedDeclaration', range: [3, Math.min(18, node.linesOfCode)] },
          { name: `default`, type: 'ExportDefaultDeclaration', range: [Math.min(19, node.linesOfCode), Math.min(25, node.linesOfCode)] }
        ]
      };
      setGeneratedAst(mockDynamicAst);
      setIsGeneratingAst(false);
    }, 1200);
  };

  useEffect(() => {
    setGeneratedAst(null);
    setHoveredAstNode(null);
    setActiveTab('preview');
  }, [node]);

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="absolute right-0 top-0 h-full w-80 glass border-l border-white/15 flex flex-col z-20 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/12 bg-white/[0.03]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="font-mono text-xs font-semibold text-slate-200 truncate">{node.name}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors p-1">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 border-b border-white/12 bg-white/[0.03]">
        <button
          onClick={() => setActiveTab('preview')}
          className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border-b-2 ${
            activeTab === 'preview' ? 'border-[#FF4500] text-[#FF6F61] bg-white/[0.01]' : 'border-transparent text-slate-600 hover:text-slate-400'
          }`}
        >
          <Code2 size={11} /> Source Preview
        </button>
        <button
          onClick={() => setActiveTab('ast')}
          className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border-b-2 ${
            activeTab === 'ast' ? 'border-[#FF4500] text-[#FF6F61] bg-white/[0.01]' : 'border-transparent text-slate-600 hover:text-slate-400'
          }`}
        >
          <Binary size={11} /> Visual AST
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'preview' ? (
          <>
            <div>
              <div className="text-[10px] text-slate-655 uppercase tracking-widest mb-1 font-bold">File Path</div>
              <div className="font-mono text-xs text-slate-400 bg-white/3 rounded-lg p-2.5 break-all border border-white/12">{node.path}</div>
            </div>

            <div>
              <div className="text-[10px] text-slate-655 uppercase tracking-widest mb-1 font-bold">Description</div>
              <p className="text-xs text-slate-400 leading-relaxed font-light">{node.description}</p>
            </div>

            <div>
              <div className="text-[10px] text-slate-655 uppercase tracking-widest mb-2 font-bold">Metrics</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Lines', value: node.linesOfCode, icon: FileCode },
                  { label: 'Complexity', value: node.complexity, icon: AlertTriangle },
                  { label: 'Imports', value: node.importCount, icon: Download },
                  { label: 'Exports', value: node.exportCount, icon: Upload },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="glass rounded-xl p-2.5 flex items-center gap-2 border border-white/12 bg-white/[0.03]">
                    <Icon size={12} className="text-slate-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-slate-200 font-mono">{value}</div>
                      <div className="text-[9px] text-slate-500 font-semibold">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-655 uppercase tracking-widest mb-2 font-bold">Exports</div>
              <div className="space-y-1">
                {node.exports.map(exp => (
                  <div key={exp} className="flex items-center gap-2 text-xs font-mono" style={{ color }}>
                    <ChevronRight size={10} />
                    {exp}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-655 uppercase tracking-widest mb-2 font-bold">Source Preview</div>
              <div className="glass rounded-xl p-3 border border-white/12 bg-black/10 overflow-hidden">
                <pre className="text-[10px] font-mono text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                  {node.sourcePreview}
                </pre>
              </div>
            </div>

            {node.blastRadius.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-655 uppercase tracking-widest mb-2 flex items-center gap-1 font-bold">
                  <Layers size={9} />
                  Blast Radius
                  <span className="badge badge-red ml-1 text-[9px]">{node.blastRadius.length} files</span>
                </div>
                <div className="space-y-1">
                  {node.blastRadius.map(id => {
                    const dep = mockFileNodes.find(n => n.id === id);
                    return dep ? (
                      <div key={id} className="text-xs font-mono text-rose-450/80 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        {dep.name}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-white/12">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Last modified</span>
                <span>{node.lastModified}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-slate-655 uppercase tracking-widest mb-1 font-bold">AST Parser</div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Explore the Abstract Syntax Tree parsed from this file's AST tokens. Hover nodes to view target line numbers.
              </p>
            </div>

            {isGeneratingAst ? (
              <div className="glass rounded-xl py-12 flex flex-col items-center justify-center gap-3 border border-white/12">
                <Loader2 size={20} className="text-[#FF4500] animate-spin" />
                <span className="text-[11px] font-mono text-slate-500">Parsing AST tokens...</span>
              </div>
            ) : astData ? (
              <div className="glass rounded-xl p-3 border border-white/12 bg-black/10 overflow-x-auto space-y-1">
                <ASTTreeView
                  node={astData}
                  onHover={setHoveredAstNode}
                  hoveredNode={hoveredAstNode}
                />
              </div>
            ) : (
              <div className="glass rounded-xl p-4 text-center space-y-3 border border-white/12">
                <div className="text-xs text-slate-400">AST representation not yet cached.</div>
                <button
                  onClick={triggerAstGeneration}
                  className="w-full py-2.5 bg-[#FF4500]/80 hover:bg-[#FF4500] text-white rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Binary size={12} /> Compile AST with LLM
                </button>
              </div>
            )}

            {hoveredAstNode && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-3 border border-[#FF4500]/20 bg-[#FF4500]/10 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[9px] text-[#FF6F61] font-mono">
                  <span>Target Code</span>
                  <span>Lines {hoveredAstNode.range[0]}-{hoveredAstNode.range[1]}</span>
                </div>
                <pre className="text-[10px] font-mono text-slate-300 bg-black/20 p-2 rounded leading-relaxed select-none overflow-x-auto">
                  {node.sourcePreview.split('\n')
                    .slice(hoveredAstNode.range[0] - 1, hoveredAstNode.range[1])
                    .join('\n') || `// Code block at lines ${hoveredAstNode.range[0]}-${hoveredAstNode.range[1]}`}
                </pre>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ── Loading overlays ──────────────────────────────────────────────────────────
const GraphLoadingOverlay: React.FC = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl px-8 py-6 border border-white/8 flex flex-col items-center gap-4 shadow-3xl bg-slate-950/85"
    >
      <div className="relative">
        <Loader2 size={28} className="text-[#FF6B1A] animate-spin" />
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-slate-200 font-[Syne]">Loading System map</div>
        <div className="text-[11px] text-slate-500 mt-1 font-mono">Aligning subsystems...</div>
      </div>
    </motion.div>
  </div>
);

const GraphEmptyState: React.FC = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl px-8 py-7 border border-white/8 flex flex-col items-center gap-3 shadow-3xl text-center max-w-xs bg-slate-950/85"
    >
      <Database size={28} className="text-slate-655" />
      <div>
        <div className="text-sm font-semibold text-slate-300 font-[Syne]">No Graph Data</div>
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          Analyze a repository first to populate the system explorer.
        </div>
      </div>
    </motion.div>
  </div>
);

const GraphErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl px-8 py-7 border border-rose-500/20 flex flex-col items-center gap-3 shadow-3xl text-center max-w-sm pointer-events-auto bg-slate-950/85"
    >
      <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
        <WifiOff size={18} className="text-rose-400" />
      </div>
      <div>
        <div className="text-sm font-semibold text-rose-300 font-[Syne]">Graph Unavailable</div>
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed font-mono">{message}</div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-semibold transition-all"
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </motion.div>
  </div>
);

// ── Graph Explorer Inner ──────────────────────────────────────────────────────
const GraphExplorerInner: React.FC = () => {
  const { analysisId, repoName } = useRepo();
  const { nodes: rawNodes, edges: rawEdges, source, loading, error, warning, refetch } = useRealGraphData(analysisId);

  // ── Graph data validation diagnostic ────────────────────────────────────────
  useEffect(() => {
    if (rawNodes.length === 0) return;
    const typeCounts: Record<string, number> = {};
    rawNodes.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1; });
    console.info('[RepoMind] Graph loaded:', rawNodes.length, 'nodes', rawEdges.length, 'edges | types:', typeCounts);
  }, [rawNodes, rawEdges]);

  // View Mode: 'system' (Subsystem Map) or 'graph' (Flat Dependency Graph)
  const [viewMode, setViewMode] = useState<'system' | 'graph'>('system');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [, setHoveredEdge] = useState<Edge | null>(null);

  // 1. Exploration hooks state
  const {
    expandedSubsystemId,
    selectedSubsystemId,
    selectedFileId,
    expandSubsystem,
    collapseSubsystem,
    selectSubsystem,
    selectFile,
    clearSelection
  } = useExplorerState();

  const isRealGraph = rawNodes.length > 0;
  const isRealGraph = rawNodes.length > 0;
  // Progressive navigation trail state
  const [navPath, setNavPath] = useState<NavPathItem[]>([
    { id: 'system', label: 'Repository', type: 'system' }
  ]);

  // Selected entity state (class or function drill-down)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Progressive Disclosure: show sibling functions toggle for Level 3
  const [showSiblings, setShowSiblings] = useState(false);

  // Detail panel slide collapse state
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);

  // Git activity database cache
  const [gitActivity, setGitActivity] = useState<RepositoryActivityData | null>(null);
  
  // Multi-stop path search
  const [searchStops, setSearchStops] = useState<string[]>(['']);
  const [searchMode, setSearchMode] = useState<'single' | 'path'>('single');

  useEffect(() => {
    if (!analysisId) return;
    getRepositoryActivity(analysisId)
      .then(data => setGitActivity(data))
      .catch(err => console.error("Failed to load repo activity", err));
  }, [analysisId]);

  // 3. Progressive Codebase Exploration Projection Layer
  const projectedGraph = useMemo(() => {

    // Helper: add a node+edge pair safely
    const addNode = (
      map: globalThis.Map<string, Node>,
      id: string, label: string, type: string,
      x: number, y: number, metadata: Record<string, unknown> = {},
      extra: Record<string, unknown> = {}
    ) => {
      if (map.has(id)) return;
      map.set(id, { id, type: 'realNode', position: { x, y }, data: { label, type, metadata, ...extra } });
    };

    const addEdge = (
      map: globalThis.Map<string, Edge>,
      id: string, source: string, target: string,
      edgeType: string, label: string
    ) => {
      if (map.has(id)) return;
      map.set(id, { id, source, target, type: 'customEdge', data: { type: edgeType, label } });
    };

    // Helper to match paths (absolute vs relative, backslash vs slash)
    const isPathMatch = (a: string, b: string) => {
      if (!a || !b) return false;
      if (a === b) return true;
      const clean = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '');
      const ca = clean(a);
      const cb = clean(b);
      return ca === cb || ca.endsWith('/' + cb) || cb.endsWith('/' + ca);
    };

    // ──────────────────────────────────────────────────────────────────────────
    // LEVEL 1 — System / Repository Overview
    // Show top 15 files by centrality, with file→file import edges between them
    // ──────────────────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────────────────
    // LEVEL 0 — Multi-Node Stop-Based Search & Path Finder
    // ──────────────────────────────────────────────────────────────────────────
    if (current && current.type === 'multi-search') {
      const nodesMap = new globalThis.Map<string, Node>();
      const edgesMap = new globalThis.Map<string, Edge>();

      // Find matching nodes for each search query
      const matched = searchStops
        .map(q => q.trim().toLowerCase())
        .filter(Boolean)
        .map(q => rawNodes.find(n => n.label.toLowerCase().includes(q)))
        .filter((n): n is RealGraphNode => !!n);

      if (matched.length === 0) {
        return { nodes: [], edges: [] };
      }

      const mainNode = matched[0];
      const otherStops = matched.slice(1);

      // Build function/class to file lookup maps
      const fnToFile = new globalThis.Map<string, string>();
      const classToFile = new globalThis.Map<string, string>();

      rawEdges.forEach(e => {
        if (e.type === 'FILE_CONTAINS_FUNCTION') fnToFile.set(e.target, e.source);
        if (e.type === 'FILE_CONTAINS_CLASS') classToFile.set(e.target, e.source);
      });

      rawNodes.forEach(n => {
        if (n.type === 'function' || n.type === 'class') {
          const fp = (n.metadata.file_path as string) ?? (n.metadata.path as string) ?? '';
          if (fp) {
            const matchedFile = rawNodes.find(f => f.type === 'file' && (isPathMatch(f.id, fp) || isPathMatch((f.metadata.path as string) ?? '', fp)));
            if (matchedFile) {
              if (n.type === 'function') fnToFile.set(n.id, matchedFile.id);
              if (n.type === 'class') classToFile.set(n.id, matchedFile.id);
            }
          }
        }
      });

      // Build unified adjacency map (handles direct and projected file-to-file import connections)
      const unifiedAdjacency = new globalThis.Map<string, Set<string>>();
      const edgeMeta = new globalThis.Map<string, { type: string; label: string }>();

      const addAdjacency = (src: string, tgt: string, type: string, label: string) => {
        if (!unifiedAdjacency.has(src)) unifiedAdjacency.set(src, new Set());
        unifiedAdjacency.get(src)!.add(tgt);
        edgeMeta.set(`${src}|${tgt}`, { type, label });
      };

      rawEdges.forEach(e => {
        // Direct connections
        addAdjacency(e.source, e.target, e.type, e.type.toLowerCase().replace(/_/g, ' '));

        // Projected File-to-File imports
        if (e.type === 'FUNCTION_CALLS_FUNCTION') {
          const srcFile = fnToFile.get(e.source);
          const tgtFile = fnToFile.get(e.target);
          if (srcFile && tgtFile && srcFile !== tgtFile) {
            addAdjacency(srcFile, tgtFile, 'IMPORTS', 'imports');
          }
        }
        if (e.type === 'INHERITS_FROM') {
          const srcFile = classToFile.get(e.source);
          const tgtFile = classToFile.get(e.target);
          if (srcFile && tgtFile && srcFile !== tgtFile) {
            addAdjacency(srcFile, tgtFile, 'IMPORTS', 'imports');
          }
        }
      });

      const cx = 550, cy = 400;
      
      // 1. Place Main Node in Center
      addNode(nodesMap, mainNode.id, mainNode.label, mainNode.type, cx, cy, mainNode.metadata, { isFocused: true });

      // 2. Position other searched stops in a circle around center
      const rInner = 260;
      otherStops.forEach((n, idx) => {
        const angle = (idx / Math.max(otherStops.length, 1)) * Math.PI * 2 - Math.PI / 2;
        addNode(nodesMap, n.id, n.label, n.type, Math.cos(angle) * rInner + cx, Math.sin(angle) * rInner + cy, n.metadata);
      });

      // 3. Trace connections strictly between the matched searched stops (no duplicates)
      const pathEdges = new Set<string>();
      const seenPairs = new Set<string>();

      matched.forEach(n1 => {
        matched.forEach(n2 => {
          if (n1.id === n2.id) return;
          
          const pairKey = [n1.id, n2.id].sort().join('↔');
          if (seenPairs.has(pairKey)) return;

          // Check n1 -> n2 connection
          if (unifiedAdjacency.get(n1.id)?.has(n2.id)) {
            pathEdges.add(`${n1.id}|${n2.id}`);
            seenPairs.add(pairKey);
          }
        });
      });

      // Add connections / edges
      pathEdges.forEach(edgeKey => {
        const [src, tgt] = edgeKey.split('|');
        const meta = edgeMeta.get(edgeKey) ?? { type: 'IMPORTS', label: 'imports' };
        addEdge(edgesMap, `multi:${src}→${tgt}`, src, tgt, meta.type, meta.label);
      });

      return { nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) };
    }

    if (current.type === 'system') {
      const fileNodes = rawNodes.filter(n => n.type === 'file');
      const candidateNodes = fileNodes.length > 0 ? fileNodes : rawNodes;

      // Build function/class to file lookup maps
      const fnToFile = new globalThis.Map<string, string>();
      const classToFile = new globalThis.Map<string, string>();

      rawEdges.forEach(e => {
        if (e.type === 'FILE_CONTAINS_FUNCTION') fnToFile.set(e.target, e.source);
        if (e.type === 'FILE_CONTAINS_CLASS') classToFile.set(e.target, e.source);
      });

      rawNodes.forEach(n => {
        if (n.type === 'function' || n.type === 'class') {
          const fp = (n.metadata.file_path as string) ?? (n.metadata.path as string) ?? '';
          if (fp) {
            const matchedFile = candidateNodes.find(f => isPathMatch(f.id, fp) || isPathMatch((f.metadata.path as string) ?? '', fp));
            if (matchedFile) {
              if (n.type === 'function') fnToFile.set(n.id, matchedFile.id);
              if (n.type === 'class') classToFile.set(n.id, matchedFile.id);
            }
          }
        }
      });

      // Calculate exploration priority degree metrics per file
      const dependencyOutDegree = new globalThis.Map<string, Set<string>>();
      const dependencyInDegree = new globalThis.Map<string, Set<string>>();
      const callOutDegree = new globalThis.Map<string, number>();
      const callInDegree = new globalThis.Map<string, number>();
      const classCount = new globalThis.Map<string, number>();
      const functionCount = new globalThis.Map<string, number>();

      candidateNodes.forEach(f => {
        dependencyOutDegree.set(f.id, new Set<string>());
        dependencyInDegree.set(f.id, new Set<string>());
        callOutDegree.set(f.id, 0);
        callInDegree.set(f.id, 0);
        classCount.set(f.id, 0);
        functionCount.set(f.id, 0);
      });

      rawNodes.forEach(n => {
        if (n.type === 'function') {
          const fid = fnToFile.get(n.id);
          if (fid && functionCount.has(fid)) functionCount.set(fid, functionCount.get(fid)! + 1);
        }
        if (n.type === 'class') {
          const fid = classToFile.get(n.id);
          if (fid && classCount.has(fid)) classCount.set(fid, classCount.get(fid)! + 1);
        }
      });

      rawEdges.forEach(e => {
        if (e.type === 'FUNCTION_CALLS_FUNCTION') {
          const srcFile = fnToFile.get(e.source);
          const tgtFile = fnToFile.get(e.target);
          if (srcFile && tgtFile && srcFile !== tgtFile) {
            if (callOutDegree.has(srcFile)) callOutDegree.set(srcFile, callOutDegree.get(srcFile)! + 1);
            if (callInDegree.has(tgtFile)) callInDegree.set(tgtFile, callInDegree.get(tgtFile)! + 1);
            if (dependencyOutDegree.has(srcFile)) dependencyOutDegree.get(srcFile)!.add(tgtFile);
            if (dependencyInDegree.has(tgtFile)) dependencyInDegree.get(tgtFile)!.add(srcFile);
          }
        }
        if (e.type === 'INHERITS_FROM') {
          const srcFile = classToFile.get(e.source);
          const tgtFile = classToFile.get(e.target);
          if (srcFile && tgtFile && srcFile !== tgtFile) {
            if (dependencyOutDegree.has(srcFile)) dependencyOutDegree.get(srcFile)!.add(tgtFile);
            if (dependencyInDegree.has(tgtFile)) dependencyInDegree.get(tgtFile)!.add(srcFile);
          }
        }
      });

      const getExplorationScore = (n: RealGraphNode) => {
        const depIn = dependencyInDegree.get(n.id)?.size || 0;
        const depOut = dependencyOutDegree.get(n.id)?.size || 0;
        const callIn = callInDegree.get(n.id) || 0;
        const callOut = callOutDegree.get(n.id) || 0;
        const cls = classCount.get(n.id) || (n.metadata.classes_count as number) || 0;
        const fn = functionCount.get(n.id) || (n.metadata.functions_count as number) || 0;
        
        const lbl = n.label.toLowerCase();
        const isEntry = lbl.includes('main') || lbl.includes('app') || lbl.includes('index') || lbl.includes('server') || lbl.includes('init');
        const entryPointBonus = isEntry ? 100 : 0;

        return (
          depIn * 4 +
          depOut * 2 +
          callIn * 3 +
          callOut * 1 +
          cls * 2 +
          fn * 0.5 +
          entryPointBonus
        );
      };

      const top = [...candidateNodes].sort((a, b) => getExplorationScore(b) - getExplorationScore(a)).slice(0, 15);
      const topIds = new Set(top.map(n => n.id));

      // concentric layout mapping
      const cx = 550, cy = 400;
      const tiers = [
        { nodes: top.slice(0, 3),  r: 130 },
        { nodes: top.slice(3, 8),  r: 300 },
        { nodes: top.slice(8, 15), r: 490 },
      ];

      const nodes: Node[] = [];
      tiers.forEach(({ nodes: tierNodes, r }) => {
        tierNodes.forEach((f, idx) => {
          const angle = (idx / Math.max(tierNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
          nodes.push({
            id: f.id, type: 'realNode',
            position: { x: Math.cos(angle) * r + cx, y: Math.sin(angle) * r + cy },
            data: { 
              label: f.label, 
              type: fileNodes.length > 0 ? 'file' : f.type, 
              metadata: {
                ...f.metadata,
                exploration_score: getExplorationScore(f)
              } 
            }
          });
        });
      });

      // Derive file→file edges
      const edgesMap = new globalThis.Map<string, Edge>();
      const seenFilePairs = new Set<string>();

      rawEdges.forEach(e => {
        if (e.type !== 'FUNCTION_CALLS_FUNCTION') return;
        const srcFile = fnToFile.get(e.source);
        const tgtFile = fnToFile.get(e.target);
        if (!srcFile || !tgtFile || srcFile === tgtFile) return;
        if (!topIds.has(srcFile) || !topIds.has(tgtFile)) return;
        const pairKey = [srcFile, tgtFile].sort().join('↔');
        if (seenFilePairs.has(pairKey)) return;
        seenFilePairs.add(pairKey);
        addEdge(edgesMap, `dep:${pairKey}`, srcFile, tgtFile, 'IMPORTS', 'imports');
      });

      return { nodes, edges: Array.from(edgesMap.values()) };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // LEVEL 2 — File Detail View
    // Center: the file  |  Inner ring: functions/classes it contains
    //                   |  Outer ring: files it imports / files that import it
    // ──────────────────────────────────────────────────────────────────────────
    if (current.type === 'file') {
      const fileId = current.id;
      const fileNode = rawNodes.find(n => n.id === fileId);
      const nodesMap = new globalThis.Map<string, Node>();
      const edgesMap = new globalThis.Map<string, Edge>();

      // ── Center: the selected file ──
      addNode(nodesMap, fileId,
        fileNode?.label ?? fileId.split('/').pop() ?? fileId,
        'file', 500, 360, fileNode?.metadata ?? {}, { isFocused: true }
      );

      // ── Inner ring: functions and classes contained in this file ──
      const contained = rawNodes.filter(n => {
        if (n.id === fileId || (n.type !== 'function' && n.type !== 'class')) return false;
        const fp = (n.metadata.file_path as string) ?? (n.metadata.path as string) ?? '';
        const fname = fileId.split('/').pop()!;
        return fp === fileId || fp.endsWith(fileId) || fileId.endsWith(fp)
          || (fname && (fp.includes(fname) || fileId.includes(fp.split('/').pop()!)));
      }).slice(0, 10);

      // ── Inner ring: contained functions/classes (cap 8, wider ring) ──
      const innerR = 210;
      const cappedContained = contained.slice(0, 8);
      cappedContained.forEach((n, idx) => {
        const angle = (idx / Math.max(cappedContained.length, 1)) * Math.PI * 2 - Math.PI / 2;
        addNode(nodesMap, n.id, n.label, n.type,
          Math.cos(angle) * innerR + 550, Math.sin(angle) * innerR + 400, n.metadata);
        addEdge(edgesMap, `contains:${fileId}→${n.id}`, fileId, n.id,
          n.type === 'class' ? 'FILE_CONTAINS_CLASS' : 'FILE_CONTAINS_FUNCTION', 'contains');
      });

      // ── Outer ring: neighboring files from function call chain ──
      const containedIds = new Set<string>();
      rawEdges.forEach(e => {
        if ((e.type === 'FILE_CONTAINS_FUNCTION' || e.type === 'FILE_CONTAINS_CLASS') && e.source === fileId) {
          containedIds.add(e.target);
        }
      });
      cappedContained.forEach(n => containedIds.add(n.id));

      const l2FnToFile = new globalThis.Map<string, string>();
      rawEdges.forEach(e => {
        if (e.type === 'FILE_CONTAINS_FUNCTION' || e.type === 'FILE_CONTAINS_CLASS') l2FnToFile.set(e.target, e.source);
      });
      rawNodes.forEach(n => {
        if ((n.type === 'function' || n.type === 'class') && !l2FnToFile.has(n.id)) {
          const fp = (n.metadata.file_path as string) ?? (n.metadata.path as string) ?? '';
          if (fp) l2FnToFile.set(n.id, fp);
        }
      });

      const importsMap = new globalThis.Map<string, RealGraphNode>(); // files we call into
      const importedByMap = new globalThis.Map<string, RealGraphNode>(); // files that call into us
      rawEdges.forEach(e => {
        if (e.type !== 'FUNCTION_CALLS_FUNCTION') return;
        const callerFile = l2FnToFile.get(e.source);
        const calleeFile = l2FnToFile.get(e.target);
        if (containedIds.has(e.source) && calleeFile && calleeFile !== fileId && !importsMap.has(calleeFile)) {
          const n = rawNodes.find(rn => rn.id === calleeFile);
          if (n) importsMap.set(calleeFile, n);
        }
        if (containedIds.has(e.target) && callerFile && callerFile !== fileId && !importedByMap.has(callerFile)) {
          const n = rawNodes.find(rn => rn.id === callerFile);
          if (n) importedByMap.set(callerFile, n);
        }
      });

      const outerR = 430;
      const importSlice = Array.from(importsMap.values()).slice(0, 6);
      const importedBySlice = Array.from(importedByMap.values()).filter(n => !importsMap.has(n.id)).slice(0, 6);

      // Imports: right semicircle (−90° to +90°)
      importSlice.forEach((n, idx) => {
        const span = Math.min(importSlice.length - 1, 4) * (Math.PI * 0.9 / 4);
        const startAngle = -span / 2;
        const angle = importSlice.length <= 1 ? 0 : startAngle + (idx / (importSlice.length - 1)) * span;
        addNode(nodesMap, n.id, n.label, 'file',
          Math.cos(angle) * outerR + 550, Math.sin(angle) * outerR + 400, n.metadata);
        addEdge(edgesMap, `imports:${fileId}→${n.id}`, fileId, n.id, 'IMPORTS', 'imports');
      });

      // ImportedBy: left semicircle (90° to 270°)
      importedBySlice.forEach((n, idx) => {
        const span = Math.min(importedBySlice.length - 1, 4) * (Math.PI * 0.9 / 4);
        const startAngle = Math.PI - span / 2;
        const angle = importedBySlice.length <= 1 ? Math.PI : startAngle + (idx / (importedBySlice.length - 1)) * span;
        addNode(nodesMap, n.id, n.label, 'file',
          Math.cos(angle) * outerR + 550, Math.sin(angle) * outerR + 400, n.metadata);
        addEdge(edgesMap, `importedby:${n.id}→${fileId}`, n.id, fileId, 'IMPORTS', 'imported by');
      });

      return { nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) };
    }

    // ── LEVEL 3a: Function Detail ──
    // Top: siblings (module context) | Left: callers | Center | Right: callees
    if (current.type === 'function') {
      const fnId = current.id;
      const fnNode = rawNodes.find(n => n.id === fnId);
      const nodesMap = new globalThis.Map<string, Node>();
      const edgesMap = new globalThis.Map<string, Edge>();
      const cx3 = 530, cy3 = 420;

      addNode(nodesMap, fnId, fnNode?.label ?? fnId.split(':').pop() ?? fnId,
        'function', cx3, cy3, fnNode?.metadata ?? {}, { isFocused: true });

      // Top row: up to 5 sibling functions from same file (module context, no file node)
      const fnFileId = (fnNode?.metadata.file_path as string) ?? (fnNode?.metadata.path as string) ?? '';
      if (fnFileId && showSiblings) {
        const fnFname = fnFileId.split('/').pop()!;
        const siblings = rawNodes.filter(n => {
          if (n.id === fnId || n.type !== 'function') return false;
          const fp = (n.metadata.file_path as string) ?? (n.metadata.path as string) ?? '';
          return fp === fnFileId || fp.endsWith(fnFileId) || fnFileId.endsWith(fp)
            || (fnFname && (fp.includes(fnFname) || fnFileId.includes(fp.split('/').pop()!)));
        }).slice(0, 5);
        const totalW = Math.max(siblings.length - 1, 0) * 220;
        siblings.forEach((s, idx) => {
          addNode(nodesMap, s.id, s.label, 'function',
            cx3 - totalW / 2 + idx * 220, 80, s.metadata, { dimmed: true });
          addEdge(edgesMap, `sibling:${fnId}|${s.id}`, fnId, s.id, 'SIBLING_FUNCTION', 'sibling');
        });
      }

      // Left column: callers (who calls this fn) — 120px vertical spacing
      const callers: RealGraphNode[] = [];
      const seenC = new Set<string>([fnId]);
      rawEdges.forEach(e => {
        if (e.type === 'FUNCTION_CALLS_FUNCTION' && e.target === fnId && !seenC.has(e.source)) {
          const src = rawNodes.find(n => n.id === e.source);
          if (src) { seenC.add(e.source); callers.push(src); }
        }
      });
      const callerSlice = callers.slice(0, 6);
      const callerStartY = cy3 - ((callerSlice.length - 1) / 2) * 120;
      callerSlice.forEach((c, idx) => {
        addNode(nodesMap, c.id, c.label, c.type, 160, callerStartY + idx * 120, c.metadata);
        addEdge(edgesMap, `caller:${c.id}|${fnId}`, c.id, fnId, 'FUNCTION_CALLS_FUNCTION', 'calls');
      });

      // Right column: callees (what this fn calls) — 120px vertical spacing
      const callees: RealGraphNode[] = [];
      const seenE = new Set<string>([fnId]);
      rawEdges.forEach(e => {
        if (e.type === 'FUNCTION_CALLS_FUNCTION' && e.source === fnId && !seenE.has(e.target)) {
          const tgt = rawNodes.find(n => n.id === e.target);
          if (tgt) { seenE.add(e.target); callees.push(tgt); }
        }
      });
      const calleeSlice = callees.slice(0, 6);
      const calleeStartY = cy3 - ((calleeSlice.length - 1) / 2) * 120;
      calleeSlice.forEach((c, idx) => {
        if (nodesMap.has(c.id)) return;
        addNode(nodesMap, c.id, c.label, c.type, 900, calleeStartY + idx * 120, c.metadata);
        addEdge(edgesMap, `callee:${fnId}|${c.id}`, fnId, c.id, 'FUNCTION_CALLS_FUNCTION', 'calls');
      });

      return { nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) };
    }

    // ── LEVEL 3b: Class Detail ──
    // Above: parent classes | Center | Right: subclasses | Below: methods grid
    if (current.type === 'class') {
      const classId = current.id;
      const classNode = rawNodes.find(n => n.id === classId);
      const nodesMap = new globalThis.Map<string, Node>();
      const edgesMap = new globalThis.Map<string, Edge>();

      addNode(nodesMap, classId, classNode?.label ?? classId.split(':').pop() ?? classId,
        'class', 530, 380, classNode?.metadata ?? {}, { isFocused: true });

      // Methods below — 3-column grid, 200px x-gap, 110px y-gap
      const methods = rawNodes.filter(n => {
        const cn = (n.metadata.class_name as string) ?? '';
        return n.type === 'function' && cn !== '' && cn === classNode?.label;
      }).slice(0, 9);
      const cols = Math.min(methods.length, 3);
      methods.forEach((m, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const totalW = Math.max(cols - 1, 0) * 200;
        addNode(nodesMap, m.id, m.label, 'function',
          530 - totalW / 2 + col * 200, 560 + row * 110, m.metadata);
        addEdge(edgesMap, `method:${classId}|${m.id}`, classId, m.id, 'CLASS_CONTAINS_FUNCTION', 'method');
      });

      // Parent classes above (y=130)
      rawEdges.filter(e => e.type === 'INHERITS_FROM' && e.source === classId).slice(0, 2)
        .forEach((e, idx) => {
          const p = rawNodes.find(n => n.id === e.target);
          if (!p || nodesMap.has(p.id)) return;
          addNode(nodesMap, p.id, p.label, 'class', 530 + idx * 240 - 120, 130, p.metadata);
          addEdge(edgesMap, `parent:${e.id}`, e.source, e.target, 'INHERITS_FROM', 'inherits');
        });

      // Subclasses on right (x=860, 120px y-gap)
      const childEdges = rawEdges.filter(e => e.type === 'INHERITS_FROM' && e.target === classId);
      const childStartY = 380 - ((Math.min(childEdges.length, 4) - 1) / 2) * 120;
      childEdges.slice(0, 4).forEach((e, idx) => {
        const ch = rawNodes.find(n => n.id === e.source);
        if (!ch || nodesMap.has(ch.id)) return;
        addNode(nodesMap, ch.id, ch.label, 'class', 860, childStartY + idx * 120, ch.metadata);
        addEdge(edgesMap, `child:${e.id}`, e.source, e.target, 'INHERITS_FROM', 'inherited by');
      });

      return { nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) };
    }

    return { nodes: [], edges: [] };

  }, [navPath, rawNodes, rawEdges, isRealGraph, showSiblings, searchStops]);



  // Mock node for CodeInspector when no real graph loaded
  const selectedMockNode = useMemo(() => {
    if (isRealGraph) return null;
    return mockFileNodes.find(n => n.id === selectedFileId) || null;
  }, [isRealGraph, selectedFileId]);

  // Layout hook for subsystem minimap
  const { subsystems, layoutNodes } = useExplorerLayout(
    rawNodes.length > 0 ? rawNodes : [],
    rawEdges.length > 0 ? rawEdges : [],
    viewMode === 'system' ? expandedSubsystemId : null
  );

  // Camera controls
  const { zoomToNode, resetCamera } = useExplorerCamera();

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState([]);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();
  // Store fitView in a ref so it's not a useEffect dep (React Flow guarantees it's stable)
  const fitViewRef = React.useRef(fitView);
  React.useEffect(() => { fitViewRef.current = fitView; });

  // Sync projected graph to React Flow — runs only when projectedGraph changes
  useEffect(() => {
    setLocalNodes(projectedGraph.nodes as any);
    setLocalEdges(projectedGraph.edges as any);
    if (projectedGraph.nodes.length > 0) {
      // Delay allows React Flow to measure node dimensions before fitting viewport
      const t = setTimeout(() => { fitViewRef.current({ padding: 0.25, duration: 400 }); }, 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectedGraph]);

  // Alias for ReactFlow component
  const nodes = localNodes;
  const edges = localEdges;

  // Dynamic Navigation Driller
  const handleExploreNode = useCallback((
    id: string, 
    type: 'file' | 'class' | 'function', 
    focusTarget?: 'center' | 'containment' | 'dependencies'
  ) => {
    setIsDetailsCollapsed(false);
    const matchedNode = rawNodes.find(n => n.id === id);
    const label = matchedNode?.label ?? id.split('/').pop() ?? id;
// MISSING LINE 1011
// MISSING LINE 1012
// MISSING LINE 1013
// MISSING LINE 1014
// MISSING LINE 1015
// MISSING LINE 1016
// MISSING LINE 1017
// MISSING LINE 1018
// MISSING LINE 1019
// MISSING LINE 1020
// MISSING LINE 1021
// MISSING LINE 1022
// MISSING LINE 1023
// MISSING LINE 1024
// MISSING LINE 1025
// MISSING LINE 1026
// MISSING LINE 1027
// MISSING LINE 1028
// MISSING LINE 1029
// MISSING LINE 1030
// MISSING LINE 1031
// MISSING LINE 1032
// MISSING LINE 1033
// MISSING LINE 1034
// MISSING LINE 1035
// MISSING LINE 1036
// MISSING LINE 1037
// MISSING LINE 1038
// MISSING LINE 1039
// MISSING LINE 1040
// MISSING LINE 1041
// MISSING LINE 1042
// MISSING LINE 1043
// MISSING LINE 1044
// MISSING LINE 1045
// MISSING LINE 1046
// MISSING LINE 1047
// MISSING LINE 1048
// MISSING LINE 1049
// MISSING LINE 1050
// MISSING LINE 1051
// MISSING LINE 1052
// MISSING LINE 1053
// MISSING LINE 1054
// MISSING LINE 1055
// MISSING LINE 1056
// MISSING LINE 1057
// MISSING LINE 1058
// MISSING LINE 1059
// MISSING LINE 1060
// MISSING LINE 1061
// MISSING LINE 1062
// MISSING LINE 1063
// MISSING LINE 1064
// MISSING LINE 1065
// MISSING LINE 1066
// MISSING LINE 1067
// MISSING LINE 1068
// MISSING LINE 1069
// MISSING LINE 1070
// MISSING LINE 1071
// MISSING LINE 1072
// MISSING LINE 1073
// MISSING LINE 1074
// MISSING LINE 1075
// MISSING LINE 1076
// MISSING LINE 1077
// MISSING LINE 1078
// MISSING LINE 1079
// MISSING LINE 1080
// MISSING LINE 1081
// MISSING LINE 1082
// MISSING LINE 1083
// MISSING LINE 1084
// MISSING LINE 1085
// MISSING LINE 1086
// MISSING LINE 1087
// MISSING LINE 1088
// MISSING LINE 1089
      c.filesChanged?.some(fc => {
        const cFc = clean(fc);
        return cFc === cPath || cPath.endsWith('/' + cFc) || cFc.endsWith('/' + cPath);
      })
    ) || null;
  }, [gitActivity]);

  // Sidebar list filters
  const sidebarNodes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rawNodes.filter(n =>
      (filterType === 'all' || n.type === filterType) &&
      (q === '' || n.label.toLowerCase().includes(q) || (n.metadata.file_path as string | undefined)?.toLowerCase().includes(q))
    );
  }, [rawNodes, searchQuery, filterType]);

  const filteredMockNodes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return mockFileNodes.filter(n =>
      (filterType === 'all' || n.type === filterType) &&
      (q === '' || n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
    );
  }, [searchQuery, filterType]);

  const nodeTypeColors: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(realNodeTypeConfig).forEach(([k, v]) => { map[k] = v.color; });
    return map;
  }, []);

  // Node click handler
// MISSING LINE 1121
// MISSING LINE 1122
// MISSING LINE 1123
// MISSING LINE 1124
// MISSING LINE 1125
// MISSING LINE 1126
// MISSING LINE 1127
// MISSING LINE 1128
// MISSING LINE 1129
// MISSING LINE 1130
// MISSING LINE 1131
// MISSING LINE 1132
// MISSING LINE 1133
// MISSING LINE 1134
// MISSING LINE 1135
// MISSING LINE 1136
// MISSING LINE 1137
// MISSING LINE 1138
// MISSING LINE 1139
// MISSING LINE 1140
// MISSING LINE 1141
// MISSING LINE 1142
// MISSING LINE 1143
// MISSING LINE 1144
// MISSING LINE 1145
// MISSING LINE 1146
// MISSING LINE 1147
// MISSING LINE 1148
// MISSING LINE 1149
// MISSING LINE 1150
// MISSING LINE 1151
// MISSING LINE 1152
// MISSING LINE 1153
// MISSING LINE 1154
// MISSING LINE 1155
// MISSING LINE 1156
// MISSING LINE 1157
// MISSING LINE 1158
// MISSING LINE 1159
    setTimeout(() => {
      if (fitViewRef.current) {
        fitViewRef.current({ duration: 600, padding: 0.2 });
      }
    }, 200);
  };

  const clearMultiSearch = () => {
    setSearchStops(['']);
    setNavPath([{ id: 'system', label: 'Repository', type: 'system' }]);
    selectFile(null);
    setSelectedEntityId(null);
  };

  const typeFilters = useMemo(() => {
    if (isRealGraph) {
      return ['all', ...new Set(rawNodes.map(n => n.type as string))];
    }
    return ['all', 'component', 'hook', 'util', 'type', 'context', 'api'];
  }, [isRealGraph, rawNodes]);

  return (
    <ExplorerContext.Provider
      value={{
        expandedSubsystemId,
        expandSubsystem,
        collapseSubsystem,
        zoomToNode,
        resetCamera,
        layoutNodes
      }}
    >
      <div className="flex h-full relative font-sans">
        <OnboardingOverlay />

        {/* Left Sidebar */}
        <motion.div
          animate={{ width: isSidebarCollapsed ? 56 : 220 }}
          className="glass border-r border-[#222222] bg-[#0E0E0E] flex flex-col flex-shrink-0 z-10 relative overflow-hidden"
        >
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center py-4 gap-6 h-full">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1.5 rounded-lg border border-[#222222] bg-[#131313] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors"
                title="Expand Sidebar"
              >
                <ChevronRight size={14} />
              </button>
              <div className="w-full border-t border-[#222222] my-1" />
              <div className="flex flex-col items-center gap-4 text-[#A0A0A0] font-mono text-[10px]">
                <GitBranch size={16} className="text-[#FF6B1A]" />
                <span>{isRealGraph ? rawNodes.length : filteredMockNodes.length} N</span>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-[#222222] bg-white/[0.01]">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch size={14} className="text-[#FF6B1A]" />
                  <span className="text-xs font-semibold text-[#F5F5F5] font-[Syne] truncate max-w-[110px]" title={repoName || 'Explorer'}>
                    {repoName || 'Explorer'}
                  </span>
                  <button
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="p-1 rounded-lg border border-[#222222] bg-[#131313] text-[#A0A0A0] hover:text-[#F5F5F5] ml-auto transition-colors"
                    title="Collapse Sidebar"
                  >
                    <ChevronLeft size={12} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-[#A0A0A0] font-mono mb-3 bg-[#131313] p-1.5 rounded-lg border border-[#222222]">
                  <span>Nodes: {isRealGraph ? rawNodes.length : filteredMockNodes.length}</span>
                  <span>Edges: {isRealGraph ? rawEdges.length : mockDependencyEdges.length}</span>
                </div>

                {/* Search & Pathfinder Switcher */}
                <div className="grid grid-cols-2 border border-white/5 rounded-xl p-0.5 bg-[#0B0B0F] mb-3">
                  <button
                    onClick={() => setSearchMode('single')}
                    className={`text-[9px] py-1.5 font-bold uppercase tracking-wider rounded-lg transition-all font-sans ${
                      searchMode === 'single' ? 'bg-[#FF6B1A]/15 border border-[#FF6B1A]/20 text-[#FF6B1A] shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Single Search
                  </button>
                  <button
                    onClick={() => setSearchMode('path')}
                    className={`text-[9px] py-1.5 font-bold uppercase tracking-wider rounded-lg transition-all font-sans ${
                      searchMode === 'path' ? 'bg-[#FF6B1A]/15 border border-[#FF6B1A]/20 text-[#FF6B1A] shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Path Finder
                  </button>
                </div>

                {searchMode === 'single' ? (
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && triggerSearch(searchQuery)}
                      placeholder="Search & Focus..."
                      className="w-full bg-[#0B0B0F] border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[#FF6B1A]/40 transition-colors"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 bg-white/[0.01] border border-white/5 rounded-xl p-2.5">
                    {searchStops.map((stop, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 relative">
                        <Search size={10} className="absolute left-2.5 text-slate-550" />
                        <input
                          value={stop}
                          onChange={e => {
                            const newStops = [...searchStops];
                            newStops[idx] = e.target.value;
                            setSearchStops(newStops);
                          }}
                          placeholder={idx === 0 ? "Start (Main Node)..." : `Stop ${idx + 1}...`}
                          className="w-full bg-[#0B0B0F] border border-white/5 rounded-lg pl-7 pr-7 py-1.5 text-[10.5px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[#FF6B1A]/40 transition-all font-mono"
                        />
                        {searchStops.length > 1 && (
                          <button
                            onClick={() => {
                              const newStops = searchStops.filter((_, sIdx) => sIdx !== idx);
                              setSearchStops(newStops);
                            }}
                            className="absolute right-2.5 text-slate-550 hover:text-rose-500 text-[10px] p-0.5 rounded transition-colors"
                            title="Remove Stop"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => setSearchStops([...searchStops, ''])}
                        className="flex-1 text-[9px] font-bold py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider"
                      >
                        + Add Stop
                      </button>
                      <button
                        onClick={triggerMultiSearch}
                        className="flex-1 text-[9px] font-bold py-1.5 rounded-lg bg-[#FF6B1A] text-[#04050A] hover:bg-[#ff8033] transition-colors uppercase tracking-wider shadow-md hover:shadow-lg"
                      >
                        Trace Path
                      </button>
                    </div>
                    {navPath[0]?.id === 'multi-search' && (
                      <button
                        onClick={clearMultiSearch}
                        className="w-full text-[9px] font-bold py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-455 hover:bg-rose-500/20 transition-colors uppercase tracking-wider"
                      >
                        Clear Pathfinder
                      </button>
                    )}
                  </div>

                )}

                <div className="flex flex-wrap gap-1 mt-2">
                  {typeFilters.map(t => {
                    const color = t === 'all' ? '#FF6B1A' : (nodeTypeColors[t] ?? '#FF4500');
                    const isActive = filterType === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider transition-all"
                        style={{
                          color: isActive ? color : '#666666',
                          background: isActive ? `${color}15` : 'transparent',
                          border: `1px solid ${isActive ? `${color}30` : 'transparent'}`,
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 bg-white/[0.005]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="shimmer h-8 rounded-lg mx-0.5" />
                  ))
                ) : isRealGraph ? (
                  sidebarNodes.map(node => {
                    const cfg = realNodeTypeConfig[node.type as string];
                    const isSelected = node.id === selectedFileId || node.id === selectedEntityId;
                    return (
                      <button
                        key={node.id}
                        onClick={() => { handleExploreNode(node.id, node.type as any); }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center gap-2 group border ${
                          isSelected
                            ? 'bg-[#FF6B1A]/15 border-[#FF6B1A]/20 shadow-md'
                            : 'border-transparent hover:bg-white/[0.04]'
                        }`}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: cfg?.color ?? '#FF6B1A' }}
                        />
                        <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-200 truncate transition-colors">
                          {node.label}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  filteredMockNodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => { handleExploreNode(node.id, 'file'); }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center gap-2 group border border-transparent ${
                        selectedFileId === node.id ? 'bg-[#FF6B1A]/15 border border-[#FF6B1A]/20 shadow-md' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: nodeTypeColors[node.type] ?? '#FF6B1A' }}
                      />
                      <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-200 truncate transition-colors">{node.name}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </motion.div>

        {/* Graph Canvas */}
        <div className="flex-1 relative bg-transparent">
          
          {/* Explorer Context Header */}
          <ExplorerHeader
            viewMode={viewMode}
            activeSubsystemName={expandedSubsystemId ? (subsystems.find(s => s.id === expandedSubsystemId)?.name ?? null) : null}
            activeFileName={selectedFileId ? (rawNodes.find(n => n.id === selectedFileId)?.label ?? null) : null}
            navPath={navPath}
            onBreadcrumbClick={handleBreadcrumbClick}
          />

          {/* View mode toggle */}
          <div className="absolute top-4 right-4 z-10 flex gap-2 pointer-events-auto">
            {navPath[navPath.length - 1]?.type === 'function' && (
              <button
                onClick={() => setShowSiblings(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border glass border-white/10 text-slate-350 hover:text-slate-100 hover:border-white/20 active:scale-95 shadow-md"
              >
                <Layers size={11} className={showSiblings ? 'text-amber-500' : 'text-slate-400'} />
                {showSiblings ? 'Hide Sibling Functions' : 'Show Sibling Functions'}
              </button>
            )}
            <button
              onClick={() => {
                setViewMode(viewMode === 'system' ? 'graph' : 'system');
                clearSelection();
                resetCamera();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border glass border-white/10 text-slate-350 hover:text-slate-100 hover:border-white/20 active:scale-95 shadow-md"
            >
              {viewMode === 'system' ? <Database size={12} /> : <MapIcon size={12} />}
              Show {viewMode === 'system' ? 'Dependency Graph' : 'System Map'}
            </button>
          </div>

          {/* System Overview tracker */}
          {viewMode === 'system' && (
            <SystemMinimap
              subsystems={subsystems}
              expandedSubsystemId={expandedSubsystemId}
              onSubsystemClick={(id) => {
                const pos = layoutNodes.find(n => n.id === `subsystem:${id}`);
                if (pos) {
                  expandSubsystem(id);
                  zoomToNode(pos.x + pos.width / 2, pos.y + pos.height / 2, 0.85);
                }
              }}
            />
          )}

          {/* Loading / Error states overlays */}
          <AnimatePresence>
            {loading && <GraphLoadingOverlay key="loading" />}
          </AnimatePresence>

          <AnimatePresence>
            {!loading && !error && rawNodes.length === 0 && (
              <GraphEmptyState key="empty" />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!loading && !!error && (
              <GraphErrorState key="error" message={error} onRetry={refetch} />
            )}
          </AnimatePresence>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge)}
            onEdgeMouseLeave={() => setHoveredEdge(null)}
            onPaneClick={() => { clearSelection(); setSelectedEntityId(null); resetCamera(); }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.15}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            style={{ background: 'transparent' }}
          >
            <Controls className="bottom-6 left-6" />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.03)" />
          </ReactFlow>

          {/* Edge/Connection Legend */}
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '80px',
            background: 'rgba(15, 15, 20, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '12px 14px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '210px',
            pointerEvents: 'none'
          }}>
            <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148, 163, 184, 0.55)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
              Connection Legend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="4" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2" x2="24" y2="2" stroke="#94a3b8" strokeWidth="2" />
                </svg>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>File Imports (Solid)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="4" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2" x2="24" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="3 3" />
                </svg>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>Function Calls (Dashed)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="4" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2" x2="24" y2="2" stroke="#475569" strokeWidth="1.5" strokeDasharray="2 2" />
                </svg>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>File Containments (Dotted)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="4" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2" x2="24" y2="2" stroke="#a855f7" strokeWidth="2.5" />
                </svg>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>Inheritances (Thick Solid)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Detail Inspector Panels */}
        <AnimatePresence>
          {(selectedSubsystem || selectedFileNode || selectedEntityNode || selectedMockNode) && (
            <motion.div
              key="details-drawer"
              initial={{ x: '100%' }}
              animate={{ x: isDetailsCollapsed ? '100%' : '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 190 }}
              style={{ width: '300px' }}
              className="absolute right-0 top-0 h-full z-20"
            >
              {/* Pull-tab handle for sliding in/out */}
              <button
                onClick={() => setIsDetailsCollapsed(prev => !prev)}
                style={{
                  position: 'absolute',
                  left: isDetailsCollapsed ? '-20px' : '-20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '64px',
                  background: 'rgba(10, 14, 28, 0.95)',
                  backdropFilter: 'blur(22px)',
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px 0 0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(148,163,184,0.65)',
                  cursor: 'pointer',
                  boxShadow: '-4px 0 16px rgba(0,0,0,0.5)',
                  transition: 'all 0.15s ease',
                  pointerEvents: 'auto',
                  zIndex: 30,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ff6b1a';
                  e.currentTarget.style.width = '24px';
                  e.currentTarget.style.left = '-24px';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(148,163,184,0.65)';
                  e.currentTarget.style.width = '20px';
                  e.currentTarget.style.left = '-20px';
                }}
                title={isDetailsCollapsed ? "Expand sidebar details" : "Collapse sidebar details"}
              >
                {isDetailsCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
              </button>

              {selectedSubsystem && !selectedFileId && (
                <SubsystemDetailsPanel
                  subsystem={selectedSubsystem}
                  onClose={clearSelection}
                />
              )}
              {selectedFileNode && (
                <NodeDetailsPanel
                  node={selectedFileNode}
                  onClose={clearSelection}
                  onExploreNode={handleExploreNode}
                  rawEdges={rawEdges}
                  rawNodes={rawNodes}
                  isActive={selectedFileId === navPath[navPath.length - 1]?.id}
                  showSiblings={showSiblings}
                  onToggleSiblings={() => setShowSiblings(prev => !prev)}
                  latestCommit={getLatestCommitForNode(selectedFileNode)}
                  onCollapse={() => setIsDetailsCollapsed(true)}
                />
              )}
              {selectedEntityNode && (
                <NodeDetailsPanel
                  node={selectedEntityNode}
                  onClose={() => {
                    setSelectedEntityId(null);
                  }}
                  onExploreNode={handleExploreNode}
                  rawEdges={rawEdges}
                  rawNodes={rawNodes}
                  isActive={selectedEntityId === navPath[navPath.length - 1]?.id}
                  showSiblings={showSiblings}
                  onToggleSiblings={() => setShowSiblings(prev => !prev)}
                  latestCommit={getLatestCommitForNode(selectedEntityNode)}
                  onCollapse={() => setIsDetailsCollapsed(true)}
                />
              )}
              {selectedMockNode && !selectedFileNode && (
                <CodeInspector
                  node={selectedMockNode}
                  onClose={clearSelection}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ExplorerContext.Provider>
  );
};

const GraphExplorer: React.FC = () => (
  <div className="h-[calc(100vh-56px)] bg-transparent relative">
    <div
      className="absolute inset-0 pointer-events-none z-30 opacity-[0.015]"
      style={{
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
        backgroundSize: '100% 4px, 6px 100%',
      }}
    />
    <ReactFlowProvider>
      <GraphExplorerInner />
    </ReactFlowProvider>
  </div>
);

export default GraphExplorer;

