import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Database, FileCode, Zap, Box, PackageOpen,
  Layout, GitBranch, Globe, Type, Layers, Settings,
} from 'lucide-react';
import type { RealNodeType } from '../services/repoApi';

// ── Node type visual config ──────────────────────────────────────────────────

interface TypeConfig {
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
  border: string;
  label: string;
  glow: string;
}

const typeConfig: Record<string, TypeConfig> = {
  // ── Python / Neo4j node types ──
  repository: {
    icon: Database,
    color: '#DAA520',
    bg: 'rgba(218,165,32,0.10)',
    border: 'rgba(218,165,32,0.45)',
    label: 'Repository',
    glow: 'rgba(218,165,32,0.30)',
  },
  file: {
    icon: FileCode,
    color: '#FF6F61',
    bg: 'rgba(255,111,97,0.10)',
    border: 'rgba(255,111,97,0.45)',
    label: 'File',
    glow: 'rgba(255,111,97,0.30)',
  },
  function: {
    icon: Zap,
    color: '#FF4500',
    bg: 'rgba(255,69,0,0.10)',
    border: 'rgba(255,69,0,0.45)',
    label: 'Function',
    glow: 'rgba(255,69,0,0.30)',
  },
  class: {
    icon: Box,
    color: '#FFA500',
    bg: 'rgba(255,165,0,0.10)',
    border: 'rgba(255,165,0,0.45)',
    label: 'Class',
    glow: 'rgba(255,165,0,0.30)',
  },
  import: {
    icon: PackageOpen,
    color: '#F5E8D8',
    bg: 'rgba(245,232,216,0.10)',
    border: 'rgba(245,232,216,0.45)',
    label: 'Import',
    glow: 'rgba(245,232,216,0.30)',
  },
  // ── Legacy / mock node types ──
  component: {
    icon: Layout,
    color: '#FF4500',
    bg: 'rgba(255,69,0,0.10)',
    border: 'rgba(255,69,0,0.45)',
    label: 'Component',
    glow: 'rgba(255,69,0,0.30)',
  },
  hook: {
    icon: GitBranch,
    color: '#DAA520',
    bg: 'rgba(218,165,32,0.10)',
    border: 'rgba(218,165,32,0.45)',
    label: 'Hook',
    glow: 'rgba(218,165,32,0.30)',
  },
  api: {
    icon: Globe,
    color: '#FFA500',
    bg: 'rgba(255,165,0,0.10)',
    border: 'rgba(255,165,0,0.45)',
    label: 'API',
    glow: 'rgba(255,165,0,0.30)',
  },
  util: {
    icon: Zap,
    color: '#FF6F61',
    bg: 'rgba(255,111,97,0.10)',
    border: 'rgba(255,111,97,0.45)',
    label: 'Utility',
    glow: 'rgba(255,111,97,0.30)',
  },
  type: {
    icon: Type,
    color: '#F5E8D8',
    bg: 'rgba(245,232,216,0.10)',
    border: 'rgba(245,232,216,0.45)',
    label: 'Type',
    glow: 'rgba(245,232,216,0.30)',
  },
  context: {
    icon: Layers,
    color: '#FF8C00',
    bg: 'rgba(255,140,0,0.10)',
    border: 'rgba(255,140,0,0.45)',
    label: 'Context',
    glow: 'rgba(255,140,0,0.30)',
  },
  page: {
    icon: FileCode,
    color: '#E64A19',
    bg: 'rgba(230,74,25,0.10)',
    border: 'rgba(230,74,25,0.45)',
    label: 'Page',
    glow: 'rgba(230,74,25,0.30)',
  },
  config: {
    icon: Settings,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.10)',
    border: 'rgba(148,163,184,0.45)',
    label: 'Config',
    glow: 'rgba(148,163,184,0.30)',
  },
};

const fallbackConfig: TypeConfig = typeConfig.file;

// ── Sub-label chips ───────────────────────────────────────────────────────────

const Chip: React.FC<{ value: string | number; color?: string }> = ({ value, color = 'rgba(148,163,184,0.7)' }) => (
  <div
    style={{
      fontSize: '9px',
      color,
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '4px',
      padding: '2px 5px',
      fontFamily: 'JetBrains Mono, monospace',
      whiteSpace: 'nowrap',
    }}
  >
    {value}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export interface RealGraphNodeData {
  label: string;
  type: RealNodeType;
  metadata?: Record<string, unknown>;
  highlighted?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  [key: string]: unknown;
}

const RealGraphNodeComponent: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as RealGraphNodeData;
  const cfg = typeConfig[nodeData.type as string] ?? fallbackConfig;
  const Icon = cfg.icon;

  const isHighlighted = !!nodeData.highlighted;
  const isDimmed = !!nodeData.dimmed;
  const meta = nodeData.metadata ?? {};

  const lineNumber = meta.line_number as number | undefined;
  const params = meta.params as string[] | undefined;
  const decorators = meta.decorators as string[] | undefined;
  const funcCount = meta.functions_count as number | undefined;
  const classCount = meta.classes_count as number | undefined;
  const impCount = meta.imports_count as number | undefined;

  // Determine small-badge content per node type
  const chips: Array<{ val: string | number; color?: string }> = [];
  if (lineNumber) chips.push({ val: `L${lineNumber}` });
  if (funcCount != null && funcCount > 0) chips.push({ val: `${funcCount} fn` });
  if (classCount != null && classCount > 0) chips.push({ val: `${classCount} cls` });
  if (impCount != null && impCount > 0) chips.push({ val: `${impCount} imp` });
  if (params && params.length > 0) chips.push({ val: `${params.length} param${params.length !== 1 ? 's' : ''}`, color: '#34d399' });
  if (decorators && decorators.length > 0) chips.push({ val: `@${decorators[0].replace('@', '').split('(')[0]}`, color: '#fbbf24' });

  // Compute border/glow based on state
  const borderColor = isHighlighted
    ? cfg.color
    : selected
      ? cfg.color
      : cfg.border;

  const borderWidth = isHighlighted || selected ? 1.5 : 1;

  const boxShadow = isHighlighted
    ? `0 0 20px ${cfg.glow}, 0 0 40px ${cfg.glow}, 0 4px 16px rgba(0,0,0,0.4)`
    : selected
      ? `0 0 16px ${cfg.glow}, 0 4px 16px rgba(0,0,0,0.4)`
      : `0 4px 16px rgba(0,0,0,0.3)`;

  return (
    <div
      style={{
        position: 'relative',
        background: cfg.bg,
        border: `${borderWidth}px solid ${borderColor}`,
        boxShadow,
        borderRadius: '12px',
        padding: '9px 13px',
        minWidth: '155px',
        maxWidth: '220px',
        backdropFilter: 'blur(14px)',
        transition: 'box-shadow 0.25s ease, border-color 0.25s ease, opacity 0.25s ease',
        cursor: 'pointer',
        opacity: isDimmed ? 0.25 : 1,
        filter: isDimmed ? 'grayscale(0.5)' : 'none',
        transform: isHighlighted ? 'scale(1.04)' : 'none',
      }}
    >
      {/* Animated top glow strip on highlight */}
      {(isHighlighted || selected) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '15%',
            right: '15%',
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
            borderRadius: '0 0 4px 4px',
          }}
        />
      )}

      <Handle
        type="target"
        position={Position.Left}
        style={{ background: cfg.color, border: 'none', width: 7, height: 7, boxShadow: `0 0 6px ${cfg.color}` }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: chips.length > 0 ? '7px' : '0' }}>
        <div
          style={{
            width: 26, height: 26,
            borderRadius: 8,
            background: `${cfg.color}1a`,
            border: `1px solid ${cfg.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: selected || isHighlighted ? `0 0 10px ${cfg.glow}` : 'none',
          }}
        >
          <Icon size={13} style={{ color: cfg.color }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#e2e8f0',
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '130px',
            }}
            title={nodeData.label}
          >
            {nodeData.label}
          </div>
          <div style={{
            fontSize: '9px',
            color: cfg.color,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            opacity: 0.9,
          }}>
            {cfg.label}
          </div>
        </div>
      </div>

      {/* Chips row */}
      {chips.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {chips.map((c, i) => (
            <Chip key={i} value={c.val} color={c.color} />
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: cfg.color, border: 'none', width: 7, height: 7, boxShadow: `0 0 6px ${cfg.color}` }}
      />
    </div>
  );
});

RealGraphNodeComponent.displayName = 'RealGraphNode';

export default RealGraphNodeComponent;

// Exported type config so other components can reuse colours
export { typeConfig as realNodeTypeConfig };
