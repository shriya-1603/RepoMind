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
      const blockFiles = nodes.filter(n => fIds.includes(n.id));
      const entryFiles = blockFiles
        .filter(n => (n.metadata.imports_count || 0) < 3)
        .slice(0, 2)
        .map(n => n.id);

      const criticalFiles = blockFiles
        .filter(n => (n.metadata.imports_count || 0) + (n.metadata.exports_count || 0) > 4)
        .slice(0, 3)
        .map(n => n.id);

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
        dependencies: [],
        incomingDependencies: [],
        risk: criticalFiles.length > 1 ? 'high' : 'medium',
        metrics: {
          files: fIds.length,
          functions: totalFunctions || fIds.length * 4,
          classes: totalClasses || fIds.length,
        },
      });
    });

    // Compute subsystem dependencies
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

  // 2. Compute dynamic grid layout positioning
  const layoutNodes = useMemo<PositionedNode[]>(() => {
    const positioned: PositionedNode[] = [];
    const blockSpacingX = 680;
    const blockSpacingY = 480;

    const sortedSubsystems = [...subsystems].sort((a, b) => {
      return a.dependencies.length - b.dependencies.length;
    });

    sortedSubsystems.forEach((sub, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const subX = col * blockSpacingX + 100;
      const subY = row * blockSpacingY + 100;

      const baseWidth = 280 + Math.min(sub.fileIds.length * 8, 80);
      const baseHeight = 160 + Math.min(sub.metrics.functions * 1.5, 80);

      const isExpanded = expandedSubsystemId === sub.id;

      // File Grid Parameters (Step 3 & 4)
      const COLS = 3;
      const CARD_W = 180;
      const CARD_H = 70;
      const GAP_X = 24;
      const GAP_Y = 20;
      const padding = 24;
      const headerOffset = 130;

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

      console.log("=== SUBSYSTEM LAYOUT TRACE ===", {
        subsystem: sub.id,
        expandedSubsystemId,
        isExpanded,
        fileCount: categorizedFiles.length
      });

      const rowsCount = Math.max(Math.ceil(childFiles.length / COLS), 1);
      const expandedWidth = COLS * CARD_W + (COLS - 1) * GAP_X + padding * 2;
      const expandedHeight = rowsCount * CARD_H + (rowsCount - 1) * GAP_Y + headerOffset + padding * 2;

      positioned.push({
        id: `subsystem:${sub.id}`,
        type: 'subsystemNode',
        x: subX,
        y: subY,
        width: isExpanded ? expandedWidth : baseWidth,
        height: isExpanded ? expandedHeight : baseHeight,
      });

      // If expanded, lay out children in a clean grid
      if (isExpanded) {
        categorizedFiles.forEach((fileObj, index) => {
          const colIdx = index % COLS;
          const rowIdx = Math.floor(index / COLS);

          const fileNodeX = subX + padding + colIdx * (CARD_W + GAP_X);
          const fileNodeY = subY + headerOffset + rowIdx * (CARD_H + GAP_Y);

          positioned.push({
            id: fileObj.node.id,
            type: 'realNode',
            x: fileNodeX,
            y: fileNodeY,
            width: CARD_W,
            height: CARD_H,
            subsystemId: sub.id,
            role: fileObj.role,
          });
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
