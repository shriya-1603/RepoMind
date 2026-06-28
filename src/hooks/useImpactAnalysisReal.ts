import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { ImpactAnalysisRealData } from '../services/repoApi';

interface ImpactAnalysisRealState {
  data: ImpactAnalysisRealData | null;
  loading: boolean;
  error: string | null;
  warning?: string | null;
}

import { trackImpactAnalysis } from '../services/observability';

export const useImpactAnalysisReal = (analysisId: string, targetName: string | null, repoName = '') => {
  const [state, setState] = useState<ImpactAnalysisRealState>({
    data: null,
    loading: false,
    error: null,
    warning: null,
  });

  useEffect(() => {
    if (!targetName) {
      setState({ data: null, loading: false, error: null, warning: null });
      return;
    }

    let active = true;
    setState(prev => ({ ...prev, loading: true, error: null }));
    const startTime = Date.now();

    apiFetch<ImpactAnalysisRealData>(
      `/impact-analysis-real/${analysisId}?target=${encodeURIComponent(targetName)}`
    )
      .then(response => {
        if (!active) return;
        const durationMs = Date.now() - startTime;
        
        if (response.source === 'mock') {
          trackImpactAnalysis(analysisId, repoName || 'unknown', durationMs, false);
          setState({
            data: null,
            loading: false,
            error: 'Backend query returned mock impact analysis results. Disallowed in stabilization.',
            warning: null,
          });
        } else {
          trackImpactAnalysis(analysisId, repoName || 'unknown', durationMs, true);
          setState({ data: response, loading: false, error: null, warning: null });
        }
      })
      .catch(error => {
        if (!active) return;
        const durationMs = Date.now() - startTime;
        trackImpactAnalysis(analysisId, repoName || 'unknown', durationMs, false);
        setState({
          data: null,
          loading: false,
          error: error.message || 'Impact analysis fetch failed',
          warning: null,
        });
      });

    return () => {
      active = false;
    };
  }, [analysisId, targetName, repoName]);

  return state;
};
