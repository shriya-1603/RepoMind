import { useState, useEffect } from 'react';
import { getImpactAnalysis } from '../services/repoApi';
import type { ImpactAnalysis } from '../services/repoApi';

interface ImpactState {
  data: ImpactAnalysis | null;
  loading: boolean;
  error: string | null;
}

export const useImpactAnalysis = (analysisId: string) => {
  const [state, setState] = useState<ImpactState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });

    getImpactAnalysis(analysisId)
      .then(response => {
        if (!active) return;
        setState({ data: response, loading: false, error: null });
      })
      .catch(error => {
        if (!active) return;
        setState({ data: null, loading: false, error: error.message || 'Impact analysis fetch failed' });
      });

    return () => {
      active = false;
    };
  }, [analysisId]);

  return state;
};
