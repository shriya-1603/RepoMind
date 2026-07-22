import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';

export const useSpotlightMode = (
  flowNodes: Node[],
  flowEdges: Edge[],
  selectedFileId: string | null,
  expandedSubsystemId: string | null
) => {
  const spotlightSet = useMemo(() => {
    const neighbors = new Set<string>();
    if (!selectedFileId) return { neighbors };

    neighbors.add(selectedFileId);

    // One-hop neighbor scan
    flowEdges.forEach(e => {
      if (e.source === selectedFileId) {
        neighbors.add(e.target);
      }
      if (e.target === selectedFileId) {
        neighbors.add(e.source);
      }
    });

    return { neighbors };
  }, [selectedFileId, flowEdges]);

  // Map spotlight styling properties onto React Flow nodes
  const spotlightNodes = useMemo(() => {
    if (!selectedFileId) {
      return flowNodes.map(n => {
        const isSubsystemNode = n.id.startsWith('subsystem:');
        const activeSubsystem = expandedSubsystemId ? `subsystem:${expandedSubsystemId}` : null;
        let opacity = 1;

        if (activeSubsystem) {
          if (isSubsystemNode && n.id !== activeSubsystem) {
            opacity = 0.25;
          }
        }
        return {
          ...n,
          style: {
            ...n.style,
            transition: 'opacity 0.3s ease',
            opacity,
          },
          data: {
            ...n.data,
            opacity,
            isFocused: false,
            highlightStyle: 'none'
          },
        };
      });
    }

    return flowNodes.map(n => {
      const isSubsystem = n.id.startsWith('subsystem:');
      let opacity = 0.15;
      let scale = 1;
      let isFocused = false;
      let highlightStyle: 'selected' | 'neighbor' | 'none' = 'none';

      if (n.id === selectedFileId) {
        opacity = 1.0;
        scale = 1.06;
        isFocused = true;
        highlightStyle = 'selected';
      } else if (spotlightSet.neighbors.has(n.id) && !isSubsystem) {
        opacity = 0.95;
        highlightStyle = 'neighbor';
      }

      return {
        ...n,
        style: {
          ...n.style,
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity,
          transform: `scale(${scale})`,
          zIndex: isFocused ? 1000 : spotlightSet.neighbors.has(n.id) ? 500 : 1,
        },
        data: {
          ...n.data,
          opacity,
          isFocused,
          highlightStyle
        },
      };
    });
  }, [flowNodes, selectedFileId, expandedSubsystemId, spotlightSet]);

  // Map spotlight styling properties onto React Flow edges
  const spotlightEdges = useMemo(() => {
    if (!selectedFileId) {
      return flowEdges.map(e => ({
        ...e,
        style: { ...e.style, opacity: 1 },
      }));
    }

    return flowEdges.map(e => {
      let opacity = 0.15;
      let isHighlighted = false;

      const isSrcSelected = e.source === selectedFileId;
      const isTgtSelected = e.target === selectedFileId;

      if (isSrcSelected || isTgtSelected) {
        opacity = 1.0;
        isHighlighted = true;
      }

      return {
        ...e,
        style: {
          ...e.style,
          strokeWidth: isHighlighted ? 2.5 : 1,
          opacity,
        },
        data: {
          ...e.data,
          isHighlighted,
          opacity,
        },
      };
    });
  }, [flowEdges, selectedFileId, spotlightSet]);

  return {
    spotlightNodes,
    spotlightEdges,
  };
};
