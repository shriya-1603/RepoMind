import React, { memo } from 'react';
import { getBezierPath, BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

const CustomEdge: React.FC<EdgeProps> = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}) => {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isHighlighted = selected || !!data?.isHighlighted;
  const opacity = data?.opacity !== undefined ? data.opacity : 1;
  const isExecutionFlow = String(data?.label).toLowerCase().includes('call') || String(data?.label).toLowerCase().includes('flow');

  // Constrain visual taxonomy: gray for static imports, orange for dynamic call flows
  const strokeColor = isExecutionFlow ? '#f97316' : '#475569';
  const strokeWidth = isHighlighted ? 2.5 : 1;

  return (
    <>
      {/* Glow layer */}
      {isHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke={isExecutionFlow ? 'rgba(249,115,22,0.25)' : 'rgba(71,85,105,0.25)'}
          strokeWidth={8}
          style={{ filter: 'blur(4px)', opacity }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isExecutionFlow ? '4 4' : 'none',
          opacity,
          transition: 'opacity 0.25s ease, stroke-width 0.25s ease',
        }}
        markerEnd={`url(#arrow-${isHighlighted ? 'selected' : 'default'})`}
      />

      {/* Animated particle on execution flows */}
      {isExecutionFlow && opacity > 0.1 && (
        <circle r="3" fill="#f97316" style={{ filter: 'drop-shadow(0 0 4px #f97316)' }}>
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* SVG Arrow Defs */}
      <defs>
        <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
        </marker>
        <marker id="arrow-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
        </marker>
      </defs>
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
export default CustomEdge;
