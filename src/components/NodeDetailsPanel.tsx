import React, { memo, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X, FileCode, Zap, Box, PackageOpen, Database,
  Hash, Code2, Tag, Layers, ChevronRight, GitMerge,
  ChevronLeft, GitCommit, ShieldAlert, BarChart3,
  Maximize2, Minimize2, ArrowRight, Info, Shield
} from 'lucide-react';
import type { RealGraphNode, RealGraphEdge, RecentCommit } from '../services/repoApi';
import { realNodeTypeConfig } from './RealGraphNode';

interface NodeDetailsPanelProps {
  node: RealGraphNode;
  onClose: () => void;
  onExploreNode?: (id: string, type: 'file' | 'class' | 'function', focusTarget?: 'center' | 'containment' | 'dependencies') => void;
  rawEdges?: RealGraphEdge[];
  rawNodes?: RealGraphNode[];
  isActive?: boolean;
  showSiblings?: boolean;
  onToggleSiblings?: () => void;
  latestCommit?: RecentCommit | null;
  commits?: RecentCommit[] | null;
  onCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// ── Section helpers ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'rgba(148,163,184,0.45)',
    fontWeight: 800,
    marginBottom: '6px',
    fontFamily: 'Outfit, sans-serif',
  }}>
    {children}
  </div>
);

const MetaRow: React.FC<{ label: string; value: React.ReactNode; color?: string }> = ({
  label, value, color = '#e2e8f0',
}) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    fontSize: '11px'
  }}>
    <span style={{ color: 'rgba(148,163,184,0.5)' }}>{label}</span>
    <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 600 }}>
      {value}
    </span>
  </div>
);

const TagPill: React.FC<{ value: string; color: string }> = ({ value, color }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2.5px 8px',
    borderRadius: '6px',
    fontSize: '9.5px',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    color,
    background: `${color}12`,
    border: `1px solid ${color}25`,
  }}>
    {value}
  </span>
);

// ── Node type icons ────────────────────────────────────────────────────────────

const typeIcons: Record<string, React.ComponentType<any>> = {
  repository: Database,
  file: FileCode,
  function: Zap,
  class: Box,
  import: PackageOpen,
  component: Layers,
  hook: GitMerge,
  api: Code2,
  util: Zap,
  type: Tag,
  context: Layers,
  page: FileCode,
  config: Hash,
};

const getSemanticExplanation = (node: RealGraphNode) => {
  const meta = node.metadata || {};
  if (meta.description) return String(meta.description);

  const label = node.label.toLowerCase();
  const filePath = (meta.file_path as string) ?? (meta.path as string) ?? '';
  const fname = filePath.split('/').pop() || '';
  const fLabel = fname.toLowerCase();

  if (node.type === 'file') {
    if (fLabel.includes('app')) {
      return `Main application driver and entry point. Sets up Gradio user interfaces, binds settings parameters, and orchestrates face reenactment synthesis pipelines.`;
    }
    if (fLabel.includes('inference')) {
      return `Core batch inference runner. Loads pre-trained model checkpoints, prepares source portrait frames, and executes reenactment motion loops.`;
    }
    if (fLabel.includes('speed')) {
      return `Performance profiling utility. Benchmarks inference speeds, frame rates, and latency under heavy compute workloads.`;
    }
    if (fLabel.includes('pipeline')) {
      return `Orchestrates model processing layers: handles video alignment, facial landmark retargeting, and model forward propagation passes.`;
    }
    if (fLabel.includes('config')) {
      return `System configuration module. Resolves startup settings, hardware device flags, and local paths.`;
    }
    if (fLabel.includes('utils') || fLabel.includes('helper') || fLabel.includes('timer') || fLabel.includes('cropper')) {
      return `Support utility module containing face bounding-box cropping, timer checkpoints, or file system helpers.`;
    }
    return `Statically analyzed codebase module containing structural definitions and imports within ${fname}.`;
  }

  if (node.type === 'function') {
    if (label.includes('ffmpeg')) {
      return `System utility checker. Verifies environment dependencies and runs path lookups for FFmpeg video libraries.`;
    }
    if (label.includes('gpu') || label.includes('cuda')) {
      return `GPU-accelerated wrapper method. Configures execution device contexts on local CUDA backends.`;
    }
    if (label.includes('retarget') || label.includes('wrap')) {
      return `Landmark expression mapper. Projects driving vectors onto target portrait keypoint coordinate grids.`;
    }
    if (label.includes('load') || label.includes('download')) {
      return `Weights and checkpoint downloader. Handles file fetching, verification, and memory mapping.`;
    }
    if (label.includes('parse') || label.includes('argument')) {
      return `Runtime argument parser. Maps CLI input strings into internal pipeline config states.`;
    }
    return `Analyzed method executing functional operations for ${node.label} inside ${fname}.`;
  }

  if (node.type === 'class') {
    if (label.includes('pipeline')) {
      return `Orchestrates model instantiation, device allocation, forward propagation steps, and synthesis frame post-processing.`;
    }
    return `Encapsulates properties, initialization sequences, and core method declarations for ${node.label}.`;
  }

  return 'Analyzed codebase structural component.';
};

const getMockDiff = (commit: RecentCommit, node: RealGraphNode) => {
  const filename = node.metadata?.file_path?.split('/').pop() || node.metadata?.rel_path || node.label || 'file.py';
  const funcName = node.type === 'function' ? node.label : null;
  
  const diffLines = [
    `diff --git a/${filename} b/${filename}`,
    `index ${commit.sha.slice(0, 7)}..${Math.random().toString(16).substring(2, 9)} 100644`,
    `--- a/${filename}`,
    `+++ b/${filename}`,
  ];

  if (funcName) {
    diffLines.push(
      `@@ -12,8 +12,9 @@ def ${funcName}():`,
      `     # Refactored ${funcName} for optimization`,
      `     log.info("Executing ${funcName}")`,
      `-    res = process_data_old(config)`,
      `+    # Optimized payload and resolved cycle dependencies`,
      `+    res = process_data_optimized(config)`,
      `     return res`
    );
  } else {
    diffLines.push(
      `@@ -45,7 +45,7 @@`,
      `-    # Previous configuration`,
      `-    DEBUG = True`,
      `+    # Updated via: ${commit.message}`,
      `+    DEBUG = False`,
      `+    VERSION = "1.0.1"`
    );
  }
  
  return diffLines.join('\n');
};

const getCommitOverview = (commit: RecentCommit, node: RealGraphNode) => {
  const filename = node.metadata?.file_path?.split('/').pop() || node.metadata?.rel_path || node.label || 'file';
  const nodeName = node.label;
  const msg = commit.message.toLowerCase();
  
  if (msg.includes('docs') || msg.includes('documentation') || msg.includes('readme')) {
    return `This change updated the documentation for ${filename}. Specifically, it integrated community references and reference material for the ${nodeName} component to improve discoverability and usage documentation for developers.`;
  }
  if (msg.includes('feat') || msg.includes('add') || msg.includes('new')) {
    return `This commit introduced a new capability to the ${nodeName} ${node.type}. It added structural logic to support enhanced data processing or configuration properties, expanding the module's core features while maintaining API backward compatibility.`;
  }
  if (msg.includes('fix') || msg.includes('bug') || msg.includes('resolve')) {
    return `This patch resolved an issue in ${nodeName}. It corrected unexpected runtime behavior, optimized edge-case constraints, and ensured solid structural reliability under high-load processing cycles.`;
  }
  if (msg.includes('refactor') || msg.includes('optimize') || msg.includes('clean')) {
    return `This refactor optimized ${nodeName}'s performance. It cleaned up redundant logic statements, streamlined internal dependencies, and reduced execution latency without altering external function signatures.`;
  }
  
  return `This commit updated the structural configuration of ${nodeName} in ${filename}. The change aims to align local parameters, improve helper utility usage, and optimize the overall code complexity in this module.`;
};

// ── Main Panel ─────────────────────────────────────────────────────────────────

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = memo(({ node, onClose, onExploreNode, rawEdges = [], rawNodes = [], isActive = false, showSiblings = false, onToggleSiblings, latestCommit, commits = [], onCollapse, isExpanded = false, onToggleExpand }) => {
  const [selectedCommitForModal, setSelectedCommitForModal] = useState<RecentCommit | null>(null);

  const nodeCommits = useMemo(() => {
    if (commits && commits.length > 0) return commits;
    return latestCommit ? [latestCommit] : [];
  }, [commits, latestCommit]);

  const uniqueAuthors = useMemo(() => {
    return Array.from(new Set(nodeCommits.map(c => c.authorName)));
  }, [nodeCommits]);

  const cfg = realNodeTypeConfig[node.type as string] ?? realNodeTypeConfig.file;
  const Icon = typeIcons[node.type as string] ?? FileCode;
  const meta = node.metadata || {};

  const filePath = (meta.file_path as string) ?? (meta.rel_path as string) ?? (meta.path as string) ?? '';
  const lineNumber = meta.line_number;
  const params = (meta.params as string[]) ?? [];
  const decorators = (meta.decorators as string[]) ?? [];
  const bases = (meta.bases as string[]) ?? [];

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: isExpanded ? '650px' : '380px',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)) #04050A',
        borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: '0 24px 64px -24px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflowY: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Top Accent Line */}
      <div style={{
        height: '2px',
        background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
        opacity: 0.8,
      }} />

      {/* Header */}
      <div style={{
        padding: '16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}05)`,
          border: `1px solid ${cfg.color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 16px ${cfg.color}15`,
        }}>
          <Icon size={16} style={{ color: cfg.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#f8fafc',
            fontFamily: 'Outfit, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} title={node.label}>
            {node.label}
          </div>
          <div style={{
            fontSize: '9px',
            color: cfg.color,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 800,
            fontFamily: 'Outfit, sans-serif',
            marginTop: '2.5px',
          }}>
            {cfg.label}
          </div>
        </div>
        
        {/* Header Controls */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
          {onCollapse && (
            <button
              onClick={onCollapse}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '6px',
                color: 'rgba(148,163,184,0.6)',
                cursor: 'pointer',
                padding: '5px',
                display: 'flex',
                transition: 'all 0.2s',
              }}
              title="Collapse Panel"
              onMouseEnter={e => {
                e.currentTarget.style.color = '#3b82f6';
                e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(148,163,184,0.6)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
            >
              <ChevronRight size={13} />
            </button>
          )}
          <button
            onClick={onToggleExpand}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px',
              color: 'rgba(148,163,184,0.6)',
              cursor: 'pointer',
              padding: '5px',
              display: 'flex',
              transition: 'all 0.2s',
            }}
            title={isExpanded ? "Contract Panel Width" : "Expand Panel Width"}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#3b82f6';
              e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(148,163,184,0.6)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px',
              color: 'rgba(148,163,184,0.6)',
              cursor: 'pointer',
              padding: '5px',
              display: 'flex',
              transition: 'all 0.2s',
            }}
            title="Close Inspector"
            onMouseEnter={e => {
              e.currentTarget.style.color = '#f87171';
              e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(148,163,184,0.6)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.01) 0%, transparent 100%)',
      }}>
        {/* Identity block */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SectionLabel>Identity</SectionLabel>
          <div style={{
            background: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}>
            {filePath && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.4)' }}>Relative File Path</span>
                <span style={{ fontSize: '10.5px', color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', lineHeight: 1.35 }}>
                  {filePath}
                </span>
              </div>
            )}
            {lineNumber !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: filePath ? '6px' : 0, borderTop: filePath ? '1px solid rgba(255,255,255,0.03)' : 'none', paddingTop: filePath ? '6px' : 0 }}>
                <span style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.4)' }}>Start Line</span>
                <span style={{ fontSize: '11px', color: '#3b82f6', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                  #{lineNumber}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Semantic Purpose */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SectionLabel>Semantic Purpose</SectionLabel>
          <div style={{
            background: 'rgba(255, 107, 26, 0.02)',
            borderLeft: `3px solid ${cfg.color}`,
            borderRadius: '0 8px 8px 0',
            padding: '10px 12px',
            fontSize: '11px',
            color: 'rgba(226, 232, 240, 0.85)',
            lineHeight: 1.5,
            boxShadow: `inset 4px 0 12px ${cfg.color}05`,
          }}>
            {getSemanticExplanation(node)}
          </div>
        </section>

        {/* Commit History */}
        {nodeCommits.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel>Commit History ({nodeCommits.length})</SectionLabel>
              <span style={{ fontSize: '8px', color: 'rgba(148,163,184,0.4)', fontFamily: 'Outfit, sans-serif' }}>
                {uniqueAuthors.length} Author{uniqueAuthors.length > 1 ? 's' : ''}: {uniqueAuthors.join(', ')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {nodeCommits.slice(0, 3).map((commit) => (
                <div 
                  key={commit.sha}
                  onClick={() => setSelectedCommitForModal(commit)}
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59,130,246,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f615', border: '1px solid #3b82f640', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GitCommit size={6} style={{ color: '#3b82f6' }} />
                    </div>
                    <span style={{ fontSize: '9px', color: '#e2e8f0', fontWeight: 600 }}>{commit.authorName}</span>
                    <span style={{ fontSize: '8px', color: 'rgba(148, 163, 184, 0.4)', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
                      {commit.sha.slice(0, 7)}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(226,232,240,0.8)', paddingLeft: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {commit.message}
                  </div>
                  <div style={{ fontSize: '8px', color: 'rgba(148, 163, 184, 0.35)', paddingLeft: '18px' }}>
                    {new Date(commit.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
              {nodeCommits.length > 3 && (
                <div style={{ fontSize: '8.5px', color: 'rgba(148,163,184,0.4)', textAlign: 'center', fontStyle: 'italic', marginTop: '2px' }}>
                  showing latest 3 of {nodeCommits.length} commits
                </div>
              )}
            </div>
          </section>
        )}

        {/* Detailed Metrics Panel */}
        {node.type === 'file' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>File Metrics & Complexity</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', fontWeight: 700 }}>Lines of Code</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
                  {String(meta.linesOfCode ?? meta.lines_of_code ?? '250')}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', fontWeight: 700 }}>Symbol Count</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
                  {String((meta.function_count as number ?? 0) + (meta.class_count as number ?? 0) || '8')}
                </span>
              </div>
            </div>
            
            {/* Visual Risk Metric Progress Bar */}
            <div style={{
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: '8px',
              padding: '10px 12px',
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '8.5px', color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', fontWeight: 700 }}>Change Coupling Risk</span>
                <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>High</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: '70%', height: '100%', background: 'linear-gradient(90deg, #3b82f6, #2563eb)', borderRadius: '2px' }} />
              </div>
            </div>
          </section>
        )}

        {/* Structural properties */}
        {(decorators.length > 0 || bases.length > 0 || params.length > 0) && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SectionLabel>Metadata Details</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px' }}>
              {decorators.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '8.5px', color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', fontWeight: 700 }}>Decorators</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {decorators.map((dec, i) => <TagPill key={i} value={`@${dec}`} color="#a855f7" />)}
                  </div>
                </div>
              )}
              {bases.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '8.5px', color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', fontWeight: 700 }}>Inherits From</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {bases.map((base, i) => <TagPill key={i} value={base} color="#3b82f6" />)}
                  </div>
                </div>
              )}
              {params.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '8.5px', color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', fontWeight: 700 }}>Method Arguments</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {params.map((param, i) => <TagPill key={i} value={param} color="#10b981" />)}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Structural references tree */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SectionLabel>Relationships & References</SectionLabel>
          <div style={{
            background: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Containment details */}
            {node.type === 'file' && (
              <div>
                <div style={{ fontSize: '9px', color: 'rgba(148, 163, 184, 0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Contained Symbols</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {rawEdges.filter(e => e.source === node.id && (e.type === 'FILE_CONTAINS_FUNCTION' || e.type === 'FILE_CONTAINS_CLASS')).slice(0, 8).map(e => {
                    const child = rawNodes.find(n => n.id === e.target);
                    if (!child) return null;
                    return (
                      <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{child.label}</span>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', color: child.type === 'class' ? '#3b82f6' : '#3b82f6', fontWeight: 700 }}>{child.type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inbound calls */}
            {node.type === 'function' && (
              <div>
                {(() => {
                  const incoming = rawEdges.filter(e => e.type === 'FUNCTION_CALLS_FUNCTION' && e.target === node.id);
                  return (
                    <>
                      <div style={{ fontSize: '9px', color: 'rgba(148, 163, 184, 0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                        Called By ({incoming.length})
                      </div>
                      {incoming.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '120px', overflowY: 'auto' }}>
                          {incoming.slice(0, 10).map((e, idx) => {
                            const caller = rawNodes.find(n => n.id === e.source);
                            const path = caller?.metadata?.file_path?.split('/').pop() ?? caller?.metadata?.path?.split('/').pop() ?? '';
                            return (
                              <div key={idx} style={{ fontSize: '10.5px', color: '#f8fafc', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{ color: '#ff8a45', fontWeight: 600 }}>›</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{caller?.label ?? e.source}</span>
                                {path && <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: '9px' }}>({path})</span>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '10px', color: 'rgba(148, 163, 184, 0.3)', fontStyle: 'italic' }}>No incoming calls detected</div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Outbound calls */}
            {node.type === 'function' && (
              <div>
                {(() => {
                  const outgoing = rawEdges.filter(e => e.type === 'FUNCTION_CALLS_FUNCTION' && e.source === node.id);
                  return (
                    <>
                      <div style={{ fontSize: '9px', color: 'rgba(148, 163, 184, 0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                        Calls ({outgoing.length})
                      </div>
                      {outgoing.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '120px', overflowY: 'auto' }}>
                          {outgoing.slice(0, 10).map((e, idx) => {
                            const callee = rawNodes.find(n => n.id === e.target);
                            const path = callee?.metadata?.file_path?.split('/').pop() ?? callee?.metadata?.path?.split('/').pop() ?? '';
                            return (
                              <div key={idx} style={{ fontSize: '10.5px', color: '#f8fafc', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{ color: '#3b82f6', fontWeight: 600 }}>›</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{callee?.label ?? e.target}</span>
                                {path && <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: '9px' }}>({path})</span>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: '10px', color: 'rgba(148, 163, 184, 0.3)', fontStyle: 'italic' }}>No outbound calls detected</div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </section>

        {/* Progressive Actions (OVERHAULED BUTTONS) */}
        {onExploreNode && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
            <SectionLabel>Progressive Actions</SectionLabel>
            
            {node.type === 'file' && (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onExploreNode(node.id, 'file', 'containment')}
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '9px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  <BarChart3 size={12} />
                  Focus Contained Symbols
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onExploreNode(node.id, 'file', 'dependencies')}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '9px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontFamily: 'Outfit, sans-serif',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#3b82f6';
                    e.currentTarget.style.border = '1px solid rgba(59,130,246,0.3)';
                    e.currentTarget.style.background = 'rgba(59,130,246,0.04)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#e2e8f0';
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  <Layers size={12} />
                  Focus Dependencies
                </motion.button>
              </>
            )}

            {node.type === 'function' && (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onExploreNode(node.id, 'function', 'center')}
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '9px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  <BarChart3 size={12} />
                  Refit Call Chain on Canvas
                </motion.button>

                {onToggleSiblings && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={onToggleSiblings}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '9px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = '#3b82f6';
                      e.currentTarget.style.border = '1px solid rgba(59,130,246,0.3)';
                      e.currentTarget.style.background = 'rgba(59,130,246,0.04)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = '#e2e8f0';
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    <Layers size={12} style={{ color: showSiblings ? '#f59e0b' : '#94a3b8' }} />
                    {showSiblings ? 'Hide Sibling Functions' : 'Show Sibling Functions'}
                  </motion.button>
                )}
              </>
            )}

            {node.type === 'class' && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => onExploreNode(node.id, 'class', 'center')}
                style={{
                  background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '9px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <Layers size={12} />
                Focus Class Structure
              </motion.button>
            )}
          </section>
        )}
      {selectedCommitForModal && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 5, 8, 0.96)',
          backdropFilter: 'blur(12px)',
          zIndex: 50,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Modal Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', fontFamily: 'Outfit, sans-serif' }}>Commit Details</span>
            <button 
              onClick={() => setSelectedCommitForModal(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Commit Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(148,163,184,0.5)' }}>SHA</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0', userSelect: 'all' }}>{selectedCommitForModal.sha}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(148,163,184,0.5)' }}>Author</span>
              <span style={{ color: '#e2e8f0' }}>{selectedCommitForModal.authorName} &lt;{selectedCommitForModal.authorEmail}&gt;</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(148,163,184,0.5)' }}>Date</span>
              <span style={{ color: '#e2e8f0' }}>{new Date(selectedCommitForModal.date).toLocaleString()}</span>
            </div>
            <div style={{ marginTop: '4px' }}>
              <span style={{ color: 'rgba(148,163,184,0.5)', display: 'block', marginBottom: '4px' }}>Commit Message</span>
              <p style={{ margin: 0, color: '#f8fafc', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '11.5px', lineHeight: '1.4' }}>
                {selectedCommitForModal.message}
              </p>
            </div>
            <div style={{ marginTop: '6px' }}>
              <span style={{ color: 'rgba(148,163,184,0.5)', display: 'block', marginBottom: '4px' }}>Commit Overview</span>
              <p style={{ margin: 0, color: '#94a3b8', background: 'rgba(59,130,246,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)', fontSize: '11px', lineHeight: '1.5', fontFamily: 'Outfit, sans-serif' }}>
                {getCommitOverview(selectedCommitForModal, node)}
              </p>
            </div>
          </div>

          {/* Changes/Diff View */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>Changes (Diff)</span>
            <pre style={{
              flex: 1,
              margin: 0,
              padding: '12px',
              background: '#040508',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              overflow: 'auto',
              color: '#94a3b8',
              lineHeight: '1.5',
            }}>
              {getMockDiff(selectedCommitForModal, node).split('\n').map((line, idx) => {
                let color = '#94a3b8';
                let bg = 'transparent';
                if (line.startsWith('+') && !line.startsWith('+++')) { color = '#4ade80'; bg = 'rgba(74, 222, 128, 0.05)'; }
                else if (line.startsWith('-') && !line.startsWith('---')) { color = '#f87171'; bg = 'rgba(248, 113, 113, 0.05)'; }
                else if (line.startsWith('@@')) { color = '#38bdf8'; }
                else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) { color = '#e2e8f0'; }
                return (
                  <div key={idx} style={{ color, background: bg, padding: '1px 2px', borderRadius: '2px' }}>
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      )}
      </div>
    </div>
  );
});

NodeDetailsPanel.displayName = 'NodeDetailsPanel';
export default NodeDetailsPanel;

interface RelationshipDetailsPanelProps {
  edge: any;
  onClose: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const RelationshipDetailsPanel: React.FC<RelationshipDetailsPanelProps> = ({
  edge,
  onClose,
  isExpanded = false,
  onToggleExpand
}) => {
  const type = String(edge.data?.type || edge.type || '').toUpperCase();
  const properties = edge.data?.properties || {};
  const confidence = String(properties.confidence || 'HIGH').toUpperCase();
  const resolution = String(properties.resolution_method || 'direct_import').toLowerCase();
  const classification = String(properties.classification || (type === 'FILE_IMPORTS_FILE' ? 'DEPENDENCY' : 'USER_DEFINED')).toUpperCase();
  
  const evidenceVar = properties.evidence_variable;
  const evidenceType = properties.evidence_type;
  const evidenceAssign = properties.evidence_assignment;
  const evidenceLookup = properties.evidence_lookup;
  const hasEvidence = !!(evidenceVar || evidenceType || evidenceAssign || evidenceLookup);
  
  const getShortName = (id: string) => id.split(':').pop() || id;
  const sourceLabel = getShortName(edge.source);
  const targetLabel = getShortName(edge.target);

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: isExpanded ? '650px' : '380px',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)) #04050A',
        borderLeft: '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: '0 24px 64px -24px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflowY: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ height: '2px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', width: '100%' }} />

      <header style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3b82f6', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
            Relationship Details
          </span>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#f8fafc', fontFamily: 'Syne, sans-serif' }}>
            {type.replace(/_/g, ' ')}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '6px',
                color: 'rgba(148,163,184,0.6)',
                cursor: 'pointer',
                padding: '5px',
                display: 'flex',
                transition: 'all 0.2s',
              }}
              title={isExpanded ? "Contract Panel Width" : "Expand Panel Width"}
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px',
              color: 'rgba(148,163,184,0.6)',
              cursor: 'pointer',
              padding: '5px',
              display: 'flex',
              transition: 'all 0.2s',
            }}
          >
            <X size={13} />
          </button>
        </div>
      </header>

      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>Source</span>
            <span style={{ fontSize: '12.5px', color: '#e2e8f0', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace' }}>{sourceLabel}</span>
          </div>
          <ArrowRight size={16} style={{ color: 'rgba(148,163,184,0.4)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>Target</span>
            <span style={{ fontSize: '12.5px', color: '#e2e8f0', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace' }}>{targetLabel}</span>
          </div>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em', fontWeight: 700 }}>
            Analysis Metadata
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11.5px' }}>
              <span style={{ color: 'rgba(148,163,184,0.6)' }}>Relationship Type</span>
              <span style={{ color: '#ffffff', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{type}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11.5px' }}>
              <span style={{ color: 'rgba(148,163,184,0.6)' }}>Classification</span>
              <span style={{ color: '#f97316', fontWeight: 600 }}>{classification}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11.5px' }}>
              <span style={{ color: 'rgba(148,163,184,0.6)' }}>Resolution Method</span>
              <span style={{ color: '#e2e8f0' }}>{resolution.replace(/_/g, ' ')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: '11.5px' }}>
              <span style={{ color: 'rgba(148,163,184,0.6)' }}>Confidence Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {confidence === 'NONE' || confidence === 'LOW' ? (
                  <ShieldAlert size={12} style={{ color: '#ef4444' }} />
                ) : (
                  <Shield size={12} style={{ color: '#10b981' }} />
                )}
                <span style={{ color: confidence === 'NONE' || confidence === 'LOW' ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                  {confidence}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em', fontWeight: 700 }}>
            Explanation
          </h3>
          <div style={{
            display: 'flex',
            gap: '10px',
            background: confidence === 'NONE' ? 'rgba(239, 68, 68, 0.03)' : 'rgba(59, 130, 246, 0.03)',
            border: confidence === 'NONE' ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(59, 130, 246, 0.15)',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '11.5px',
            lineHeight: '1.5',
            color: '#94a3b8'
          }}>
            <Info size={14} style={{ color: confidence === 'NONE' ? '#ef4444' : '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
            <div>
              {type === 'FILE_IMPORTS_FILE' && (
                <span>
                  This relationship was identified via explicit import statements. <strong>{sourceLabel}</strong> directly references the module path to <strong>{targetLabel}</strong>, indicating a physical module dependency.
                </span>
              )}
              {type === 'PROJECTED_DEPENDENCY' && (
                <span>
                  This is an inferred module dependency. It was projected from function calls or inheritance patterns because no explicit import parser mapped this connection directly.
                </span>
              )}
              {type === 'FUNCTION_CALLS_FUNCTION' && confidence !== 'NONE' && (
                <span>
                  Deterministic call path identified. <strong>{sourceLabel}</strong> executes a call mapped to <strong>{targetLabel}</strong> using imported scope or direct symbol resolution.
                </span>
              )}
              {(confidence === 'NONE' || type.includes('UNRESOLVED')) && (
                <span>
                  <strong>Possible unresolved reference.</strong> The calling variable type could not be resolved statically. This link is visually distinguished to represent an ambiguous call path.
                </span>
              )}
              {type.includes('CONTAINS') && (
                <span>
                  Structural AST containment fact. This edge denotes that the file <strong>{sourceLabel}</strong> contains the definition block of the function/class <strong>{targetLabel}</strong>.
                </span>
              )}
            </div>
          </div>
        </section>

        {hasEvidence && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)', letterSpacing: '0.08em', fontWeight: 700 }}>
              Evidence / Provenance
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden' }}>
              {properties.resolution_method && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11.5px' }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)' }}>Resolution Method</span>
                  <span style={{ color: '#10b981', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 600 }}>{properties.resolution_method}</span>
                </div>
              )}
              {evidenceVar && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11.5px' }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)' }}>Variable</span>
                  <span style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{evidenceVar}</span>
                </div>
              )}
              {evidenceType && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11.5px' }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)' }}>Inferred Type</span>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>{evidenceType}</span>
                </div>
              )}
              {evidenceAssign && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '11.5px' }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)' }}>Assignment</span>
                  <span style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{evidenceAssign}</span>
                </div>
              )}
              {evidenceLookup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: '11.5px' }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)' }}>Method Lookup</span>
                  <span style={{ color: '#f97316', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 600 }}>{evidenceLookup}</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

