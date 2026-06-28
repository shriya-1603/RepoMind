import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  X, FileCode, Zap, Box, PackageOpen, Database,
  Hash, Code2, Tag, Layers, ChevronRight, GitMerge,
} from 'lucide-react';
import type { RealGraphNode } from '../services/repoApi';
import { realNodeTypeConfig } from './RealGraphNode';

interface NodeDetailsPanelProps {
  node: RealGraphNode;
  onClose: () => void;
}

// ── Section helpers ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'rgba(148,163,184,0.6)',
    fontWeight: 700,
    marginBottom: '5px',
  }}>
    {children}
  </div>
);

const MetaRow: React.FC<{ label: string; value: React.ReactNode; color?: string }> = ({
  label, value, color = '#94a3b8',
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', fontSize: '11px' }}>
    <span style={{ color: 'rgba(148,163,184,0.55)', flexShrink: 0 }}>{label}</span>
    <span style={{ color, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', wordBreak: 'break-all' }}>
      {value}
    </span>
  </div>
);

const TagPill: React.FC<{ value: string; color: string }> = ({ value, color }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 7px',
    borderRadius: '999px',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono, monospace',
    color,
    background: `${color}18`,
    border: `1px solid ${color}30`,
    whiteSpace: 'nowrap',
  }}>
    {value}
  </div>
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

// ── Main Panel ─────────────────────────────────────────────────────────────────

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = memo(({ node, onClose }) => {
  const cfg = realNodeTypeConfig[node.type as string] ?? realNodeTypeConfig.file;
  const Icon = typeIcons[node.type as string] ?? FileCode;
  const meta = node.metadata;

  const filePath = meta.file_path ?? meta.rel_path ?? meta.path ?? '';
  const lineNumber = meta.line_number;
  const params = meta.params ?? [];
  const decorators = meta.decorators ?? [];
  const bases = meta.bases ?? [];
  const methods = meta.methods ?? [];
  const module = meta.module;
  const importType = meta.import_type;
  const names = meta.names ?? [];
  const funcCount = meta.functions_count;
  const classCount = meta.classes_count;
  const impCount = meta.imports_count;
  const repoName = meta.repo_name;
  const complexity = meta.complexity;
  const description = meta.description;

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: '300px',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(10, 14, 28, 0.82)',
        backdropFilter: 'blur(22px) saturate(130%)',
        borderLeft: `1px solid ${cfg.color}22`,
        overflowY: 'auto',
      }}
    >
      {/* Glowing top accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 10,
          background: `${cfg.color}1a`,
          border: `1px solid ${cfg.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 12px ${cfg.glow}`,
        }}>
          <Icon size={15} style={{ color: cfg.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#e2e8f0',
            fontFamily: 'JetBrains Mono, monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
            title={node.label}
          >
            {node.label}
          </div>
          <div style={{
            fontSize: '9px',
            color: cfg.color,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
            marginTop: '2px',
          }}>
            {cfg.label}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            color: 'rgba(148,163,184,0.6)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.6)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Core identity */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SectionLabel>Identity</SectionLabel>
          <div style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}>
            {repoName && <MetaRow label="Repo" value={repoName} color="#e2e8f0" />}
            {filePath && <MetaRow label="Path" value={filePath} color="#60a5fa" />}
            {lineNumber != null && <MetaRow label="Line" value={`#${lineNumber}`} color={cfg.color} />}
            {module && <MetaRow label="Module" value={module} color="#fbbf24" />}
            {importType && <MetaRow label="Import" value={importType} color="#94a3b8" />}
          </div>
        </section>

        {/* Repository stats */}
        {(funcCount != null || classCount != null || impCount != null) && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Repository Stats</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[
                { label: 'Functions', value: funcCount, color: '#FF4500' },
                { label: 'Classes', value: classCount, color: '#FFA500' },
                { label: 'Imports', value: impCount, color: '#DAA520' },
              ].filter(s => s.value != null).map(stat => (
                <div key={stat.label} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: stat.color, fontFamily: 'JetBrains Mono, monospace' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '8px', color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        {description && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Description</SectionLabel>
            <p style={{ fontSize: '11px', color: 'rgba(148,163,184,0.75)', lineHeight: 1.6, margin: 0 }}>
              {String(description)}
            </p>
          </section>
        )}

        {/* Complexity */}
        {complexity != null && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Complexity</SectionLabel>
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                color: Number(complexity) >= 15 ? '#fb7185' : Number(complexity) >= 8 ? '#fbbf24' : '#34d399',
              }}>
                {String(complexity)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  height: '4px',
                  background: 'rgba(255,255,255,0.07)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (Number(complexity) / 25) * 100)}%`,
                    background: Number(complexity) >= 15 ? '#fb7185' : Number(complexity) >= 8 ? '#fbbf24' : '#34d399',
                    borderRadius: '999px',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <div style={{ fontSize: '9px', color: 'rgba(148,163,184,0.4)', marginTop: '3px' }}>
                  Cyclomatic complexity
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Parameters */}
        {params.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Parameters ({params.length})</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(params as string[]).map((p, i) => (
                <TagPill key={i} value={p} color="#34d399" />
              ))}
            </div>
          </section>
        )}

        {/* Decorators */}
        {decorators.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Decorators</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(decorators as string[]).map((d, i) => (
                <div key={i} style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                  color: '#fbbf24',
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                  <span style={{ opacity: 0.5 }}>@</span>{d.replace('@', '')}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Inheritance (bases) */}
        {bases.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Inherits From</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(bases as string[]).map((b, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#FFA500',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  <ChevronRight size={10} style={{ opacity: 0.5 }} />
                  {b}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Methods */}
        {methods.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Methods ({methods.length})</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(methods as string[]).slice(0, 12).map((m, i) => (
                <TagPill key={i} value={m} color="#FF6F61" />
              ))}
              {methods.length > 12 && (
                <span style={{ fontSize: '10px', color: 'rgba(148,163,184,0.4)', padding: '2px 4px' }}>
                  +{methods.length - 12} more
                </span>
              )}
            </div>
          </section>
        )}

        {/* Imported names */}
        {names.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel>Imported Symbols</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(names as string[]).map((n, i) => (
                <TagPill key={i} value={n} color="#DAA520" />
              ))}
            </div>
          </section>
        )}

        {/* Analysis metadata footer */}
        <div style={{
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '9px', color: 'rgba(148,163,184,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>
            id: {node.id.split(':').slice(-1)[0]}
          </span>
          <div style={{
            fontSize: '9px',
            color: cfg.color,
            background: `${cfg.color}15`,
            border: `1px solid ${cfg.color}25`,
            padding: '2px 8px',
            borderRadius: '999px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {cfg.label}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

NodeDetailsPanel.displayName = 'NodeDetailsPanel';
export default NodeDetailsPanel;
