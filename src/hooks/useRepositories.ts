import { useState, useEffect, useCallback } from 'react';
import { getRepositories, importRepository } from '../services/repoApi';
import type { RepositoryMetadata } from '../services/repoApi';

export const useRepositories = () => {
  const [repos, setRepos] = useState<RepositoryMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRepositories();
      setRepos(res.repositories || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load repositories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { repos, loading, error, refresh: fetch };
};

export const useRepoImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepositoryMetadata | null>(null);

  const runImport = async (url: string, branch?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await importRepository(url, branch);
      setResult(res);
      return res;
    } catch (err: any) {
      setError(err.message || 'Import failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, result, runImport };
};
