import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { FileCode, Layers, GitBranch, Type, Zap, Globe, Settings, Layout } from 'lucide-react';
import type { NodeType } from '../data/mockRepositoryData';

interface CustomNodeData {
  label: string;
  type: NodeType;
  linesOfCode: number;
  importCount: number;
  exportCount: number;
  complexity: number;
  selected?: boolean;
  [key: string]: unknown;
}
const typeConfig: Record<NodeType, { icon: React.ComponentType<any>; color: string; bg: string; border: string; label: string }> = {
  component: { icon: Layout,    color: '#FF4500', bg: 'rgba(255, 69, 0, 0.1)',  border: 'rgba(255, 69, 0, 0.5)', label: 'Component' },
  hook:      { icon: GitBranch, color: '#DAA520', bg: 'rgba(218, 165, 32, 0.1)',   border: 'rgba(218, 165, 32, 0.5)',  label: 'Hook' },
  util:      { icon: Zap,       color: '#FF6F61', bg: 'rgba(255, 111, 97, 0.1)',  border: 'rgba(255, 111, 97, 0.5)', label: 'Utility' },
  type:      { icon: Type,      color: '#F5E8D8', bg: 'rgba(245, 232, 216, 0.1)',  border: 'rgba(245, 232, 216, 0.5)', label: 'Type' },
  context:   { icon: Layers,    color: '#FF8C00', bg: 'rgba(255, 140, 0, 0.1)',   border: 'rgba(255, 140, 0, 0.5)',  label: 'Context' },
  api:       { icon: Globe,     color: '#FFA500', bg: 'rgba(255, 165, 0, 0.1)',  border: 'rgba(255, 165, 0, 0.5)', label: 'API' },
  config:    { icon: Settings,  color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.5)', label: 'Config' },
  page:      { icon: FileCode,  color: '#E64A19', bg: 'rgba(230, 74, 25, 0.1)',  border: 'rgba(230, 74, 25, 0.5)', label: 'Page' },
};

const complexityColor = (c: number): string => {
  if (c >= 15) return '#fb7185';
  if (c >= 8)  return '#fbbf24';
  return '#34d399';
};

const CustomNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as CustomNodeData;
  const config = typeConfig[nodeData.type] || typeConfig.util;
  const Icon = config.icon;

  const isBroken = !!nodeData.isBroken;
  const isHighlighted = !!nodeData.highlighted;
  const isDimmed = !!nodeData.dimmed;

  return (
    <div
      style={{
        position: 'relative',
        background: isBroken ? 'rgba(244,63,94,0.15)' : config.bg,
        border: isBroken
          ? '1px solid #f43f5e'
          : isHighlighted
            ? `2px solid ${config.color}`
            : `1px solid ${selected ? config.color : config.border}`,
        boxShadow: isBroken
          ? '0 0 20px rgba(244,63,94,0.5), 0 0 40px rgba(244,63,94,0.2)'
          : isHighlighted
            ? `0 0 24px ${config.color}, 0 0 12px rgba(255,255,255,0.2)`
            : selected
              ? `0 0 20px ${config.color}40, 0 0 40px ${config.color}20`
              : `0 4px 16px rgba(0,0,0,0.3)`,
        borderRadius: '12px',
        padding: '10px 14px',
        minWidth: '160px',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.25s ease',
        cursor: 'pointer',
        opacity: isDimmed ? 0.3 : 1,
        filter: isDimmed ? 'grayscale(0.6)' : 'none',
        transform: isHighlighted ? 'scale(1.05)' : 'none',
      }}
    >
      {isBroken && (
        <>
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 border border-white/20 flex items-center justify-center text-[8px] text-white font-bold animate-ping" />
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 border border-white/20 flex items-center justify-center text-[8px] text-white font-bold z-10">
            !
          </div>
        </>
      )}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: config.color, border: 'none', width: 8, height: 8 }}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div
          style={{
            width: 26, height: 26,
            borderRadius: 8,
            background: `${config.color}20`,
            border: `1px solid ${config.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={13} style={{ color: config.color }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, color: '#e2e8f0',
            fontFamily: 'JetBrains Mono, monospace',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: '110px',
          }}>
            {nodeData.label}
          </div>
          <div style={{ fontSize: '9px', color: config.color, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {config.label}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '9px', color: 'rgba(148,163,184,0.8)', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 5px' }}>
          {nodeData.linesOfCode} loc
        </div>
        <div style={{ fontSize: '9px', color: 'rgba(148,163,184,0.8)', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 5px' }}>
          ↓{nodeData.importCount} ↑{nodeData.exportCount}
        </div>
        <div style={{
          fontSize: '9px',
          color: complexityColor(nodeData.complexity),
          background: `${complexityColor(nodeData.complexity)}15`,
          borderRadius: '4px', padding: '2px 5px',
        }}>
          cx {nodeData.complexity}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: config.color, border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;
