import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';

export const useSpotlightMode = (
  flowNodes: Node[],
  flowEdges: Edge[],
  selectedFileId: string | null,
  expandedSubsystemId: string | null
) => {
  // Compute one-hop and two-hop connection sets for spotlight focus mode
  const spotlightSet = useMemo(() => {
    const oneHop = new Set<string>();
    const twoHop = new Set<string>();
    if (!selectedFileId) return { oneHop, twoHop };

    oneHop.add(selectedFileId);

    // First hop scan
    flowEdges.forEach(e => {
      if (e.source === selectedFileId) {
        oneHop.add(e.target);
      }
      if (e.target === selectedFileId) {
        oneHop.add(e.source);
      }
    });

    // Second hop scan
    flowEdges.forEach(e => {
      if (oneHop.has(e.source) && !oneHop.has(e.target)) {
        twoHop.add(e.target);
      }
      if (oneHop.has(e.target) && !oneHop.has(e.source)) {
        twoHop.add(e.source);
      }
    });

    return { oneHop, twoHop };
  }, [selectedFileId, flowEdges]);

  // Map spotlight styling properties onto React Flow nodes
  const spotlightNodes = useMemo(() => {
    if (!selectedFileId) {
      // Standard subsystem visibility dimming
      return flowNodes.map(n => {
        const isSubsystemNode = n.id.startsWith('subsystem:');
        const activeSubsystem = expandedSubsystemId ? `subsystem:${expandedSubsystemId}` : null;
        let opacity = 1;

        if (activeSubsystem) {
          if (isSubsystemNode && n.id !== activeSubsystem) {
            opacity = 0.2; // Dim out unrelated subsystems
          }
        }
        return {
          ...n,
          data: {
            ...n.data,
            opacity,
            isFocused: false,
          },
        };
      });
    }

    return flowNodes.map(n => {
      const isSubsystemNode = n.id.startsWith('subsystem:');
      let opacity = 0.08; // Default dim level
      let scale = 1;
      let isFocused = false;

      if (isSubsystemNode) {
        opacity = 0.15; // Dim subsystem cards slightly less than far files
      } else if (n.id === selectedFileId) {
        opacity = 1;
        scale = 1.06;
        isFocused = true;
      } else if (spotlightSet.oneHop.has(n.id)) {
        opacity = 0.85;
      } else if (spotlightSet.twoHop.has(n.id)) {
        opacity = 0.45;
      }

      return {
        ...n,
        style: {
          ...n.style,
          transition: 'all 0.25s ease',
          opacity,
          transform: `scale(${scale})`,
          zIndex: isFocused ? 1000 : spotlightSet.oneHop.has(n.id) ? 500 : 1,
        },
        data: {
          ...n.data,
          opacity,
          isFocused,
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
      let opacity = 0.08;
      let isHighlighted = false;

      const isSrcSelected = e.source === selectedFileId;
      const isTgtSelected = e.target === selectedFileId;

      if (isSrcSelected || isTgtSelected) {
        opacity = 0.85;
        isHighlighted = true;
      } else if (spotlightSet.oneHop.has(e.source) && spotlightSet.oneHop.has(e.target)) {
        opacity = 0.45;
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
