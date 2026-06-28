import { useState } from 'react';
import { searchSemantic } from '../services/repoApi';
import type { LegacySemanticSearchResponse } from '../services/repoApi';

interface SearchState {
  results: LegacySemanticSearchResponse | null;
  loading: boolean;
  error: string | null;
}

export const useSemanticSearch = (analysisId: string) => {
  const [state, setState] = useState<SearchState>({
    results: null,
    loading: false,
    error: null,
  });

  const search = async (query: string) => {
    setState({ results: null, loading: true, error: null });

    try {
      const response = await searchSemantic(analysisId, query);
      setState({ results: response, loading: false, error: null });
      return response;
    } catch (error: any) {
      setState({ results: null, loading: false, error: error.message || 'Semantic search failed' });
      throw error;
    }
  };

  return {
    ...state,
    search,
  };
};
