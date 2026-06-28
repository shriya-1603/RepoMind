import { useState, useEffect } from 'react';
import { getRepositoryActivity } from '../services/repoApi';
import type { RepositoryActivityData } from '../services/repoApi';
import { trackActivityFetch } from '../services/observability';

interface RepositoryActivityState {
  data: RepositoryActivityData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches real Git activity for a given analysisId.
 * - No mock fallback: if source === 'unavailable', data is returned as-is.
 * - Tracks fetch duration via observability service.
 * - Returns loading/error states for UI gating.
 */
export const useRepositoryActivityReal = (
  analysisId: string | null,
  repoName = '',
) => {
  const [state, setState] = useState<RepositoryActivityState>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!analysisId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let active = true;
    setState({ data: null, loading: true, error: null });

    const start = Date.now();

    getRepositoryActivity(analysisId)
      .then((response) => {
        if (!active) return;
        trackActivityFetch(analysisId, repoName, Date.now() - start, true);
        setState({ data: response, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!active) return;
        trackActivityFetch(analysisId, repoName, Date.now() - start, false);
        setState({
          data: null,
          loading: false,
          error: err.message || 'Failed to load repository activity',
        });
      });

    return () => {
      active = false;
    };
  }, [analysisId, repoName]);

  return state;
};
