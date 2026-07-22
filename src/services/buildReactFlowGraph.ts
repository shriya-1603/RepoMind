import type { Node, Edge } from '@xyflow/react';
import type { RealGraphNode, RealGraphEdge } from './repoApi';
import type { PositionedNode, Subsystem } from '../hooks/useExplorerLayout';

function deterministicPosition(id: string, index: number, total: number): { x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + (hash % 100) * 0.02;
  const radius = 220 + Math.abs(hash % 150);
  return {
    x: Math.cos(angle) * radius + 500,
    y: Math.sin(angle) * radius + 350,
  };
}

export function buildReactFlowGraph(
  viewMode: 'system' | 'graph',
  layoutNodes: PositionedNode[],
  subsystems: Subsystem[],
  rawNodes: RealGraphNode[],
  rawEdges: RealGraphEdge[],
  expandedSubsystemId: string | null,
  isRealGraph: boolean,
  mockFileNodes: any[],
  mockDependencyEdges: any[]
): { nodes: Node[]; edges: Edge[] } {

  const visibleNodeIds = new Set(layoutNodes.map(n => n.id));

  // ── Mode 1: Flat Dependency Graph ──────────────────────────────────────────
  if (viewMode === 'graph') {
    if (isRealGraph) {
      const fileNodes = layoutNodes
        .filter(n => !n.id.startsWith('subsystem:'))
        .map((n, idx, arr) => {
          const fileNode = rawNodes.find(r => r.id === n.id);
          const pos = deterministicPosition(n.id, idx, arr.length);
          return {
            id: n.id,
            type: 'realNode',
            position: pos,
            data: {
              label: fileNode?.label ?? n.id.split('/').pop() ?? n.id,
              type: fileNode?.type ?? 'file',
              metadata: fileNode?.metadata ?? {}
            }
          };
        });

      const fileEdges = rawEdges
        .filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
        .map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'customEdge',
          data: { type: e.type, label: e.type }
        }));

      return { nodes: fileNodes, edges: fileEdges };
    } else {
      const nodes = mockFileNodes.map((node, idx) => ({
        id: node.id,
        type: 'customNode',
        position: deterministicPosition(node.id, idx, mockFileNodes.length),
        data: {
          label: node.name,
          type: node.type,
          linesOfCode: node.linesOfCode,
          importCount: node.importCount,
          exportCount: node.exportCount,
          complexity: node.complexity,
        },
      }));

      const edges = mockDependencyEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'customEdge',
        data: { type: e.importType || 'import', label: e.symbols.join(', ') },
        animated: false,
      }));

      return { nodes, edges };
    }
  }

  // ── Mode 2: System Map ──────────────────────────────────────────────────────
  const nodes = layoutNodes.map(n => {
    const isSubsystem = n.id.startsWith('subsystem:');
    if (isSubsystem) {
      const subId = n.id.replace('subsystem:', '');
      const subsystem = subsystems.find(s => s.id === subId);
      return {
        id: n.id,
        type: 'subsystemNode',
        position: { x: n.x, y: n.y },
        width: n.width,
        height: n.height,
        data: {
          id: subId,
          label: subsystem?.name.replace(' Area', '') ?? subId,
          description: subsystem?.description ?? '',
          filesCount: subsystem?.fileIds.length ?? 0,
          functionsCount: subsystem?.metrics.functions ?? 0,
          classesCount: subsystem?.metrics.classes ?? 0,
          entryFile: subsystem?.entryFiles?.[0]?.split('/')?.pop() ?? '',
          risk: subsystem?.risk ?? 'low',
          isExpanded: expandedSubsystemId === subId
        }
      };
    } else {
      const fileNode = rawNodes.find(r => r.id === n.id);
      return {
        id: n.id,
        type: 'realNode',
        position: { x: n.x, y: n.y },
        data: {
          label: fileNode?.label ?? n.id.split('/').pop() ?? n.id,
          type: fileNode?.type ?? 'file',
          metadata: fileNode?.metadata ?? {}
        }
      };
    }
  });

  const edgesList: Edge[] = [];

  // Render Subsystem-to-Subsystem dependencies
  subsystems.forEach(sub => {
    sub.dependencies.forEach(depId => {
      edgesList.push({
        id: 'subsystem-edge:' + sub.id + '-' + depId,
        source: 'subsystem:' + sub.id,
        target: 'subsystem:' + depId,
        type: 'customEdge',
        data: { type: 'dependency', label: 'depends' }
      });
    });
  });

  if (expandedSubsystemId) {
    // ── PROJECT EDGES TO FILE LEVEL ──
    const childToFile = new Map<string, string>();
    rawEdges.forEach(e => {
      if (e.type === 'FILE_CONTAINS_FUNCTION' || e.type === 'FILE_CONTAINS_CLASS') {
        childToFile.set(e.target, e.source);
      }
    });

    const fileIds = new Set(rawNodes.filter(n => n.type === 'file').map(n => n.id));
    const projectedEdges: RealGraphEdge[] = [];
    const seen = new Set<string>();

    rawEdges.forEach(e => {
      if (e.type !== 'FUNCTION_CALLS_FUNCTION' && e.type !== 'INHERITS_FROM') return;
      const srcFile = childToFile.get(e.source);
      const tgtFile = childToFile.get(e.target);

      if (srcFile && tgtFile && srcFile !== tgtFile && fileIds.has(srcFile) && fileIds.has(tgtFile)) {
        const key = `${srcFile}→${tgtFile}`;
        if (!seen.has(key)) {
          seen.add(key);
          projectedEdges.push({
            id: `dep:${srcFile}→${tgtFile}`,
            source: srcFile,
            target: tgtFile,
            type: e.type
          });
        }
      }
    });

    console.log('[MAPPING CHECK] PROJECTED EDGES SUMMARY:', {
      projectedEdges: projectedEdges.length,
      sample: projectedEdges.slice(0, 5)
    });

    let accepted = 0;
    projectedEdges.forEach(e => {
      if (visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)) {
        accepted++;
        edgesList.push({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          animated: false,
          data: { type: e.type, label: e.type }
        });
      }
    });

    console.log('[MAPPING CHECK] accepted file-to-file edges:', accepted);
  }

  return { nodes, edges: edgesList };
}
