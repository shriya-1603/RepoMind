import React, { memo } from 'react';
import { BaseEdge } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

const CustomEdge: React.FC<EdgeProps> = memo(({
  id, sourceX, sourceY, targetX, targetY,
  data, selected,
}) => {
  const isHighlighted = selected || !!data?.isHighlighted;
  const opacity: number = typeof data?.opacity === 'number' ? data.opacity : 1;

  const depType = String(data?.type || data?.label || '').toUpperCase();
  const props = (data?.properties || {}) as any;
  const confidence = String(props.confidence || '').toUpperCase();
  const resolution = String(props.resolution_method || '').toUpperCase();

  let strokeColor = '#475569'; // default slate-600
  let strokeWidth = isHighlighted ? 2.5 : 1.25;
  let strokeDasharray = 'none';
  let isAnimated = false;

  // Visual Taxonomy Configuration
  if (depType.includes('CONTAINS')) {
    // CONTAINS: thin dashed/dotted structural edge
    strokeColor = '#475569';
    strokeDasharray = '2 2';
    strokeWidth = 1;
  } else if (depType.includes('PROJECTED_DEPENDENCY') || depType === 'PROJECTED_DEPENDENCY') {
    // PROJECTED_DEPENDENCY: dashed slate edge (Objective: never looks identical to FILE_IMPORTS_FILE)
    strokeColor = '#94a3b8';
    strokeDasharray = '4 4';
    strokeWidth = isHighlighted ? 2.5 : 1.25;
  } else if (depType.includes('IMPORT') || depType === 'DEPENDS' || depType === 'DEPENDENCY') {
    // FILE_IMPORTS_FILE: solid blue dependency edge
    strokeColor = '#3b82f6';
    strokeWidth = isHighlighted ? 2.5 : 1.25;
    strokeDasharray = 'none';
  } else if (depType.includes('CALL')) {
    const isResolved = props.resolved === true || String(props.resolved).toLowerCase() === 'true';
    if (!isResolved || confidence === 'NONE' || resolution === 'UNRESOLVED' || depType.includes('UNRESOLVED')) {
      // UNRESOLVED_MEMBER_CALL: dotted visually muted unresolved edge
      strokeColor = '#64748b';
      strokeDasharray = '2 4';
      strokeWidth = 1.25;
      isAnimated = false;
    } else {
      const resMethod = String(props.resolution_method || '').toLowerCase();
      const isInferred = resMethod.includes('inference') || 
                         resMethod.includes('narrowing') || 
                         resMethod.includes('binding') || 
                         resMethod.includes('return') || 
                         resMethod.includes('iterator') || 
                         resMethod.includes('collection') ||
                         resMethod.includes('attribute');
      
      if (isInferred) {
        // Inferred relationship: dashed amber call edge
        strokeColor = '#f59e0b';
        strokeWidth = isHighlighted ? 2.5 : 1.25;
        strokeDasharray = '4 3';
        isAnimated = true;
      } else {
        // Deterministic proven relationship: solid orange call edge
        strokeColor = '#ef4444';
        strokeWidth = isHighlighted ? 2.5 : 1.25;
        strokeDasharray = 'none';
        isAnimated = true;
      }
    }
  } else if (depType.includes('INHERIT') || depType.includes('EXTEND')) {
    strokeColor = '#a855f7'; // purple inheritance path
    strokeWidth = isHighlighted ? 4 : 2.5;
  } else if (depType.includes('DYNAMIC') || depType.includes('ASYNC')) {
    strokeColor = '#10b981'; // green dashed dynamic path
    strokeDasharray = '5 5';
    isAnimated = true;
  }

  // Calculate direct organic bow curve (Direct line with gentle middle quadratic arc)
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;

  // Gentle bend offset: perpendicular vector scaled by 6% of length
  const ox = -dy * 0.06;
  const oy = dx * 0.06;

  const cx = mx + ox;
  const cy = my + oy;

  const edgePath = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;

  return (
    <>
      {/* Glow layer */}
      {isHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 6}
          style={{ filter: 'blur(4px)', opacity: opacity * 0.3 }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          opacity,
          transition: 'opacity 0.25s ease, stroke-width 0.25s ease',
        }}
        markerEnd={`url(#arrow-${isHighlighted ? 'selected' : 'default'})`}
      />

      {/* Animated particle flow */}
      {isAnimated && opacity > 0.2 && (
        <circle r="3" fill={strokeColor} style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}>
          <animateMotion dur="1.8s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* SVG Arrow Defs */}
      <defs>
        <marker id="arrow-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 L1.5,3 z" fill="#475569" />
        </marker>
        <marker id="arrow-selected" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 L1.5,3 z" fill="#3b82f6" />
        </marker>
      </defs>
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
export default CustomEdge;
