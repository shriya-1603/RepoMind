import { useEffect, useState } from 'react';
import { getSemanticSearchReal } from '../services/repoApi';
import type { SemanticSearchResponse } from '../services/repoApi';

// Mock mapping helpers removed in stabilization

import { trackSearch } from '../services/observability';

export const useSemanticSearchReal = (analysisId: string, query: string, repoName = '') => {
  const [data, setData] = useState<SemanticSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const executeSearch = async () => {
      const trimmed = query.trim();
      if (!analysisId || !trimmed) {
        return;
      }

      setLoading(true);
      setError(null);
      setWarning(null);

      const startTime = Date.now();

      try {
        const response = await getSemanticSearchReal(analysisId, trimmed);
        if (canceled) return;

        const durationMs = Date.now() - startTime;
        trackSearch(analysisId, repoName || 'unknown', durationMs, true);

        if (response.source === 'mock') {
          setError('Backend query returned mock results.');
          setData(null);
        } else {
          setData(response);
        }
      } catch (err: any) {
        if (canceled) return;
        const durationMs = Date.now() - startTime;
        trackSearch(analysisId, repoName || 'unknown', durationMs, false);
        const message = err instanceof Error ? err.message : 'Semantic search failed';
        setError(message);
        setData(null);
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    executeSearch();

    return () => {
      canceled = true;
    };
  }, [analysisId, query, repoName]);

  return {
    data,
    loading,
    error,
    warning,
  };
};
