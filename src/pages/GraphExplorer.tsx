import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  Database, RefreshCw, Wifi, WifiOff, Map, HelpCircle
} from 'lucide-react';

import CustomNode from '../components/CustomNode';
import CustomEdge from '../components/CustomEdge';
import RealGraphNodeComponent, { realNodeTypeConfig } from '../components/RealGraphNode';
import SubsystemNode from '../components/SubsystemNode';
import NodeDetailsPanel from '../components/NodeDetailsPanel';
import SubsystemDetailsPanel from '../components/SubsystemDetailsPanel';
import { OnboardingOverlay } from '../components/OnboardingOverlay';
import { ExplorerHeader } from '../components/ExplorerHeader';
import { SystemMinimap } from '../components/SystemMinimap';

import { mockFileNodes, mockDependencyEdges, mockASTData } from '../data/mockRepositoryData';
import type { FileNode, ASTNode } from '../data/mockRepositoryData';
import { useRealGraphData } from '../hooks/useRealGraphData';
import type { RealGraphNode, RealGraphEdge } from '../services/repoApi';
import { useRepo } from '../contexts/RepoContext';

import { useExplorerState } from '../hooks/useExplorerState';
import { useExplorerLayout } from '../hooks/useExplorerLayout';
import { useSpotlightMode } from '../hooks/useSpotlightMode';
import { useExplorerCamera } from '../hooks/useExplorerCamera';

// ── React Flow node/edge type registrations ───────────────────────────────────
const nodeTypes = {
  customNode: CustomNode,
  realNode: RealGraphNodeComponent,
  subsystemNode: SubsystemNode,
};
const edgeTypes = { customEdge: CustomEdge };

// ── Layout helpers ────────────────────────────────────────────────────────────
function deterministicPosition(id: string, index: number, total: number): { x: number; y: number } {
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
                      <div key={id} className="text-xs font-mono text-rose-400/80 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
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
        <Loader2 size={28} className="text-[#FF4500] animate-spin" />
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
  const [dismissedWarning, setDismissedWarning] = useState(false);

  // View Mode: 'system' (Subsystem Map) or 'graph' (Flat Dependency Graph)
  const [viewMode, setViewMode] = useState<'system' | 'graph'>('system');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);

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

  // 2. Compute dynamic layout coordinates
  const { subsystems, layoutNodes } = useExplorerLayout(
    rawNodes.length > 0 ? rawNodes : [],
    rawEdges.length > 0 ? rawEdges : [],
    viewMode === 'system' ? expandedSubsystemId : null
  );

  const { zoomToNode, resetCamera } = useExplorerCamera();

  // 3. Derive flow nodes / edges based on active view mode
  const initialFlowNodes = useMemo(() => {
    if (viewMode === 'graph') {
      return isRealGraph ? buildRealFlowNodes(rawNodes) : buildMockFlowNodes();
    }
    
    // Map layoutNodes directly to React Flow compatible Nodes
    return layoutNodes.map(n => {
      const isSubsystem = n.id.startsWith('subsystem:');
      if (isSubsystem) {
        const subId = n.id.replace('subsystem:', '');
        const subsystem = subsystems.find(s => s.id === subId);
        return {
          id: n.id,
          type: 'subsystemNode',
          position: { x: n.x, y: n.y },
          width: n.width,
          height: n.height,
          data: {
            id: subId,
            label: subsystem?.name.replace(' Area', '') ?? subId,
            description: subsystem?.description ?? '',
            filesCount: subsystem?.fileIds.length ?? 0,
            functionsCount: subsystem?.metrics.functions ?? 0,
            classesCount: subsystem?.metrics.classes ?? 0,
            entryFile: subsystem?.entryFiles?.[0]?.split('/')?.pop() ?? '',
            risk: subsystem?.risk ?? 'low',
            isExpanded: expandedSubsystemId === subId,
            onExpandToggle: (id: string) => {
              if (expandedSubsystemId === id) {
                collapseSubsystem();
                resetCamera();
              } else {
                expandSubsystem(id);
                zoomToNode(n.x + n.width / 2, n.y + n.height / 2, 0.85);
              }
            }
          }
        };
      } else {
        const fileNode = rawNodes.find(r => r.id === n.id);
        return {
          id: n.id,
          type: 'realNode',
          position: { x: n.x, y: n.y },
          data: {
            label: fileNode?.label ?? n.id.split('/').pop() ?? n.id,
            type: fileNode?.type ?? 'file',
            metadata: fileNode?.metadata ?? {}
          }
        };
      }
    });
  }, [viewMode, layoutNodes, subsystems, expandedSubsystemId, isRealGraph, rawNodes, expandSubsystem, collapseSubsystem, zoomToNode, resetCamera]);

  const initialFlowEdges = useMemo(() => {
    if (viewMode === 'graph') {
      return isRealGraph ? buildRealFlowEdges(rawEdges) : buildMockFlowEdges();
    }

    // Filter edges: only connect subsystem blocks or visible expanded files
    const edgesList: Edge[] = [];
    
    // Subsystem dependency paths
    subsystems.forEach(sub => {
      sub.dependencies.forEach(depId => {
        edgesList.push({
          id: `subsystem-edge:${sub.id}-${depId}`,
          source: `subsystem:${sub.id}`,
          target: `subsystem:${depId}`,
          type: 'customEdge',
          data: { label: 'depends' }
        });
      });
    });

    // File imports within subsystem
    if (expandedSubsystemId) {
      const activeSub = subsystems.find(s => s.id === expandedSubsystemId);
      if (activeSub) {
        rawEdges.forEach(e => {
          const isSrcInSub = activeSub.fileIds.includes(e.source);
          const isTgtInSub = activeSub.fileIds.includes(e.target);
          if (isSrcInSub && isTgtInSub) {
            edgesList.push({
              id: e.id,
              source: e.source,
              target: e.target,
              type: 'customEdge',
              data: { label: e.type }
            });
          }
        });
      }
    }

    return edgesList;
  }, [viewMode, subsystems, expandedSubsystemId, rawEdges, isRealGraph]);

  const [nodesState, setNodes, onNodesChange] = useNodesState(initialFlowNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges);

  // Sync state changes back to React Flow nodes/edges
  useEffect(() => {
    setNodes(initialFlowNodes);
  }, [initialFlowNodes, setNodes]);

  useEffect(() => {
    setEdges(initialFlowEdges);
  }, [initialFlowEdges, setEdges]);

  // 4. Integrate spotlight visibility calculations
  const { spotlightNodes, spotlightEdges } = useSpotlightMode(
    nodesState,
    edgesState,
    selectedFileId,
    expandedSubsystemId
  );

  const selectedSubsystem = useMemo(() => {
    return subsystems.find(s => s.id === selectedSubsystemId) || null;
  }, [subsystems, selectedSubsystemId]);

  const selectedFileNode = useMemo(() => {
    return rawNodes.find(n => n.id === selectedFileId) || null;
  }, [rawNodes, selectedFileId]);

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
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const isSubsystemNode = node.id.startsWith('subsystem:');
    if (isSubsystemNode) {
      const subId = node.id.replace('subsystem:', '');
      selectSubsystem(subId);
    } else {
      selectFile(node.id);
    }
  }, [selectSubsystem, selectFile]);

  // Trigger search actions: center, expand, and spotlight
  const triggerSearch = (query: string) => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return;

    const matchedNode = rawNodes.find(n => n.label.toLowerCase().includes(cleanQuery));
    if (matchedNode) {
      // Find parent subsystem group
      const parentSub = subsystems.find(s => s.fileIds.includes(matchedNode.id));
      if (parentSub) {
        expandSubsystem(parentSub.id);
      }
      selectFile(matchedNode.id);

      // Locate layout coordinate to zoom camera
      const targetPos = layoutNodes.find(n => n.id === matchedNode.id);
      if (targetPos) {
        zoomToNode(targetPos.x, targetPos.y, 1.25);
      }
    }
  };

  const typeFilters = useMemo(() => {
    if (isRealGraph) {
      return ['all', ...new Set(rawNodes.map(n => n.type as string))];
    }
    return ['all', 'component', 'hook', 'util', 'type', 'context', 'api'];
  }, [isRealGraph, rawNodes]);

  return (
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
            <button 
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-2 rounded-lg hover:bg-white/[0.04] text-[#A0A0A0]"
            >
              <Search size={14} />
            </button>
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

              {/* Search */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && triggerSearch(searchQuery)}
                  placeholder="Search & Focus..."
                  className="w-full bg-[#131313] border border-[#222222] rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-350 placeholder-slate-655 focus:outline-none focus:border-[#FF6B1A]/50 transition-colors"
                />
              </div>

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
                  return (
                    <button
                      key={node.id}
                      onClick={() => { selectFile(node.id); }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center gap-2 group border ${
                        selectedFileId === node.id
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
                    onClick={() => { setSelectedMockNode(node); }}
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
        
        {/* Explorer Context Header */}
        <ExplorerHeader
          viewMode={viewMode}
          activeSubsystemName={expandedSubsystemId ? (subsystems.find(s => s.id === expandedSubsystemId)?.name ?? null) : null}
          activeFileName={selectedFileId ? (rawNodes.find(n => n.id === selectedFileId)?.label ?? null) : null}
        />

        {/* View mode toggle */}
        <div className="absolute top-4 right-4 z-10 flex gap-2 pointer-events-auto">
          <button
            onClick={() => {
              setViewMode(viewMode === 'system' ? 'graph' : 'system');
              clearSelection();
              resetCamera();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border glass border-white/10 text-slate-350 hover:text-slate-100 hover:border-white/20 active:scale-95 shadow-md"
          >
            {viewMode === 'system' ? <Database size={12} /> : <Map size={12} />}
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
          nodes={spotlightNodes}
          edges={spotlightEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge)}
          onEdgeMouseLeave={() => setHoveredEdge(null)}
          onPaneClick={() => { clearSelection(); resetCamera(); }}
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
      </div>

      {/* Side Detail Inspector Panels */}
      <AnimatePresence>
        {selectedSubsystem && !selectedFileId && (
          <div key="subsystem-panel" className="absolute right-0 top-0 h-full w-75 z-20">
            <SubsystemDetailsPanel
              subsystem={selectedSubsystem}
              onClose={clearSelection}
            />
          </div>
        )}
        {selectedFileNode && (
          <div key="real-panel" className="absolute right-0 top-0 h-full w-75 z-20">
            <NodeDetailsPanel
              node={selectedFileNode}
              onClose={clearSelection}
            />
          </div>
        )}
        {selectedMockNode && !selectedFileNode && (
          <div key="mock-panel" className="absolute right-0 top-0 h-full w-80 z-20">
            <CodeInspector
              node={selectedMockNode}
              onClose={() => setSelectedMockNode(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
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
