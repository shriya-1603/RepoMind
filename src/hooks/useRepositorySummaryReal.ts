import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { RepositorySummaryRealData } from '../services/repoApi';

interface RepositorySummaryState {
  data: RepositorySummaryRealData | null;
  loading: boolean;
  error: string | null;
  warning?: string | null;
}

export const useRepositorySummaryReal = (analysisId: string | null) => {
  const [state, setState] = useState<RepositorySummaryState>({
    data: null,
    loading: true,
    error: null,
    warning: null,
  });

  useEffect(() => {
    if (!analysisId) {
      setState({ data: null, loading: false, error: null, warning: null });
      return;
    }

    let active = true;
    setState(prev => ({ ...prev, loading: true, error: null }));

    apiFetch<RepositorySummaryRealData>(`/repository-summary-real/${analysisId}`)
      .then(response => {
        if (!active) return;
        if (response.source === 'mock') {
          setState({
            data: null,
            loading: false,
            error: 'Backend query returned mock repository summary results. Disallowed in stabilization.',
            warning: null,
          });
        } else {
          setState({ data: response, loading: false, error: null, warning: null });
        }
      })
      .catch(error => {
        if (!active) return;
        setState({
          data: null,
          loading: false,
          error: error.message || 'Repository summary fetch failed',
          warning: null,
        });
      });

    return () => {
      active = false;
    };
  }, [analysisId]);

  return state;
};
