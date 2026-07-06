import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

export const useExplorerCamera = () => {
  const { setViewport, fitView } = useReactFlow();

  const zoomToNode = useCallback((x: number, y: number, zoomLevel: number = 1.2) => {
    // Offset slightly for right sidebar panels
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    const offsetX = x - (viewWidth * 0.1) / zoomLevel;
    const offsetY = y;

    const vpX = viewWidth / 2 - offsetX * zoomLevel;
    const vpY = viewHeight / 2 - offsetY * zoomLevel;

    setViewport({ x: vpX, y: vpY, zoom: zoomLevel }, { duration: 800 });
  }, [setViewport]);

  const resetCamera = useCallback(() => {
    fitView({ padding: 0.25, duration: 800 });
  }, [fitView]);

  return {
    zoomToNode,
    resetCamera,
  };
};
