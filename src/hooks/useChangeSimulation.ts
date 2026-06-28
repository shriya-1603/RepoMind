import { useEffect, useState } from 'react';
import { runChangeSimulation } from '../services/repoApi';
import type { ChangeSimulationResponse } from '../services/repoApi';

interface ChangeSimulationState {
  data: ChangeSimulationResponse | null;
  loading: boolean;
  error: string | null;
  warning: string | null;
}

export const useChangeSimulation = (analysisId: string, target: string | null) => {
  const [state, setState] = useState<ChangeSimulationState>({
    data: null,
    loading: false,
    error: null,
    warning: null,
  });

  useEffect(() => {
    if (!target?.trim()) {
      setState({ data: null, loading: false, error: null, warning: null });
      return;
    }

    let active = true;
    const trimmed = target.trim();
    const requestUrl = `/change-simulation/${analysisId}`;

    setState({ data: null, loading: true, error: null, warning: null });

    if (import.meta.env.DEV) {
      console.debug('[ChangeSimulation] request URL:', requestUrl);
      console.debug('[ChangeSimulation] target:', trimmed);
    }

    runChangeSimulation(analysisId, trimmed)
      .then(response => {
        if (!active) return;
        const warning = response.source === 'mock' ? 'Using mock change simulation due to backend fallback.' : null;
        if (import.meta.env.DEV) {
          console.debug('[ChangeSimulation] result count:', response.directFiles.length + response.directFunctions.length + response.indirectFunctions.length + response.affectedClasses.length);
          console.debug('[ChangeSimulation] source:', response.source);
        }
        setState({ data: response, loading: false, error: null, warning });
      })
      .catch(error => {
        if (!active) return;
        if (import.meta.env.DEV) {
          console.debug('[ChangeSimulation] error:', error);
        }
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Change simulation failed',
          warning: 'Change simulation unavailable. Please try again later.',
        });
      });

    return () => {
      active = false;
    };
  }, [analysisId, target]);

  return state;
};
