import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search, X, GitBranch, FileCode, Upload, Download,
  ChevronLeft, ChevronRight, Layers, AlertTriangle, Binary, Loader2, Code2,
  Database, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import CustomNode from '../components/CustomNode';
import CustomEdge from '../components/CustomEdge';
import RealGraphNodeComponent, { realNodeTypeConfig } from '../components/RealGraphNode';
import NodeDetailsPanel from '../components/NodeDetailsPanel';
import { mockFileNodes, mockDependencyEdges, mockASTData } from '../data/mockRepositoryData';
import type { FileNode, ASTNode } from '../data/mockRepositoryData';
import { useRealGraphData } from '../hooks/useRealGraphData';
import type { RealGraphNode, RealGraphEdge } from '../services/repoApi';
import { useRepo } from '../contexts/RepoContext';

// ── React Flow node/edge type registrations ───────────────────────────────────
const nodeTypes = {
  customNode: CustomNode,
  realNode: RealGraphNodeComponent,
};
const edgeTypes = { customEdge: CustomEdge };

// ── Layout helpers ────────────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random layout.  Same node id always maps to the same
 * (x, y) so the graph is stable between renders.
 */
function deterministicPosition(id: string, index: number, total: number): { x: number; y: number } {
  // Simple seeded hash of the id string
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + (hash % 100) * 0.02;
  const radius = 250 + Math.abs(hash % 180);
  return {
    x: Math.cos(angle) * radius + 500,
    y: Math.sin(angle) * radius + 350,
  };
}

/**
 * Convert RealGraphNode[] → React Flow Node[].
 * Memoised externally with useMemo to avoid expensive recalculation.
 */
function buildRealFlowNodes(rawNodes: RealGraphNode[]): Node[] {
  return rawNodes.map((n, idx) => ({
    id: n.id,
    type: 'realNode',
    position: deterministicPosition(n.id, idx, rawNodes.length),
    data: {
      label: n.label,
      type: n.type,
      metadata: n.metadata,
    },
  }));
}

function buildRealFlowEdges(rawEdges: RealGraphEdge[]): Edge[] {
  return rawEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'customEdge',
    data: { label: e.type },
    animated: false,
  }));
}

// ── Legacy mock layout ────────────────────────────────────────────────────────

const MOCK_POSITIONS: Record<string, { x: number; y: number }> = {
  'node-1':  { x: 400, y: 300 },
  'node-2':  { x: 100, y: 150 },
  'node-3':  { x: 700, y: 150 },
  'node-4':  { x: 100, y: 450 },
  'node-5':  { x: 700, y: 420 },
  'node-6':  { x: 400, y: 550 },
  'node-7':  { x: 400, y: 700 },
  'node-8':  { x: 100, y: 700 },
  'node-9':  { x: -150, y: 450 },
  'node-10': { x: 950, y: 300 },
};

const buildMockFlowNodes = (): Node[] =>
  mockFileNodes.map(node => ({
    id: node.id,
    type: 'customNode',
    position: MOCK_POSITIONS[node.id] ?? { x: Math.random() * 600, y: Math.random() * 500 },
    data: {
      label: node.name,
      type: node.type,
      linesOfCode: node.linesOfCode,
      importCount: node.importCount,
      exportCount: node.exportCount,
      complexity: node.complexity,
    },
  }));

const buildMockFlowEdges = (): Edge[] =>
  mockDependencyEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'customEdge',
    data: { label: e.symbols.join(', ') },
    animated: false,
  }));

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
            <span className="text-slate-600">:</span>
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

// ── Code Inspector Panel (unchanged from original) ────────────────────────────
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

  React.useEffect(() => {
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/12 bg-white/[0.03]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="font-mono text-xs font-semibold text-slate-200 truncate">{node.name}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors p-1">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
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
            {/* Path */}
            <div>
              <div className="text-[10px] text-slate-650 uppercase tracking-widest mb-1 font-bold">File Path</div>
              <div className="font-mono text-xs text-slate-400 bg-white/3 rounded-lg p-2.5 break-all border border-white/12">{node.path}</div>
            </div>

            {/* Description */}
            <div>
              <div className="text-[10px] text-slate-650 uppercase tracking-widest mb-1 font-bold">Description</div>
              <p className="text-xs text-slate-400 leading-relaxed font-light">{node.description}</p>
            </div>

            {/* Stats */}
            <div>
              <div className="text-[10px] text-slate-650 uppercase tracking-widest mb-2 font-bold">Metrics</div>
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

            {/* Exports */}
            <div>
              <div className="text-[10px] text-slate-650 uppercase tracking-widest mb-2 font-bold">Exports</div>
              <div className="space-y-1">
                {node.exports.map(exp => (
                  <div key={exp} className="flex items-center gap-2 text-xs font-mono" style={{ color }}>
                    <ChevronRight size={10} />
                    {exp}
                  </div>
                ))}
              </div>
            </div>

            {/* Code Preview */}
            <div>
              <div className="text-[10px] text-slate-650 uppercase tracking-widest mb-2 font-bold">Source Preview</div>
              <div className="glass rounded-xl p-3 border border-white/12 bg-black/10 overflow-hidden">
                <pre className="text-[10px] font-mono text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
                  {node.sourcePreview}
                </pre>
              </div>
            </div>

            {/* Blast Radius */}
            {node.blastRadius.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-650 uppercase tracking-widest mb-2 flex items-center gap-1 font-bold">
                  <Layers size={9} />
                  Blast Radius
                  <span className="badge badge-red ml-1 text-[9px]">{node.blastRadius.length} files</span>
                </div>
                <div className="space-y-1">
                  {node.blastRadius.map(id => {
                    const dep = mockFileNodes.find(n => n.id === id);
                    return dep ? (
                      <div key={id} className="text-xs font-mono text-rose-400/80 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                        {dep.name}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-2 border-t border-white/12">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Last modified</span>
                <span>{node.lastModified}</span>
              </div>
            </div>
          </>
        ) : (
          /* Visual AST Tree view */
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-slate-650 uppercase tracking-widest mb-1 font-bold">AST Parser</div>
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

            {/* Coupling snippet view */}
            {hoveredAstNode && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-3 border border-[#FF4500]/20 bg-[#FF4500]/10 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[9px] text-[#FF6F61] font-mono">
                  <span>Target Range Code</span>
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

// ── Loading overlay ───────────────────────────────────────────────────────────

const GraphLoadingOverlay: React.FC = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl px-8 py-6 border border-white/8 flex flex-col items-center gap-4 shadow-3xl"
    >
      <div className="relative">
        <Loader2 size={28} className="text-[#FF4500] animate-spin" />
        <div className="absolute inset-0 blur-md opacity-50">
          <Loader2 size={28} className="text-[#FF4500] animate-spin" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-slate-200 font-[Syne]">Loading Graph</div>
        <div className="text-[11px] text-slate-500 mt-1 font-mono">Fetching repository structure...</div>
      </div>
    </motion.div>
  </div>
);

// ── Empty graph state ─────────────────────────────────────────────────────────

const GraphEmptyState: React.FC = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl px-8 py-7 border border-white/8 flex flex-col items-center gap-3 shadow-3xl text-center max-w-xs"
    >
      <Database size={28} className="text-slate-600" />
      <div>
        <div className="text-sm font-semibold text-slate-300 font-[Syne]">No Graph Data</div>
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          Analyze a repository first to populate the graph explorer.
        </div>
      </div>
    </motion.div>
  </div>
);

// ── Error state ───────────────────────────────────────────────────────────────

const GraphErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl px-8 py-7 border border-rose-500/20 flex flex-col items-center gap-3 shadow-3xl text-center max-w-sm pointer-events-auto"
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
  const [dismissedWarning, setDismissedWarning] = useState(false);

  // Derive the initial React Flow nodes/edges (memoised)
  const initialFlowNodes = useMemo(
    () => rawNodes.length > 0 ? buildRealFlowNodes(rawNodes) : buildMockFlowNodes(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawNodes]
  );
  const initialFlowEdges = useMemo(
    () => rawEdges.length > 0 ? buildRealFlowEdges(rawEdges) : buildMockFlowEdges(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawEdges]
  );

  const [, , onNodesChange] = useNodesState(initialFlowNodes);
  const [, , onEdgesChange] = useEdgesState(initialFlowEdges);

  // Selection & interaction state
  const [selectedRealNode, setSelectedRealNode] = useState<RealGraphNode | null>(null);
  const [selectedMockNode, setSelectedMockNode] = useState<FileNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [focusMode, setFocusMode] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Determine whether we're using real or mock nodes
  const isRealGraph = rawNodes.length > 0;

  // Real graph sidebar list
  const sidebarRealNodes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rawNodes.filter(n =>
      (filterType === 'all' || n.type === filterType) &&
      (q === '' || n.label.toLowerCase().includes(q) || (n.metadata.file_path as string | undefined)?.toLowerCase().includes(q))
    );
  }, [rawNodes, searchQuery, filterType]);

  // Mock graph sidebar list (legacy)
  const filteredMockNodes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return mockFileNodes.filter(n =>
      (filterType === 'all' || n.type === filterType) &&
      (q === '' || n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
    );
  }, [searchQuery, filterType]);

  // Node colours map for MiniMap
  const nodeTypeColors: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(realNodeTypeConfig).forEach(([k, v]) => { map[k] = v.color; });
    return map;
  }, []);

  // Connected node ids for focus mode
  const connectedNodeIds = useMemo(() => {
    const activeId = isRealGraph ? selectedRealNode?.id : selectedMockNode?.id;
    if (!activeId) return new Set<string>();
    const set = new Set<string>([activeId]);
    (isRealGraph ? rawEdges : mockDependencyEdges).forEach((e: any) => {
      if (e.source === activeId) set.add(e.target);
      if (e.target === activeId) set.add(e.source);
    });
    return set;
  }, [isRealGraph, selectedRealNode, selectedMockNode, rawEdges]);

  // Compute current flow nodes (with highlight/dim)
  const flowNodes = useMemo(() => {
    const reactFlowNodes = isRealGraph
      ? (rawNodes.length > 0 ? buildRealFlowNodes(rawNodes) : buildMockFlowNodes())
      : buildMockFlowNodes();

    return reactFlowNodes.map(n => {
      const label = ((n.data as { label?: string }).label ?? '').toLowerCase();
      const isSearchMatch = searchQuery !== '' && label.includes(searchQuery.toLowerCase());
      const activeId = isRealGraph ? selectedRealNode?.id : selectedMockNode?.id;
      const dimmed = focusMode && !!activeId && !connectedNodeIds.has(n.id);
      return {
        ...n,
        data: {
          ...n.data,
          highlighted: isSearchMatch,
          dimmed,
        },
      };
    });
  }, [rawNodes, isRealGraph, searchQuery, focusMode, selectedRealNode, selectedMockNode, connectedNodeIds]);

  // Compute current flow edges (with highlight/dim)
  const flowEdges = useMemo(() => {
    const activeId = isRealGraph ? selectedRealNode?.id : selectedMockNode?.id;
    const reactFlowEdges = isRealGraph
      ? (rawEdges.length > 0 ? buildRealFlowEdges(rawEdges) : buildMockFlowEdges())
      : buildMockFlowEdges();

    return reactFlowEdges.map(e => {
      const isConnected = !!activeId && (e.source === activeId || e.target === activeId);
      const dimmed = focusMode && !!activeId && !isConnected;
      return {
        ...e,
        data: {
          ...(e.data ?? {}),
          highlighted: isConnected,
          dimmed,
        },
      };
    });
  }, [rawEdges, isRealGraph, focusMode, selectedRealNode, selectedMockNode]);

  // Node click handler
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (isRealGraph) {
      const realNode = rawNodes.find(n => n.id === node.id);
      setSelectedRealNode(realNode ?? null);
      setSelectedMockNode(null);
    } else {
      const mockNode = mockFileNodes.find(n => n.id === node.id);
      setSelectedMockNode(mockNode ?? null);
      setSelectedRealNode(null);
    }
  }, [isRealGraph, rawNodes]);

  // Sidebar item types for filter pills
  const typeFilters = useMemo(() => {
    if (isRealGraph) {
      const types = [...new Set(rawNodes.map(n => n.type as string))];
      return ['all', ...types];
    }
    return ['all', 'component', 'hook', 'util', 'type', 'context', 'api'];
  }, [isRealGraph, rawNodes]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full relative font-sans">
      {/* Left Sidebar */}
      <motion.div
        animate={{ width: isSidebarCollapsed ? 56 : 220 }}
        className="glass border-r border-[#222222] bg-[#0E0E0E] flex flex-col flex-shrink-0 z-10 relative overflow-hidden"
      >
        {isSidebarCollapsed ? (
          /* Collapsed Mini Rail */
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
              <div className="flex flex-col items-center gap-1">
                <span>{isRealGraph ? rawNodes.length : filteredMockNodes.length} N</span>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-2 rounded-lg hover:bg-white/[0.04] text-[#A0A0A0]"
              title="Search Nodes"
            >
              <Search size={14} />
            </button>
          </div>
        ) : (
          /* Full Sidebar Controls */
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
              
              {/* Node and Edge counts */}
              <div className="flex items-center justify-between text-[10px] text-[#A0A0A0] font-mono mb-3 bg-[#131313] p-1.5 rounded-lg border border-[#222222]">
                <span>Nodes: {isRealGraph ? rawNodes.length : filteredMockNodes.length}</span>
                <span>Edges: {isRealGraph ? rawEdges.length : mockDependencyEdges.length}</span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-[#131313] border border-[#222222] rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-350 placeholder-slate-650 focus:outline-none focus:border-[#FF6B1A]/50 transition-colors"
                />
              </div>

              {/* Type Filters */}
              <div className="flex flex-wrap gap-1 mt-2">
                {typeFilters.map(t => {
                  const color = t === 'all'
                    ? '#FF6F61'
                    : (nodeTypeColors[t] ?? '#FF4500');
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

            {/* Node list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 bg-white/[0.005]">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shimmer h-8 rounded-lg mx-0.5" />
                ))
              ) : isRealGraph ? (
                sidebarRealNodes.map(node => {
                  const cfg = realNodeTypeConfig[node.type as string];
                  return (
                    <button
                      key={node.id}
                      onClick={() => { setSelectedRealNode(node); setSelectedMockNode(null); }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center gap-2 group border ${
                        selectedRealNode?.id === node.id
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
                    onClick={() => { setSelectedMockNode(node); setSelectedRealNode(null); }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center gap-2 group border border-transparent ${
                      selectedMockNode?.id === node.id ? 'bg-[#FF6B1A]/15 border border-[#FF6B1A]/20 shadow-md' : 'hover:bg-white/[0.04]'
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

        {/* Legend / Controls overlay */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-auto">
          {/* Legend */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl px-3 py-2 border border-white/6 flex flex-wrap gap-2.5 shadow-2xl"
          >
            {(isRealGraph
              ? Object.entries(realNodeTypeConfig).filter(([t]) =>
                  rawNodes.some(n => n.type === t)
                )
              : Object.entries(realNodeTypeConfig).filter(([t]) =>
                  ['component', 'hook', 'util', 'type', 'context', 'api', 'page'].includes(t)
                )
            ).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                <span className="text-[9px] capitalize text-slate-500 font-medium font-mono">{type}</span>
              </div>
            ))}
          </motion.div>

          {/* Focus Mode button */}
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => setFocusMode(!focusMode)}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all active:scale-95 shadow-md ${
              focusMode
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'glass border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${focusMode ? 'bg-rose-500 animate-ping' : 'bg-slate-500'}`} />
            Target Focus Mode {focusMode ? 'Active' : 'Off'}
          </motion.button>
        </div>

        {/* Floating Analytics Overlay (Top-Right) */}
        <div className="absolute top-4 right-4 z-10 w-52 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-3 border border-white/6 bg-white/[0.01] space-y-2.5 shadow-3xl text-left"
          >
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold border-b border-white/5 pb-1 truncate" title={repoName || 'Codebase Insights'}>
              {repoName || 'Codebase Insights'}
            </div>
            <div className="space-y-2">
              {isRealGraph ? (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 flex-shrink-0" />
                    <span>{rawNodes.filter(n => n.type === 'repository').length} repositor{rawNodes.filter(n => n.type === 'repository').length !== 1 ? 'ies' : 'y'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span>{rawNodes.filter(n => n.type === 'file').length} files indexed</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span>{rawNodes.filter(n => n.type === 'function').length} functions</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    <span>{rawNodes.filter(n => n.type === 'class').length} classes</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                    <span>{rawEdges.length} connections (edges)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span>{source === 'neo4j' ? <Wifi size={10} className="text-cyan-400" /> : <WifiOff size={10} className="text-slate-500" />}</span>
                    <span className={source === 'neo4j' ? 'text-cyan-400' : 'text-slate-500'}>
                      {source === 'neo4j' ? 'Live Neo4j data' : 'Mock data'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                    <span>1 circular dependency</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="text-xs flex-shrink-0">📊</span>
                    <span>Most imported: <code className="text-cyan-300 font-mono text-[9px]">api.ts (6×)</code></span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="text-xs flex-shrink-0">📏</span>
                    <span>Critical depth: <span className="font-semibold text-slate-200">4 hops</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-350">
                    <span className="text-xs flex-shrink-0">⚡</span>
                    <span>Avg complexity: <span className="font-semibold text-slate-200">10.6</span></span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Loading / Empty / Error overlays */}
        <AnimatePresence>
          {loading && <GraphLoadingOverlay key="loading" />}
        </AnimatePresence>

        <AnimatePresence>
          {!loading && !error && rawNodes.length === 0 && isRealGraph === false && (
            <GraphEmptyState key="empty" />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!loading && !!error && (
            <GraphErrorState key="error" message={error} onRetry={refetch} />
          )}
        </AnimatePresence>

        {/* Non-blocking warning banner when backend unavailable but using mock data */}
        <AnimatePresence>
          {!loading && warning && !dismissedWarning && (
            <motion.div
              key="warning"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-md pointer-events-auto"
            >
              <div className="glass rounded-xl px-4 py-3 border border-amber-500/20 bg-amber-500/5 flex items-center gap-3 shadow-xl">
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                <span className="text-xs text-amber-200 font-medium flex-1">{warning}</span>
                <button
                  onClick={() => setDismissedWarning(true)}
                  className="text-amber-600 hover:text-amber-400 transition-colors flex-shrink-0 ml-2"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* React Flow Canvas */}
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge)}
          onEdgeMouseLeave={() => setHoveredEdge(null)}
          onPaneClick={() => { setSelectedRealNode(null); setSelectedMockNode(null); }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          <Controls
            className="bottom-6 left-6"
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '4px',
            }}
          />
          <MiniMap
            className="bottom-6 right-6"
            nodeColor={n => nodeTypeColors[(n.data as { type: string }).type] ?? '#FF4500'}
            maskColor="rgba(3,7,18,0.85)"
            style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              width: 140,
              height: 100,
            }}
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(255,255,255,0.035)"
          />
        </ReactFlow>

        {/* Hovered Edge Tooltip */}
        {hoveredEdge && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-slate-900/90 border border-[#FF4500]/20 font-mono text-[10px] text-[#FF6F61] backdrop-blur shadow-3xl flex items-center gap-2 select-none pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-ping" />
            <strong className="text-slate-200">{hoveredEdge.source.split(':').pop()}</strong>
            {' '}➔{' '}
            <strong className="text-slate-200">{hoveredEdge.target.split(':').pop()}</strong>
            <span className="text-slate-700 font-light">|</span>
            <span><code className="text-[#DAA520] font-bold">{String(hoveredEdge.data?.label || 'RELATES_TO')}</code></span>
          </div>
        )}
      </div>

      {/* Inspector Panels */}
      <AnimatePresence>
        {selectedRealNode && (
          <div key="real-panel" className="absolute right-0 top-0 h-full w-75 z-20">
            <NodeDetailsPanel node={selectedRealNode} onClose={() => setSelectedRealNode(null)} />
          </div>
        )}
        {selectedMockNode && !selectedRealNode && (
          <div key="mock-panel" className="absolute right-0 top-0 h-full w-80 z-20">
            <CodeInspector node={selectedMockNode} onClose={() => setSelectedMockNode(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Outer wrapper (unchanged) ─────────────────────────────────────────────────

const GraphExplorer: React.FC = () => (
  <div className="h-[calc(100vh-56px)] bg-transparent relative">
    {/* Digital Scan line effect */}
    <div
      className="absolute inset-0 pointer-events-none z-30 opacity-[0.02]"
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
