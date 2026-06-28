import { useState, useCallback } from 'react';
import { runChangeSimulationReal } from '../services/repoApi';
import type { ChangeSimulationRealResponse } from '../services/repoApi';

interface ChangeSimulationRealState {
  data: ChangeSimulationRealResponse | null;
  loading: boolean;
  error: string | null;
  warning: string | null;
}

/**
 * Hook for the POST /change-simulation-real/{analysis_id} endpoint.
 *
 * Unlike the effect-based useChangeSimulation hook, this one exposes a
 * `run(target)` callback so the user explicitly triggers the simulation.
 */
import { trackChangeSimulation } from '../services/observability';

export const useChangeSimulationReal = (analysisId: string, repoName = '') => {
  const [state, setState] = useState<ChangeSimulationRealState>({
    data: null,
    loading: false,
    error: null,
    warning: null,
  });

  const run = useCallback(
    async (target: string) => {
      const trimmed = target.trim();
      if (!trimmed) return;

      setState({ data: null, loading: true, error: null, warning: null });
      const startTime = Date.now();

      if (import.meta.env.DEV) {
        console.debug('[ChangeSimulationReal] analysisId:', analysisId, 'target:', trimmed);
      }

      try {
        const response = await runChangeSimulationReal(analysisId, trimmed);
        const durationMs = Date.now() - startTime;

        if (response.source === 'mock') {
          trackChangeSimulation(analysisId, repoName || 'unknown', durationMs, false);
          setState({
            data: null,
            loading: false,
            error: 'Backend query returned mock change simulation results. Disallowed in stabilization.',
            warning: null,
          });
        } else {
          trackChangeSimulation(analysisId, repoName || 'unknown', durationMs, true);
          setState({ data: response, loading: false, error: null, warning: null });
        }
      } catch (err) {
        const durationMs = Date.now() - startTime;
        trackChangeSimulation(analysisId, repoName || 'unknown', durationMs, false);
        if (import.meta.env.DEV) {
          console.debug('[ChangeSimulationReal] error:', err);
        }
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Change simulation failed',
          warning: null,
        });
      }
    },
    [analysisId, repoName],
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, warning: null });
  }, []);

  return { ...state, run, reset };
};
