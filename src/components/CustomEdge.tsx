import React, { memo } from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

const CustomEdge: React.FC<EdgeProps> = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isHighlighted = selected || !!data?.highlighted;
  const isDimmed = !isHighlighted && !!data?.dimmed;

  const strokeColor = isHighlighted ? '#f43f5e' : isDimmed ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.4)';
  const strokeWidth = isHighlighted ? 2.5 : 1;

  return (
    <>
      {/* Glow layer */}
      {isHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke="rgba(244,63,94,0.25)"
          strokeWidth={8}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isHighlighted ? '4 4' : 'none',
          opacity: isDimmed ? 0.15 : 1,
          transition: 'all 0.2s ease',
        }}
        markerEnd={`url(#arrow-${isHighlighted ? 'selected' : 'default'})`}
      />

      {/* Animated particle on highlighted edge */}
      {isHighlighted && (
        <circle r="3" fill="#f43f5e" style={{ filter: 'drop-shadow(0 0 4px #f43f5e)' }}>
          <animateMotion dur="1.2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* SVG Arrow Defs */}
      <defs>
        <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(99,102,241,0.5)" />
        </marker>
        <marker id="arrow-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#a78bfa" />
        </marker>
      </defs>

      {/* Edge label on hover */}
      {selected && data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="glass px-2 py-0.5 rounded-full text-[10px] font-mono text-indigo-300 border border-indigo-500/30">
              {String(data.label)}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
export default CustomEdge;
