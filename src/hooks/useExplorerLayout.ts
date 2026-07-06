import { useMemo } from 'react';
import type { RealGraphNode, RealGraphEdge } from '../services/repoApi';

export interface PositionedNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  subsystemId?: string;
  role?: 'entry' | 'core' | 'helper';
}

export interface Subsystem {
  id: string;
  name: string;
  description: string;
  fileIds: string[];
  entryFiles: string[];
  criticalFiles: string[];
  dependencies: string[];
  incomingDependencies: string[];
  risk: 'low' | 'medium' | 'high';
  metrics: {
    files: number;
    functions: number;
    classes: number;
  };
}

export const useExplorerLayout = (
  nodes: RealGraphNode[],
  edges: RealGraphEdge[],
  expandedSubsystemId: string | null
) => {
  // 1. Group nodes into Subsystems based on file paths and layer data
  const subsystems = useMemo<Subsystem[]>(() => {
    // Inferred grouping by directory namespace
    const subMap = new Map<string, string[]>();
    nodes.forEach(n => {
      if (n.type !== 'file') return;
      const pathParts = (n.metadata.rel_path as string || '').split('/');
      const groupName = pathParts.length > 1 ? pathParts[0] : 'core';
      if (!subMap.has(groupName)) {
        subMap.set(groupName, []);
      }
      subMap.get(groupName)!.push(n.id);
    });

    const list: Subsystem[] = [];
    Array.from(subMap.entries()).forEach(([name, fIds]) => {
      // Find files of highest dependency degree for critical and entry points
      const blockFiles = nodes.filter(n => fIds.includes(n.id));
      const entryFiles = blockFiles
        .filter(n => (n.metadata.imports_count || 0) < 3)
        .slice(0, 2)
        .map(n => n.id);

      const criticalFiles = blockFiles
        .filter(n => (n.metadata.imports_count || 0) + (n.metadata.exports_count || 0) > 4)
        .slice(0, 3)
        .map(n => n.id);

      // Sum up functions/classes metrics
      let totalFunctions = 0;
      let totalClasses = 0;
      blockFiles.forEach(f => {
        totalFunctions += (f.metadata.functions_count as number) || 0;
        totalClasses += (f.metadata.classes_count as number) || 0;
      });

      list.push({
        id: name,
        name: name.charAt(0).toUpperCase() + name.slice(1) + ' Area',
        description: `Handles subsystem orchestration, imports, and interface integrations for the ${name} folder area.`,
        fileIds: fIds,
        entryFiles,
        criticalFiles,
        dependencies: [], // Inferred below
        incomingDependencies: [], // Inferred below
        risk: criticalFiles.length > 1 ? 'high' : 'medium',
        metrics: {
          files: fIds.length,
          functions: totalFunctions || fIds.length * 4,
          classes: totalClasses || fIds.length,
        },
      });
    });

    // Compute subsystem dependencies based on cross-subsystem file edges
    list.forEach(sub => {
      const otherDeps = new Set<string>();
      sub.fileIds.forEach(fId => {
        edges.forEach(e => {
          if (e.source === fId) {
            const targetSub = list.find(s => s.fileIds.includes(e.target) && s.id !== sub.id);
            if (targetSub) otherDeps.add(targetSub.id);
          }
        });
      });
      sub.dependencies = Array.from(otherDeps);
    });

    // Compute incoming dependencies
    list.forEach(sub => {
      const incoming = list
        .filter(s => s.dependencies.includes(sub.id))
        .map(s => s.id);
      sub.incomingDependencies = incoming;
    });

    return list;
  }, [nodes, edges]);

  // 2. Compute dynamic positioning
  const layoutNodes = useMemo<PositionedNode[]>(() => {
    const positioned: PositionedNode[] = [];
    const blockSpacingX = 400;
    const blockSpacingY = 320;

    // Lay out subsystem blocks dynamically in a simple layered hierarchy based on dependency sorting
    const sortedSubsystems = [...subsystems].sort((a, b) => {
      // Put blocks with no dependencies (config/API) at top
      return a.dependencies.length - b.dependencies.length;
    });

    sortedSubsystems.forEach((sub, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const subX = col * blockSpacingX + 100;
      const subY = row * blockSpacingY + 100;

      // Base Subsystem block size scales with importance (number of files/functions)
      const baseWidth = 260 + Math.min(sub.fileIds.length * 10, 80);
      const baseHeight = 160 + Math.min(sub.metrics.functions * 2, 80);

      // Determine size of block based on whether it is expanded
      const isExpanded = expandedSubsystemId === sub.id;
      const expandedWidth = Math.max(baseWidth, 420);
      
      // Compute rows of files (Start Here, Core, Helpers)
      const childFiles = nodes.filter(n => sub.fileIds.includes(n.id));
      const entryNodeIds = sub.entryFiles;
      const criticalNodeIds = sub.criticalFiles;

      const categorizedFiles = childFiles.map(f => {
        let role: 'entry' | 'core' | 'helper' = 'core';
        if (entryNodeIds.includes(f.id)) role = 'entry';
        else if (criticalNodeIds.includes(f.id)) role = 'core';
        else if ((f.metadata.imports_count || 0) > 3) role = 'helper';
        return { node: f, role };
      });

      const expandedHeight = isExpanded
        ? baseHeight + Math.ceil(childFiles.length / 2) * 90 + 60
        : baseHeight;

      positioned.push({
        id: `subsystem:${sub.id}`,
        type: 'subsystemNode',
        x: subX,
        y: subY,
        width: isExpanded ? expandedWidth : baseWidth,
        height: expandedHeight,
      });

      // If expanded, lay out children inside in clean segmented rows (Start Here/Core/Helpers)
      if (isExpanded) {
        let fileIndex = 0;
        const gridCols = 2;
        const startOffsetElementY = 130;

        categorizedFiles.forEach(fileObj => {
          const colIdx = fileIndex % gridCols;
          const rowIdx = Math.floor(fileIndex / gridCols);
          const fileNodeX = subX + 25 + colIdx * 180;
          const fileNodeY = subY + startOffsetElementY + rowIdx * 80;

          positioned.push({
            id: fileObj.node.id,
            type: 'realNode',
            x: fileNodeX,
            y: fileNodeY,
            width: 160,
            height: 65,
            subsystemId: sub.id,
            role: fileObj.role,
          });

          fileIndex++;
        });
      }
    });

    return positioned;
  }, [subsystems, expandedSubsystemId, nodes]);

  return {
    subsystems,
    layoutNodes,
  };
};
