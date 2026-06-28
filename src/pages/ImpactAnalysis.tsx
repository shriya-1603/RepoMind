import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Zap, AlertTriangle, FileCode, CheckCircle, XCircle, AlertCircle, ArrowRight,
  Play, Settings, CheckCircle2, Loader2, Search, ChevronRight, Layers
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { ImpactDetailsPanel } from '../components/ImpactDetailsPanel';
import { mockFileNodes, mockImpactData, mockRefactorScenarios } from '../data/mockRepositoryData';
import type { ImpactData } from '../data/mockRepositoryData';
import CustomNode from '../components/CustomNode';
import CustomEdge from '../components/CustomEdge';
import { useRepo } from '../contexts/RepoContext';
import { useImpactAnalysisReal } from '../hooks/useImpactAnalysisReal';
import { useChangeSimulationReal } from '../hooks/useChangeSimulationReal';

const nodeTypes = { customNode: CustomNode };
const edgeTypes = { customEdge: CustomEdge };


// ── Build Impact Graph ────────────────────────────────────────────────────
const buildImpactNodes = (data: ImpactData, brokenFileIds: string[], compiling: boolean): Node[] => {
  const targetNode = mockFileNodes.find(n => mockImpactData[n.id]?.targetFile === data.targetFile);
  const nodes: Node[] = [];

  if (targetNode) {
    nodes.push({
      id: targetNode.id, type: 'customNode',
      position: { x: 320, y: 240 },
      data: {
        label: targetNode.name,
        type: targetNode.type,
        linesOfCode: targetNode.linesOfCode,
        importCount: targetNode.importCount,
        exportCount: targetNode.exportCount,
        complexity: targetNode.complexity,
        isBroken: brokenFileIds.includes(targetNode.name),
        highlighted: compiling,
      },
    });
  }

  const direct = data.directDependents;
  direct.forEach((name, i) => {
    const angle = (i / direct.length) * 2 * Math.PI;
    const isBroken = brokenFileIds.includes(name);
    nodes.push({
      id: `direct-${i}`, type: 'customNode',
      position: { x: 320 + Math.cos(angle) * 220, y: 240 + Math.sin(angle) * 180 },
      data: {
        label: name,
        type: 'component',
        linesOfCode: 180,
        importCount: 3,
        exportCount: 1,
        complexity: 5,
        isBroken: isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
        highlighted: compiling || isBroken,
      },
    });
  });

  const transitive = data.transitiveDependents.slice(0, 5);
  transitive.forEach((name, i) => {
    const angle = (i / transitive.length) * 2 * Math.PI + 0.5;
    const isBroken = brokenFileIds.includes(name);
    nodes.push({
      id: `transitive-${i}`, type: 'customNode',
      position: { x: 320 + Math.cos(angle) * 420, y: 240 + Math.sin(angle) * 340 },
      data: {
        label: name,
        type: 'page',
        linesOfCode: 320,
        importCount: 8,
        exportCount: 1,
        complexity: 12,
        isBroken: isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
        highlighted: compiling || isBroken,
      },
    });
  });

  return nodes;
};

const buildImpactEdges = (data: ImpactData, targetId: string, compiling: boolean, brokenFileIds: string[]): Edge[] => {
  const edges: Edge[] = [];
  data.directDependents.forEach((name, i) => {
    const isBroken = brokenFileIds.includes(name);
    edges.push({
      id: `de-${i}`,
      source: targetId,
      target: `direct-${i}`,
      type: 'customEdge',
      animated: compiling,
      data: {
        label: 'imports symbols',
        highlighted: compiling || isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
      },
      style: {
        stroke: compiling || isBroken ? '#fb7185' : 'rgba(255, 69, 0, 0.35)',
        strokeWidth: compiling || isBroken ? 2 : 1
      }
    });
  });

  data.transitiveDependents.slice(0, 5).forEach((name, i) => {
    const srcIdx = i % data.directDependents.length;
    const isBroken = brokenFileIds.includes(name);
    edges.push({
      id: `te-${i}`,
      source: `direct-${srcIdx}`,
      target: `transitive-${i}`,
      type: 'customEdge',
      animated: compiling,
      data: {
        label: 'transitive import',
        highlighted: compiling || isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
      },
      style: {
        stroke: compiling || isBroken ? '#fbbf24' : 'rgba(218, 165, 32, 0.2)',
        strokeWidth: compiling || isBroken ? 1.5 : 1
      }
    });
  });

  return edges;
};

// ── Line-by-Line Syntax Highlighting Diff ───────────────────────────────────
const DiffLineViewer: React.FC<{ code: string }> = ({ code }) => {
  const lines = code.split('\n');
  return (
    <div className="flex flex-col font-mono text-[10px] leading-relaxed select-text w-full h-full overflow-y-auto">
      {lines.map((line, i) => {
        let cls = "text-slate-500 px-3 py-0.5";
        if (line.startsWith('-')) {
          cls = "bg-rose-500/10 text-rose-300 border-l-2 border-rose-500/60 px-3 py-0.5 font-medium";
        } else if (line.startsWith('+')) {
          cls = "bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500/60 px-3 py-0.5 font-medium";
        }
        return (
          <div key={i} className={`flex items-start gap-4 hover:bg-white/[0.02] transition-colors ${cls}`}>
            <span className="w-6 text-[8px] text-slate-600 text-right select-none font-sans mt-0.5">{i + 1}</span>
            <span className="whitespace-pre">{line}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Impact Analysis Page ──────────────────────────────────────────────────
const buildRealImpactNodes = (data: any, brokenFileIds: string[], compiling: boolean): Node[] => {
  const nodes: Node[] = [];
  const target = data.targetNode;
  if (!target) return [];

  // Target Node in center
  nodes.push({
    id: target.id,
    type: 'customNode',
    position: { x: 320, y: 240 },
    data: {
      label: target.label,
      type: target.type,
      linesOfCode: (target.metadata?.linesOfCode as number) || 120,
      importCount: (target.metadata?.imports_count as number) || 0,
      exportCount: (target.metadata?.exports_count as number) || 0,
      complexity: (target.metadata?.complexity as number) || 1,
      isBroken: brokenFileIds.includes(target.label),
      highlighted: compiling,
    },
  });

  // Upstream dependencies
  const upstream = data.upstreamDependencies || [];
  upstream.forEach((node: any, i: number) => {
    const angle = Math.PI - (i / Math.max(1, upstream.length)) * Math.PI + 0.5;
    const isBroken = brokenFileIds.includes(node.label);
    nodes.push({
      id: node.id,
      type: 'customNode',
      position: { x: 320 + Math.cos(angle) * 220, y: 240 + Math.sin(angle) * 180 },
      data: {
        label: node.label,
        type: node.type,
        linesOfCode: (node.metadata?.linesOfCode as number) || 100,
        importCount: (node.metadata?.imports_count as number) || 0,
        exportCount: (node.metadata?.exports_count as number) || 0,
        complexity: (node.metadata?.complexity as number) || 1,
        isBroken: isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
        highlighted: compiling || isBroken,
      },
    });
  });

  // Downstream dependencies
  const downstream = data.downstreamDependencies || [];
  downstream.forEach((node: any, i: number) => {
    const angle = (i / Math.max(1, downstream.length)) * Math.PI - 0.5;
    const isBroken = brokenFileIds.includes(node.label);
    nodes.push({
      id: node.id,
      type: 'customNode',
      position: { x: 320 + Math.cos(angle) * 220, y: 240 + Math.sin(angle) * 180 },
      data: {
        label: node.label,
        type: node.type,
        linesOfCode: (node.metadata?.linesOfCode as number) || 100,
        importCount: (node.metadata?.imports_count as number) || 0,
        exportCount: (node.metadata?.exports_count as number) || 0,
        complexity: (node.metadata?.complexity as number) || 1,
        isBroken: isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
        highlighted: compiling || isBroken,
      },
    });
  });

  return nodes;
};

const buildRealImpactEdges = (data: any, compiling: boolean, brokenFileIds: string[]): Edge[] => {
  const edges: Edge[] = [];
  const targetId = data.targetNode?.id;
  if (!targetId) return [];

  // Upstream edges
  const upstream = data.upstreamDependencies || [];
  upstream.forEach((node: any, i: number) => {
    const isBroken = brokenFileIds.includes(node.label);
    edges.push({
      id: `ue-${i}`,
      source: node.id,
      target: targetId,
      type: 'customEdge',
      animated: compiling,
      data: {
        label: 'depends on',
        highlighted: compiling || isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
      },
      style: {
        stroke: compiling || isBroken ? '#fbbb24' : 'rgba(255, 69, 0, 0.35)',
        strokeWidth: compiling || isBroken ? 2 : 1
      }
    });
  });

  // Downstream edges
  const downstream = data.downstreamDependencies || [];
  downstream.forEach((node: any, i: number) => {
    const isBroken = brokenFileIds.includes(node.label);
    edges.push({
      id: `de-${i}`,
      source: targetId,
      target: node.id,
      type: 'customEdge',
      animated: compiling,
      data: {
        label: 'is imported by',
        highlighted: compiling || isBroken,
        dimmed: !compiling && !isBroken && brokenFileIds.length > 0,
      },
      style: {
        stroke: compiling || isBroken ? '#fb7185' : 'rgba(255, 69, 0, 0.35)',
        strokeWidth: compiling || isBroken ? 2 : 1
      }
    });
  });

  return edges;
};

// ── Impact Analysis PageInner ──────────────────────────────────────────────
const ImpactAnalysisInner: React.FC = () => {
  const { analysisId, repoName } = useRepo();
  const targetFiles = Object.entries(mockImpactData);
  const [selectedKey, setSelectedKey] = useState(targetFiles[0][0]);
  const mockData = mockImpactData[selectedKey];

  // Real Impact Analysis state
  const [targetSearch, setTargetSearch] = useState<string | null>(null);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const realImpactState = useImpactAnalysisReal(analysisId ?? '', targetSearch, repoName ?? '');

  // Change Simulation (real endpoint)
  const [simTarget, setSimTarget] = useState('');
  const [simDismissedWarning, setSimDismissedWarning] = useState(false);
  const changeSimReal = useChangeSimulationReal(analysisId ?? '', repoName ?? '');

  // Refactoring Simulation States
  const [simulationActive, setSimulationActive] = useState(false);
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0);
  const [compiling, setCompiling] = useState(false);
  const [compilationProgress, setCompilationProgress] = useState(0);
  const [compilationLogs, setCompilationLogs] = useState<string[]>([]);
  const [brokenFileIds, setBrokenFileIds] = useState<string[]>([]);
  const [isCompilingDone, setIsCompilingDone] = useState(false);
  const [liveBlastCount, setLiveBlastCount] = useState(0);

  const scenarios = mockRefactorScenarios[selectedKey] || [];
  const currentScenario = scenarios[selectedScenarioIdx];

  // Unified Data computed dynamically
  const data = React.useMemo<ImpactData>(() => {
    if (analysisId && realImpactState.data) {
      const d = realImpactState.data;
      const riskLvl = d.riskScore > 75 ? 'critical' : d.riskScore > 50 ? 'high' : d.riskScore > 25 ? 'medium' : 'low';
      return {
        targetFile: d.targetNode?.label || '',
        riskLevel: riskLvl as ImpactData['riskLevel'],
        riskScore: d.riskScore,
        directDependents: d.downstreamDependencies.map(node => node.label),
        transitiveDependents: d.affectedFiles.filter(f => f !== d.targetNode?.label && !d.downstreamDependencies.some(node => node.label === f)),
        affectedTests: [],
        recommendations: [d.explanation || 'No recommendation available.'],
        aiAnalysis: d.explanation || 'No recommendation available.',
      };
    }
    // Empty default data for real mode before a search query is submitted
    if (analysisId && !realImpactState.data) {
      return {
        targetFile: '',
        riskLevel: 'low' as ImpactData['riskLevel'],
        riskScore: 0,
        directDependents: [],
        transitiveDependents: [],
        affectedTests: [],
        recommendations: [],
        aiAnalysis: '',
      };
    }
    return mockData;
  }, [analysisId, realImpactState.data, mockData]);

  // Compute Nodes and Edges based on source
  const flowNodes = React.useMemo(() => {
    if (analysisId) {
      if (realImpactState.data) {
        return buildRealImpactNodes(realImpactState.data, brokenFileIds, compiling);
      }
      return [];
    }
    return buildImpactNodes(mockData, brokenFileIds, compiling);
  }, [analysisId, realImpactState.data, mockData, brokenFileIds, compiling]);

  const flowEdges = React.useMemo(() => {
    if (analysisId) {
      if (realImpactState.data) {
        return buildRealImpactEdges(realImpactState.data, compiling, brokenFileIds);
      }
      return [];
    }
    return buildImpactEdges(mockData, selectedKey, compiling, brokenFileIds);
  }, [analysisId, realImpactState.data, mockData, selectedKey, compiling, brokenFileIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync state with memoized nodes and edges
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Reset simulation when selected target changes
  useEffect(() => {
    setSimulationActive(false);
    setSelectedScenarioIdx(0);
    setCompiling(false);
    setCompilationProgress(0);
    setCompilationLogs([]);
    setBrokenFileIds([]);
    setIsCompilingDone(false);
    setLiveBlastCount(0);
  }, [selectedKey, targetSearch]);

  // Live Blast radius counter sequence
  useEffect(() => {
    if (compiling) {
      setLiveBlastCount(0);
      const totalBroken = currentScenario?.affectedFiles.filter(f => f.status === 'broken').length || 0;
      const interval = setInterval(() => {
        setLiveBlastCount(prev => {
          const limit = totalBroken + 1;
          if (prev < limit) {
            return prev + 1;
          } else {
            clearInterval(interval);
            return prev;
          }
        });
      }, 400);
      return () => clearInterval(interval);
    }
  }, [compiling, currentScenario]);

  const runSimulation = () => {
    if (!currentScenario) return;
    setCompiling(true);
    setCompilationProgress(0);
    setIsCompilingDone(false);
    setCompilationLogs([]);
    setBrokenFileIds([]);

    const logSteps = [
      { text: `Indexing AST modifications in ${data.targetFile}...`, delay: 300, progress: 15 },
      { text: 'Validating compiler tokens... success', delay: 700, progress: 30 },
      ...currentScenario.affectedFiles.map((f, idx) => ({
        text: `Testing dependency compilation: ${f.path}... ${f.status === 'success' ? 'SUCCESS' : 'FAILED'}`,
        delay: 1000 + idx * 600,
        progress: 30 + Math.ceil(((idx + 1) / currentScenario.affectedFiles.length) * 60),
        brokenFile: f.status === 'broken' ? f.path : null
      })),
      { text: 'Compiler validation finished.', delay: 1000 + currentScenario.affectedFiles.length * 600 + 400, progress: 100 }
    ];

    logSteps.forEach((step, idx) => {
      setTimeout(() => {
        setCompilationProgress(step.progress);
        setCompilationLogs(prev => [...prev, step.text]);
        if ('brokenFile' in step && step.brokenFile) {
          setBrokenFileIds(prev => [...prev, step.brokenFile!.split('/').pop()!]);
        }
        if (idx === logSteps.length - 1) {
          setCompiling(false);
          setIsCompilingDone(true);
        }
      }, step.delay);
    });
  };

  const riskBadge: Record<ImpactData['riskLevel'], string> = {
    low: 'badge-green', medium: 'badge-indigo', high: 'badge-yellow', critical: 'badge-red',
  };

  const riskIcon = {
    low: CheckCircle, medium: AlertCircle, high: AlertTriangle, critical: XCircle,
  }[data.riskLevel];
  const RiskIcon = riskIcon;

  return (
    <div className="flex h-[calc(100vh-56px)] font-sans relative">
      {/* Scan line overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 opacity-[0.015]" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 6px 100%' }} />

      {/* No-repo banner — shown inline above controls when no real analysis exists */}
      {!analysisId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass rounded-xl px-5 py-3 border border-amber-500/20 bg-amber-500/5 flex items-center gap-3 shadow-xl pointer-events-none">
          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-200 font-medium">No repository imported — showing demo data. Import a repo from the Dashboard to analyse real impact.</span>
        </div>
      )}

      {/* Left Controls */}
      <div className={`glass border-r border-white/12 flex flex-col flex-shrink-0 overflow-y-auto p-5 space-y-5 transition-all duration-300 bg-white/[0.005] ${
        simulationActive ? 'w-[420px]' : 'w-72'
      }`}>
        <div>
          <h1 className="font-bold text-slate-100 flex items-center gap-2 font-[Syne]">
            <Zap size={18} className="text-rose-400" />
            Impact Analysis
          </h1>
          <p className="text-xs text-slate-550 mt-1">Select a file to visualize blast radius and risk.</p>
        </div>

        {!simulationActive ? (
          <>
            {/* File Selector - Only show for Mock mode */}
            {!analysisId ? (
              <div>
                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2 block font-bold">Target File</label>
                <div className="space-y-1">
                  {targetFiles.map(([key, d]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 group border border-transparent ${
                        selectedKey === key
                          ? 'glass-rose border border-rose-500/25 bg-rose-500/[0.02] shadow-sm'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <FileCode size={13} className={selectedKey === key ? 'text-rose-400' : 'text-slate-600'} />
                      <span className={`text-xs font-mono truncate ${selectedKey === key ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-350'}`}>
                        {d.targetFile.split('/').pop()}
                      </span>
                      <span className={`badge ${riskBadge[d.riskLevel]} ml-auto flex-shrink-0 text-[9px]`}>{d.riskLevel}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass rounded-xl p-3 border border-white/5 bg-white/[0.01]">
                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-bold mb-1.5">Selected Target</label>
                <div className="text-xs text-slate-200 font-mono truncate">
                  {targetSearch || 'None (use search on right)'}
                </div>
              </div>
            )}

            {/* Analytical Metrics Engine Banner */}
            <div className="p-4 rounded-2xl bg-[#0E0E0E] border border-[#FF4D4D]/25 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#FF4D4D]">Blast Radius Engine</span>
                <span className="badge badge-red text-[8px] uppercase font-bold">{data.riskLevel} Risk</span>
              </div>
              
              <div className="flex items-baseline gap-1 text-2xl font-extrabold font-mono text-slate-100">
                {data.riskScore} <span className="text-[10px] text-slate-600 font-normal">/ 100 Risk Index</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-slate-300 font-mono text-[10px]">
                <div className="p-2 bg-[#131313] border border-[#222222] rounded-lg">
                  <div className="text-slate-500 text-[8px] uppercase font-bold">Direct Dependents</div>
                  <div className="text-xs font-bold text-[#FF6B1A] mt-1">{data.directDependents.length}</div>
                </div>
                <div className="p-2 bg-[#131313] border border-[#222222] rounded-lg">
                  <div className="text-slate-500 text-[8px] uppercase font-bold">Indirect Dependents</div>
                  <div className="text-xs font-bold text-[#FFB347] mt-1">{data.transitiveDependents.length}</div>
                </div>
              </div>
            </div>

            {/* Affected Areas */}
            <div className="bg-[#0E0E0E] border border-[#222222] rounded-2xl p-4 space-y-2.5 text-left">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                Affected Areas ({data.targetFile.includes('api.ts') ? 4 : data.targetFile.includes('AuthContext') ? 4 : 3})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(data.targetFile.includes('api.ts')
                  ? ['Authentication', 'Billing', 'Notifications', 'API Client']
                  : data.targetFile.includes('AuthContext')
                  ? ['Authentication', 'User Profiles', 'Route Guards', 'JWT Storage']
                  : ['General Routing', 'State Pipeline', 'Utility Library']
                ).map(area => (
                  <span key={area} className="px-2.5 py-1 rounded-lg bg-[#FF6B1A]/10 border border-[#FF6B1A]/20 text-[9px] font-mono text-[#FFB347] font-semibold">
                    {area}
                  </span>
                ))}
              </div>
            </div>

            {/* Direct Dependents */}
            <div className="bg-[#0E0E0E] border border-[#222222] rounded-2xl p-4 text-left">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Direct Dependents
              </div>
              {data.directDependents.length === 0 ? (
                <div className="text-[10px] text-slate-600 italic font-mono">No direct dependents.</div>
              ) : (
                data.directDependents.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-xs text-rose-400/85 font-mono">
                    <ArrowRight size={10} className="opacity-50" />
                    {f}
                  </div>
                ))
              )}
            </div>

            {/* Transitive */}
            <div className="bg-[#0E0E0E] border border-[#222222] rounded-2xl p-4 text-left">
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                Transitive Dependents
              </div>
              {data.transitiveDependents.length === 0 ? (
                <div className="text-[10px] text-slate-600 italic font-mono">No transitive dependents.</div>
              ) : (
                data.transitiveDependents.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-xs text-yellow-500/75 font-mono">
                    <ArrowRight size={10} className="opacity-50" />
                    {f}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Refactor Simulator Left Controls */
          <div className="space-y-4 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[9px] text-[#FF4500] font-bold uppercase tracking-widest font-mono">Refactor Simulation</span>
              <button
                onClick={() => setSimulationActive(false)}
                className="text-[10px] hover:text-slate-200 text-slate-500 font-mono font-bold tracking-wider"
              >
                [Exit Simulator]
              </button>
            </div>

            {/* Scenario Selector */}
            {scenarios.length > 0 ? (
              <div>
                <label className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 block font-mono font-bold">Refactor Scenarios</label>
                <div className="space-y-1.5">
                  {scenarios.map((scen, idx) => (
                    <button
                      key={scen.id}
                      onClick={() => {
                        setSelectedScenarioIdx(idx);
                        setIsCompilingDone(false);
                        setCompilationLogs([]);
                        setBrokenFileIds([]);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border ${
                        selectedScenarioIdx === idx
                          ? 'glass border-[#FF4500]/30 bg-[#FF4500]/[0.01]'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-200">{scen.title}</div>
                      <p className="text-[10px] text-slate-500 leading-relaxed mt-1 font-light">{scen.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass rounded-xl p-4 text-center border border-white/5">
                <span className="text-xs text-slate-500 font-light">No refactoring simulations available for this file.</span>
              </div>
            )}

            {/* Run Button */}
            {currentScenario && (
              <button
                onClick={runSimulation}
                disabled={compiling}
                className="w-full py-2.5 bg-gradient-to-r from-[#FF4500] to-[#FF6F61] hover:from-[#FF6F61] hover:to-[#DAA520] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-glow-rose"
              >
                {compiling ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Compiling Dependencies... {compilationProgress}%
                  </>
                ) : (
                  <>
                    <Play size={13} /> Run Impact Compilation
                  </>
                )}
              </button>
            )}

            {/* Compilation Logs */}
            {compilationLogs.length > 0 && (
              <div className="glass rounded-xl p-3 border border-white/5 bg-black/35 font-mono text-[9px] space-y-1 max-h-[130px] overflow-y-auto shadow-inner text-left select-none">
                {compilationLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.includes('FAILED')
                        ? 'text-rose-400 font-semibold'
                        : log.includes('SUCCESS')
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}

            {/* Post Simulation Report Card */}
            {isCompilingDone && currentScenario && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-4 border border-rose-500/25 bg-rose-500/[0.01] space-y-3.5 shadow-2xl text-left"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-mono text-rose-350 uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    Simulation Report
                  </span>
                  <span className={`badge ${riskBadge[data.riskLevel]} text-[9px]`}>{data.riskLevel.toUpperCase()} RISK</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono text-slate-550 uppercase">Regressions</span>
                    <span className="text-sm font-bold text-rose-400 mt-0.5">🔴 {brokenFileIds.length} broken</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono text-slate-550 uppercase">Successful</span>
                    <span className="text-sm font-bold text-emerald-400 mt-0.5">🟢 {currentScenario.affectedFiles.length - brokenFileIds.length} OK</span>
                  </div>
                  <div className="flex flex-col mt-1">
                    <span className="text-[9px] font-mono text-slate-550 uppercase">Est. Fix Time</span>
                    <span className="text-xs font-mono font-bold text-slate-200 mt-0.5">~2.5 hours</span>
                  </div>
                  <div className="flex flex-col mt-1">
                    <span className="text-[9px] font-mono text-slate-550 uppercase">Safety Rating</span>
                    <span className="text-xs font-mono font-bold text-yellow-450 mt-0.5">CRITICAL DUST</span>
                  </div>
                </div>
                <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-slate-300 font-mono border border-white/5 active:scale-95 transition-all">
                  EXPORT CRASH REPORT
                </button>
              </motion.div>
            )}

            {/* Regression list outputs */}
            {isCompilingDone && currentScenario && (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center justify-between font-mono">
                  <span>Detailed File Log</span>
                  <span className="badge badge-red text-[9px]">{brokenFileIds.length} regressions</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 bg-white/[0.005] rounded-xl border border-white/5 p-2">
                  {currentScenario.affectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className={`glass rounded-xl p-3 border transition-all ${
                        file.status === 'broken' ? 'border-rose-500/20 bg-rose-500/[0.01]' : 'border-emerald-500/10 bg-emerald-500/[0.002]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-mono text-slate-300 truncate max-w-[190px]">{file.path}</span>
                        {file.status === 'broken' ? (
                          <span className="badge badge-red text-[8px]">Broken</span>
                        ) : (
                          <span className="badge badge-green text-[8px]">Compiled</span>
                        )}
                      </div>

                      {file.status === 'broken' ? (
                        <div className="space-y-2 mt-2">
                          <div className="bg-black/40 rounded p-2.5 text-[9px] font-mono text-rose-350 border-l-2 border-rose-500">
                            {file.explanation}
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-600 block uppercase tracking-wider mb-1 font-bold">Proposed Fix</span>
                            <pre className="text-[9px] font-mono text-emerald-400 bg-emerald-950/10 p-2.5 rounded max-h-20 overflow-y-auto whitespace-pre-wrap break-all leading-normal">
                              {file.proposedFixSnippet}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-500 leading-normal flex items-center gap-1.5 font-light">
                          <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" /> Compiled successfully.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Graph + AI Analysis */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        {/* AI Analysis Banner */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="flex-1 max-w-3xl mr-4 text-left space-y-3">
            {/* Real Impact Analysis Section */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-widest font-bold">What breaks if I change:</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={targetSearch || ''}
                    onChange={(e) => setTargetSearch(e.target.value || null)}
                    placeholder="Enter function, class, or file..."
                    className="w-full px-3 py-2.5 bg-[#131313] border border-[#222222] rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-[#FF6B1A]/50 font-mono"
                  />
                  <Search size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Real Impact Analysis Data Panel */}
            <ImpactDetailsPanel
              data={realImpactState.data}
              loading={realImpactState.loading}
              error={realImpactState.error}
              warning={dismissedWarning ? undefined : realImpactState.warning}
              onDismissWarning={() => setDismissedWarning(true)}
            />

            {/* Change Simulation Panel */}
            <div className="rounded-2xl p-4 border border-[#222222] bg-[#0E0E0E] space-y-3 mt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-widest font-bold">Impact Simulation</p>
                  <p className="text-xs text-slate-500 mt-1">Estimate blast radius when a node changes</p>
                </div>
                {changeSimReal.data && (
                  <span
                    className={`badge text-[9px] ${
                      changeSimReal.data.source === 'neo4j' ? 'badge-green' : 'badge-slate'
                    }`}
                  >
                    {changeSimReal.data.source === 'neo4j' ? 'Neo4j' : 'Mock'}
                  </span>
                )}
              </div>

              {/* Input + Run button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="change-sim-target-input"
                    type="text"
                    value={simTarget}
                    onChange={(e) => {
                      setSimTarget(e.target.value);
                      if (changeSimReal.data || changeSimReal.error) changeSimReal.reset();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && simTarget.trim()) changeSimReal.run(simTarget);
                    }}
                    placeholder="function, class, or file..."
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/12 rounded-lg text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-[#FF4500]/50 font-mono"
                  />
                </div>
                <button
                  id="change-sim-run-btn"
                  onClick={() => simTarget.trim() && changeSimReal.run(simTarget)}
                  disabled={changeSimReal.loading || !simTarget.trim()}
                  className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-[#FF4500] to-[#FF6F61] hover:from-[#FF6F61] hover:to-[#DAA520] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {changeSimReal.loading ? (
                    <><Loader2 size={12} className="animate-spin" /> Running...</>
                  ) : (
                    <><Play size={12} /> Run</>)
                  }
                </button>
              </div>

              {/* Warning banner */}
              {changeSimReal.warning && !simDismissedWarning && (
                <div className="flex items-center justify-between gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-yellow-400 font-mono">{changeSimReal.warning}</span>
                  <button
                    onClick={() => setSimDismissedWarning(true)}
                    className="text-yellow-500/60 hover:text-yellow-400 text-[10px] font-bold flex-shrink-0"
                  >✕</button>
                </div>
              )}

              {/* Error */}
              {changeSimReal.error && (
                <div className="text-[10px] text-rose-400 font-mono">{changeSimReal.error}</div>
              )}

              {/* Empty state */}
              {!changeSimReal.loading && !changeSimReal.data && !changeSimReal.error && !simTarget.trim() && (
                <div className="text-[10px] text-slate-600 font-mono text-center py-2">
                  Enter a target above and click Run to simulate a change.
                </div>
              )}

              {/* Results */}
              {changeSimReal.data && (
                <div className="space-y-3">
                  {/* Target node */}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="text-slate-600">Target:</span>
                    <span className="text-slate-200 font-semibold">{changeSimReal.data.target.label}</span>
                    <span className="badge badge-slate text-[8px]">{changeSimReal.data.target.type}</span>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                    <div className="glass rounded-xl p-3 border border-white/5 bg-white/[0.01]">
                      <div className="text-[8px] uppercase tracking-wider font-semibold text-slate-500">Directly Affected Files</div>
                      <div className="text-sm text-slate-200 font-semibold mt-2">{changeSimReal.data.directlyAffectedFiles.length}</div>
                      {changeSimReal.data.directlyAffectedFiles.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {changeSimReal.data.directlyAffectedFiles.slice(0, 3).map((f, i) => (
                            <div key={i} className="text-[8px] text-rose-400/80 truncate flex items-center gap-1">
                              <ArrowRight size={7} />{f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="glass rounded-xl p-3 border border-white/5 bg-white/[0.01]">
                      <div className="text-[8px] uppercase tracking-wider font-semibold text-slate-500">Directly Affected Fns</div>
                      <div className="text-sm text-slate-200 font-semibold mt-2">{changeSimReal.data.directlyAffectedFunctions.length}</div>
                      {changeSimReal.data.directlyAffectedFunctions.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {changeSimReal.data.directlyAffectedFunctions.slice(0, 3).map((f, i) => (
                            <div key={i} className="text-[8px] text-[#FF6F61]/80 truncate flex items-center gap-1">
                              <ArrowRight size={7} />{f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="glass rounded-xl p-3 border border-white/5 bg-white/[0.01]">
                      <div className="text-[8px] uppercase tracking-wider font-semibold text-slate-500">Indirectly Affected Fns</div>
                      <div className="text-sm text-slate-200 font-semibold mt-2">{changeSimReal.data.indirectlyAffectedFunctions.length}</div>
                    </div>
                    <div className="glass rounded-xl p-3 border border-white/5 bg-white/[0.01]">
                      <div className="text-[8px] uppercase tracking-wider font-semibold text-slate-500">Affected Classes</div>
                      <div className="text-sm text-slate-200 font-semibold mt-2">{changeSimReal.data.affectedClasses.length}</div>
                    </div>
                  </div>

                  {/* Blast radius + risk */}
                  <div className="glass rounded-xl p-3 border border-white/5 bg-white/[0.01] text-[10px] font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 uppercase text-[8px] tracking-wider">Blast Radius</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Direct</span>
                      <span className="text-rose-400 font-bold">{changeSimReal.data.blastRadius.direct}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Indirect</span>
                      <span className="text-yellow-400 font-bold">{changeSimReal.data.blastRadius.indirect}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-1.5 mt-1">
                      <span className="text-slate-200 font-semibold">Total</span>
                      <span className="text-[#FF4500] font-bold">{changeSimReal.data.blastRadius.total}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
                      <span className="text-slate-200 font-semibold">Risk Score</span>
                      <span
                        className={`font-bold ${
                          changeSimReal.data.riskScore >= 80 ? 'text-rose-400' :
                          changeSimReal.data.riskScore >= 60 ? 'text-yellow-400' :
                          changeSimReal.data.riskScore >= 40 ? 'text-[#FF4500]' :
                          'text-emerald-400'
                        }`}
                      >
                        {changeSimReal.data.riskScore}/100
                      </span>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="text-[10px] text-slate-400 leading-relaxed font-mono">
                    {changeSimReal.data.explanation}
                  </div>
                </div>
              )}
            </div>

            {/* Fallback: Mock AI Risk Assessment */}
            {!targetSearch && (
              <GlassCard variant="rose" animate={false} padding="sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                    <RiskIcon size={15} className="text-rose-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-rose-300 mb-1 flex items-center gap-2 font-[Syne]">
                      AI Risk Assessment
                      <span className={`badge ${riskBadge[data.riskLevel]} text-[9px]`}>{data.riskLevel.toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line line-clamp-2 font-light">
                      {data.aiAnalysis.split('\n\n')[0]}
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>

          {/* Live blast radius compiler banner (Incremental Blast Counter) */}
          {simulationActive && compiling && (
            <div className="flex items-center gap-2 text-[10px] text-rose-400 font-mono font-bold bg-rose-500/10 border border-rose-500/25 px-3 py-2 rounded-xl animate-pulse flex-shrink-0 mr-2 shadow-glow-rose">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              <span>Propagating... Blast radius: {liveBlastCount} broken files</span>
            </div>
          )}

          {/* Trigger Button to Open Refactor Simulator */}
          {scenarios.length > 0 && !simulationActive && (
            <button
              onClick={() => setSimulationActive(true)}
              className="glass px-4 py-2 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 flex-shrink-0"
            >
              <Settings size={13} className="animate-spin-slow" /> Simulate Refactoring
            </button>
          )}
        </div>

        {/* Blast Radius Graph or Code Editor split */}
        <div className="flex-1 relative flex flex-col animate-fade-in">
          {data && (
            <div className="mx-6 mt-4 p-4 rounded-2xl border border-[#222222] bg-[#0E0E0E] flex flex-col md:flex-row items-center justify-between gap-4 z-10">
              {/* Target Node */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FF6B1A]/10 border border-[#FF6B1A]/20 flex items-center justify-center text-[#FF6B1A]">
                  <FileCode size={14} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-[#A0A0A0] uppercase font-mono font-bold">Selected File</div>
                  <div className="text-xs font-mono font-semibold text-[#F5F5F5]">{data.targetFile.split('/').pop()}</div>
                </div>
              </div>

              <ChevronRight size={14} className="text-[#666666] hidden md:block" />

              {/* Direct Dependents */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FFB347]/10 border border-[#FFB347]/20 flex items-center justify-center text-[#FFB347]">
                  <ArrowRight size={14} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-[#A0A0A0] uppercase font-mono font-bold">Direct Dependents</div>
                  <div className="text-xs font-mono font-semibold text-[#F5F5F5]">{data.directDependents.length} files</div>
                </div>
              </div>

              <ChevronRight size={14} className="text-[#666666] hidden md:block" />

              {/* Transitive Dependents */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 flex items-center justify-center text-[#FF4D4D]">
                  <Layers size={14} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-[#A0A0A0] uppercase font-mono font-bold">Transitive Dependents</div>
                  <div className="text-xs font-mono font-semibold text-[#F5F5F5]">{data.transitiveDependents.length} files</div>
                </div>
              </div>

              <ChevronRight size={14} className="text-[#666666] hidden md:block" />

              {/* Risk Profile */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  data.riskLevel === 'low' ? 'bg-[#4ADE80]/10 border border-[#4ADE80]/20 text-[#4ADE80]' : 'bg-[#FF4D4D]/10 border border-[#FF4D4D]/20 text-[#FF4D4D]'
                }`}>
                  <AlertTriangle size={14} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-[#A0A0A0] uppercase font-mono font-bold">Risk Rating</div>
                  <div className={`text-xs font-mono font-bold uppercase ${
                    data.riskLevel === 'low' ? 'text-[#4ADE80]' : 'text-[#FF4D4D]'
                  }`}>{data.riskLevel}</div>
                </div>
              </div>
            </div>
          )}
          {simulationActive && currentScenario && (
            /* Syntax-highlighted Diff view on top */
            <div className="h-[210px] border-b border-white/5 grid grid-cols-2 overflow-hidden bg-void-950/20 shadow-inner">
              <div className="border-r border-white/5 flex flex-col h-full min-w-0">
                <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 text-[9px] font-mono text-slate-550 flex items-center justify-between font-bold">
                  <span>ORIGINAL CODE: {data.targetFile.split('/').pop()}</span>
                  <span className="text-rose-400/80 uppercase font-mono">[-] Deletions</span>
                </div>
                <div className="flex-1 overflow-auto bg-rose-950/[0.005]">
                  <DiffLineViewer code={currentScenario.originalCode} />
                </div>
              </div>
              <div className="flex flex-col h-full min-w-0">
                <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 text-[9px] font-mono text-slate-550 flex items-center justify-between font-bold">
                  <span>PROPOSED REFACTOR</span>
                  <span className="text-emerald-400/80 uppercase font-mono">[+] Additions</span>
                </div>
                <div className="flex-1 overflow-auto bg-emerald-950/[0.005]">
                  <DiffLineViewer code={currentScenario.refactoredCode} />
                </div>
              </div>
            </div>
          )}

          {/* Thin Compilation Progress Bar (Absolute positioned at top of canvas) */}
          {compiling && (
            <div className="absolute top-0 left-0 w-full h-[2.5px] bg-white/5 z-40 overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${compilationProgress}%` }}
                className="h-full bg-gradient-to-r from-[#FF4500] via-[#FF6F61] to-[#DAA520] shadow-glow-rose"
                transition={{ ease: 'easeOut' }}
              />
            </div>
          )}

          {/* Legend and Flow Canvas */}
          <div className="flex-1 relative">
            <div className="absolute top-4 left-4 z-10 select-none pointer-events-none">
              <div className="glass rounded-xl px-3 py-2 border border-white/6 space-y-1.5 shadow-2xl bg-slate-950/80">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <div className="w-3 h-0.5 bg-rose-500 rounded" />
                  Direct dependent
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <div className="w-3 h-0.5 bg-yellow-500/60 rounded" />
                  Transitive dependent
                </div>
                {simulationActive && (
                  <div className="flex items-center gap-2 text-[10px] text-rose-400 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    Pulsing indicates broken status
                  </div>
                )}
              </div>
            </div>

            {analysisId && !targetSearch ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center z-10 p-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Search size={24} className="text-slate-500 animate-pulse" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-350">No Component Selected</div>
                  <p className="text-xs text-slate-550 mt-1 max-w-xs leading-relaxed">
                    Enter a function, class, or file path in the search box above to analyze its refactoring blast radius.
                  </p>
                </div>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
              >
                <Controls className="bottom-6 left-6" />
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.035)" />
              </ReactFlow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ImpactAnalysis: React.FC = () => (
  <div className="h-[calc(100vh-56px)] bg-void-950">
    <ReactFlowProvider>
      <ImpactAnalysisInner />
    </ReactFlowProvider>
  </div>
);

export default ImpactAnalysis;
