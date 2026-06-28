import { useState, useEffect, useCallback, useRef } from 'react';
import { getGraphReal } from '../services/repoApi';
import type { RealGraphNode, RealGraphEdge } from '../services/repoApi';
import { mockFileNodes, mockDependencyEdges } from '../data/mockRepositoryData';

export interface RealGraphDataState {
  nodes: RealGraphNode[];
  edges: RealGraphEdge[];
  source: 'neo4j' | 'mock' | null;
  loading: boolean;
  error: string | null;
  warning?: string | null; // Non-blocking warning (backend unavailable but using mock)
}

const IS_DEV = import.meta.env.DEV;

/**
 * Convert frontend mockFileNodes to backend-compatible RealGraphNode format
 */
const getMockGraphData = () => {
  const nodes: RealGraphNode[] = mockFileNodes.map(node => ({
    id: node.id,
    type: node.type as any,
    label: node.name,
    metadata: {
      path: node.path,
      linesOfCode: node.linesOfCode,
      imports_count: node.importCount,
      exports_count: node.exportCount,
      complexity: node.complexity,
    },
  }));

  const edges: RealGraphEdge[] = mockDependencyEdges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.importType || 'default',
  }));

  return { nodes, edges };
};

/**
 * Fetch the unified graph (real Neo4j or mock fallback) for a given
 * analysis_id.  If analysisId is empty/null, returns mock data immediately
 * without making a network request.
 *
 * Results are memoised per analysisId so that tab-switching does not
 * re-trigger a network round-trip.
 */
export const useRealGraphData = (analysisId?: string | null) => {
  const hasId = !!analysisId;
  const effectiveId = analysisId || '';

  const [state, setState] = useState<RealGraphDataState>(() => {
    if (!hasId) {
      // No real repo yet — return mock data immediately, no fetch
      const { nodes, edges } = getMockGraphData();
      return { nodes, edges, source: 'mock', loading: false, error: null, warning: 'No repository imported — showing demo graph data.' };
    }
    return { nodes: [], edges: [], source: null, loading: true, error: null, warning: null };
  });

  // Simple per-session memo cache keyed by analysisId
  const cache = useRef<Map<string, RealGraphDataState>>(new Map());

  const fetch = useCallback(async () => {
    // Return cached result immediately
    if (cache.current.has(effectiveId)) {
      setState(cache.current.get(effectiveId)!);
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await getGraphReal(effectiveId);
      const next: RealGraphDataState = {
        nodes: response.nodes,
        edges: response.edges,
        source: response.source,
        loading: false,
        error: null,
      };
      cache.current.set(effectiveId, next);
      setState(next);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Graph fetch failed';
      
      if (IS_DEV) {
        console.error(
          `[Graph] Failed to fetch /graph-real/${effectiveId}:`,
          { error: msg, analysisId: effectiveId },
        );
      }
      
      if (!hasId) {
        // Fall back to mock data instead of blocking with error
        const { nodes, edges } = getMockGraphData();
        setState({
          nodes,
          edges,
          source: 'mock',
          loading: false,
          error: null,
          warning: `Backend unavailable — using mock graph data (${msg})`,
        });
      } else {
        setState({
          nodes: [],
          edges: [],
          source: null,
          loading: false,
          error: msg,
          warning: null,
        });
      }
    }
  }, [effectiveId, hasId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Return cached result immediately
      if (cache.current.has(effectiveId)) {
        if (!cancelled) setState(cache.current.get(effectiveId)!);
        return;
      }

      if (!cancelled) setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        if (IS_DEV) {
          console.log(`[Graph] Fetching /graph-real/${effectiveId}...`);
        }
        
        const response = await getGraphReal(effectiveId);
        
        if (IS_DEV) {
          console.log(`[Graph] Fetch succeeded. Source: ${response.source}, Nodes: ${response.nodes.length}, Edges: ${response.edges.length}`);
        }
        
        const next: RealGraphDataState = {
          nodes: response.nodes,
          edges: response.edges,
          source: response.source,
          loading: false,
          error: null,
          warning: null,
        };
        cache.current.set(effectiveId, next);
        if (!cancelled) setState(next);
      } catch (err: unknown) {
        const msg = err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Graph fetch failed';
        
        if (IS_DEV) {
          console.error(
            `[Graph] Failed to fetch /graph-real/${effectiveId}:`,
            { error: msg, analysisId: effectiveId },
          );
        }
        
        if (!cancelled) {
          if (!hasId) {
            // Fall back to mock data instead of blocking with error
            const { nodes, edges } = getMockGraphData();
            setState({
              nodes,
              edges,
              source: 'mock',
              loading: false,
              error: null,
              warning: `Backend unavailable — using mock graph data (${msg})`,
            });
          } else {
            setState({
              nodes: [],
              edges: [],
              source: null,
              loading: false,
              error: msg,
              warning: null,
            });
          }
        }
      }
    };

    run();

    return () => { cancelled = true; };
  }, [effectiveId, hasId]);

  return { ...state, refetch: fetch };
};
