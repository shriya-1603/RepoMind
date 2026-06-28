import { useState, useEffect } from 'react';
import { getGraph } from '../services/repoApi';
import type { GraphNode, GraphEdge } from '../services/repoApi';

interface GraphDataState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  error: string | null;
}

export const useGraphData = (analysisId: string) => {
  const [state, setState] = useState<GraphDataState>({
    nodes: [],
    edges: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    setState(prev => ({ ...prev, loading: true, error: null }));

    getGraph(analysisId)
      .then(response => {
        if (!active) return;
        setState({ nodes: response.nodes, edges: response.edges, loading: false, error: null });
      })
      .catch(error => {
        if (!active) return;
        setState({ nodes: [], edges: [], loading: false, error: error.message || 'Graph fetch failed' });
      });

    return () => {
      active = false;
    };
  }, [analysisId]);

  return state;
};
