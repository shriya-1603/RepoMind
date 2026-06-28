import React, { useState, useEffect } from 'react';
import GlassCard from './GlassCard';
import { X, Search } from 'lucide-react';
import { analyzeRepo } from '../services/repoApi';
import { useRepo } from '../contexts/RepoContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (repoId: string) => void;
}

const parseRepoName = (repoUrl: string): string => {
  try {
    const parsed = new URL(repoUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } catch (e) {}
  return repoUrl;
};

const ImportRepoModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always call hook unconditionally
  const { setActiveRepository } = useRepo();

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setImporting(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleImport = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setImporting(true);
    setError(null);
    const startTime = Date.now();
    console.debug('import started');
    console.debug('request URL', trimmedUrl);

    try {
      const res = await analyzeRepo(trimmedUrl);
      console.debug('response id', res.id);
      console.debug('import success');

      const repoName = parseRepoName(trimmedUrl);

      // Set the full active repository context — this is the single source of truth
      setActiveRepository(repoName, trimmedUrl, res.id, 'neo4j');

      // Track import observability
      const durationMs = Date.now() - startTime;
      const { trackImport } = await import('../services/observability');
      trackImport(res.id, repoName, durationMs, true);

      if (onSuccess) onSuccess(res.id);

      // Reset fields
      setUrl('');
      setBranch('');
      onClose();
    } catch (err: any) {
      console.debug('import failed');
      const durationMs = Date.now() - startTime;
      const { trackImport } = await import('../services/observability');
      trackImport('', trimmedUrl, durationMs, false);
      setError(err.message || 'Import failed');
    } finally {
      console.debug('importing reset');
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md p-6">
        <GlassCard padding="lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Import Repository</h3>
              <p className="text-xs text-slate-500 mt-1">Paste a public GitHub repository URL to import.</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-mono">Repository URL</label>
              <div className="mt-2 relative">
                <input
                  className="w-full bg-white/[0.03] border border-white/6 px-3 py-2 rounded-md text-sm text-slate-200"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleImport()}
                  placeholder="https://github.com/owner/repo"
                />
                <Search size={14} className="absolute right-3 top-3 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase font-mono">Branch (optional)</label>
              <div className="mt-2">
                <input
                  className="w-full bg-white/[0.03] border border-white/6 px-3 py-2 rounded-md text-sm text-slate-200"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
            </div>

            {error && <div className="text-xs text-rose-400">{error}</div>}

            <div className="flex items-center justify-end gap-2 mt-2">
              <button onClick={onClose} className="px-3 py-2 text-xs bg-white/[0.02] rounded-md">Cancel</button>
              <button
                onClick={handleImport}
                disabled={importing || !url}
                className="px-3 py-2 text-xs bg-gradient-to-r from-indigo-600 to-rose-500 rounded-md text-white disabled:opacity-60"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default ImportRepoModal;
