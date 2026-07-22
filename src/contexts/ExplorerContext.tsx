import React from 'react';
import type { PositionedNode } from '../hooks/useExplorerLayout';

export interface ExplorerContextType {
  expandedSubsystemId: string | null;
  expandSubsystem: (id: string) => void;
  collapseSubsystem: () => void;
  zoomToNode: (x: number, y: number, zoomLevel?: number) => void;
  resetCamera: () => void;
  layoutNodes: PositionedNode[];
}

export const ExplorerContext = React.createContext<ExplorerContextType | null>(null);
