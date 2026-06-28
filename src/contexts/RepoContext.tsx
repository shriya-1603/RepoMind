import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { analyzeRepo, getAnalysisStatus } from '../services/repoApi';

interface RepoContextType {
  analysisId: string | null;
  repoUrl: string | null;
  repoName: string | null;
  source: 'neo4j' | 'mock' | 'none';
  isAnalyzing: boolean;
  status: 'idle' | 'loading' | 'complete' | 'error';
  errorMessage: string | null;
  startAnalysis: (repoUrl: string) => Promise<any>;
  checkStatus: () => Promise<void>;
  setActiveRepository: (repoName: string, repoUrl: string, analysisId: string, source: 'neo4j' | 'mock' | 'none') => void;
  clearActiveRepository: () => void;
  setAnalysisId: (id: string | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  // Kept for backward compatibility if needed, but redirects to clearActiveRepository
  clearAnalysis: () => void;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

const loadState = () => {
  const saved = localStorage.getItem('repomind_active_repo');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return null;
};

export const RepoProvider = ({ children }: { children: ReactNode }) => {
  const initialState = loadState() || { analysisId: null, repoUrl: null, repoName: null, source: 'none' };

  const [analysisId, setAnalysisIdState] = useState<string | null>(initialState.analysisId);
  const [repoUrl, setRepoUrlState] = useState<string | null>(initialState.repoUrl);
  const [repoName, setRepoNameState] = useState<string | null>(initialState.repoName);
  const [source, setSourceState] = useState<'neo4j' | 'mock' | 'none'>(initialState.source);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveState = useCallback((id: string | null, url: string | null, name: string | null, src: 'neo4j' | 'mock' | 'none') => {
    setAnalysisIdState(id);
    setRepoUrlState(url);
    setRepoNameState(name);
    setSourceState(src);
    localStorage.setItem('repomind_active_repo', JSON.stringify({ analysisId: id, repoUrl: url, repoName: name, source: src }));
  }, []);

  const setActiveRepository = useCallback((name: string, url: string, id: string, src: 'neo4j' | 'mock' | 'none') => {
    saveState(id, url, name, src);
    setStatus('complete');
  }, [saveState]);

  const clearActiveRepository = useCallback(() => {
    saveState(null, null, null, 'none');
    setStatus('idle');
    setErrorMessage(null);
    setIsAnalyzing(false);
  }, [saveState]);

  const clearAnalysis = clearActiveRepository;

  const setAnalysisId = useCallback((id: string | null) => {
    setAnalysisIdState(id);
    localStorage.setItem('repomind_active_repo', JSON.stringify({ analysisId: id, repoUrl, repoName, source }));
  }, [repoUrl, repoName, source]);

  const startAnalysis = useCallback(async (url: string) => {
    setStatus('loading');
    setIsAnalyzing(true);
    setErrorMessage(null);

    // Basic extraction of repo name from URL (e.g. owner/repo)
    let parsedName = url;
    try {
      const parsedUrl = new URL(url);
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        parsedName = `${parts[0]}/${parts[1]}`;
      }
    } catch (e) {}

    try {
      const response = await analyzeRepo(url);
      saveState(response.id, url, parsedName, 'neo4j');
      setStatus('complete');
      return response;
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to analyze repository.');
      setStatus('error');
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, [saveState]);

  const checkStatus = useCallback(async () => {
    if (!analysisId) return;

    try {
      const response = await getAnalysisStatus(analysisId);
      setStatus(response.status === 'complete' ? 'complete' : 'loading');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to check analysis status.');
      setStatus('error');
    }
  }, [analysisId]);

  return (
    <RepoContext.Provider 
      value={{ 
        analysisId, repoUrl, repoName, source, isAnalyzing, status, errorMessage, 
        startAnalysis, checkStatus, setActiveRepository, clearActiveRepository, setAnalysisId, setIsAnalyzing, clearAnalysis
      }}
    >
      {children}
    </RepoContext.Provider>
  );
};

export const useRepo = () => {
  const context = useContext(RepoContext);
  if (!context) {
    throw new Error('useRepo must be used within <RepoProvider>');
  }
  return context;
};
