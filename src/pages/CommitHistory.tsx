import React, { useState, useEffect } from 'react';
import { useRepo } from '../contexts/RepoContext';
import { getCommitHistory } from '../services/repoApi';
import type { CommitHistoryItem } from '../services/repoApi';
import { Search, GitCommit, ChevronLeft, ChevronRight, AlertCircle, FileText, Plus, Minus, GitBranch } from 'lucide-react';

const CommitHistory: React.FC = () => {
  const { analysisId, repoName } = useRepo();
  const [commits, setCommits] = useState<CommitHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [filterHash, setFilterHash] = useState('');
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  
  // Selected commit detail state
  const [selectedCommit, setSelectedCommit] = useState<CommitHistoryItem | null>(null);

  const fetchHistory = async () => {
    if (!analysisId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCommitHistory(analysisId, {
        q: searchQuery || undefined,
        author: filterAuthor || undefined,
        hash: filterHash || undefined,
        limit,
        offset
      });
      setCommits(data.commits);
      setTotal(data.total);
      
      // Auto-select first commit if none selected or selection not in results
      if (data.commits.length > 0) {
        if (!selectedCommit || !data.commits.some(c => c.hash === selectedCommit.hash)) {
          setSelectedCommit(data.commits[0]);
        }
      } else {
        setSelectedCommit(null);
      }
    } catch (e: any) {
      console.error(e);
      setError('Unable to load commit history from Neo4j database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [analysisId, offset, filterAuthor, filterHash, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchHistory();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterAuthor('');
    setFilterHash('');
    setOffset(0);
    setTimeout(fetchHistory, 0);
  };

  // Pagination helpers
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  if (!analysisId) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
        <GitBranch className="w-12 h-12 text-slate-600 mb-4 stroke-1" />
        <h2 className="text-lg font-semibold text-slate-300">No Repository Selected</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Select or import a repository from the Dashboard page first to view its Git history.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 p-6 overflow-hidden">
      {/* Header & Sub-Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <GitCommit className="w-6 h-6 text-indigo-500" />
            Git History Explorer
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Analyzing commits for <span className="text-slate-300 font-medium">{repoName}</span>
          </p>
        </div>

        {/* Search controls */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2 max-w-xl w-full md:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-white/6 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition"
            />
          </div>
          <div className="relative w-[130px]">
            <input
              type="text"
              placeholder="Author..."
              value={filterAuthor}
              onChange={(e) => setFilterAuthor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-white/6 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition"
            />
          </div>
          <div className="relative w-[100px]">
            <input
              type="text"
              placeholder="Hash..."
              value={filterHash}
              onChange={(e) => setFilterHash(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/60 border border-white/6 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            Search
          </button>
          {(searchQuery || filterAuthor || filterHash) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-sm font-medium transition"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Main Dual-Column Panel */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        
        {/* Left Side: Commits list */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 bg-slate-950/40 border border-white/6 rounded-xl p-4 overflow-hidden">
          
          {/* Header count */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-white/5 pb-2">
            <span>{total} commits found</span>
            {totalPages > 1 && (
              <span>Page {currentPage} of {totalPages}</span>
            )}
          </div>

          {/* Commits Scroller */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-6 h-6 border-2 border-transparent border-t-indigo-500 border-r-indigo-500 rounded-full animate-spin" />
                <span className="text-xs text-slate-500">Loading commits from graph...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <AlertCircle className="w-8 h-8 text-rose-500 stroke-1.5" />
                <span className="text-sm text-slate-400 font-medium">{error}</span>
                <button
                  onClick={fetchHistory}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
                >
                  Retry Ingestion Query
                </button>
              </div>
            ) : commits.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <GitCommit className="w-8 h-8 text-slate-700 stroke-1" />
                <span className="text-sm text-slate-500">No commits match your filters.</span>
              </div>
            ) : (
              commits.map((commit) => {
                const isSelected = selectedCommit?.hash === commit.hash;
                return (
                  <div
                    key={commit.hash}
                    onClick={() => setSelectedCommit(commit)}
                    className={`flex flex-col gap-1.5 p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500/40 shadow-glow-indigo/10'
                        : 'bg-slate-900/30 border-white/4 hover:bg-slate-900/50 hover:border-white/8'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-[11px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-bold">
                        {commit.short_hash}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatDate(commit.timestamp)}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200 line-clamp-1">
                      {commit.message}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>{commit.author_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-500 flex items-center font-semibold text-[10px]">
                          <Plus className="w-3 h-3" />
                          {commit.insertions}
                        </span>
                        <span className="text-rose-500 flex items-center font-semibold text-[10px]">
                          <Minus className="w-3 h-3" />
                          {commit.deletions}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/80 border border-white/6 hover:bg-slate-900 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={offset + limit >= total}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/80 border border-white/6 hover:bg-slate-900 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Commit Detail Inspector */}
        <div className="w-[380px] flex flex-col bg-slate-950/40 border border-white/6 rounded-xl overflow-hidden">
          {selectedCommit ? (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Detail Header */}
              <div className="p-4 border-b border-white/5 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 letter-spacing-[0.05em]">Commit Details</span>
                <h2 className="text-base font-bold text-slate-100 leading-snug">
                  {selectedCommit.message}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-bold">
                    {selectedCommit.short_hash}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 truncate" title={selectedCommit.hash}>
                    {selectedCommit.hash}
                  </span>
                </div>
              </div>

              {/* Detail Metadata body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Author Info */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Author</span>
                  <div className="text-xs text-slate-300">
                    <div className="font-medium text-slate-200">{selectedCommit.author_name}</div>
                    <div className="text-slate-500 font-mono mt-0.5">{selectedCommit.author_email}</div>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Date</span>
                  <div className="text-xs text-slate-300">
                    {formatDate(selectedCommit.timestamp)}
                  </div>
                </div>

                {/* Change Counts */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Net Impact</span>
                  <div className="flex items-center gap-4 text-xs font-semibold mt-1">
                    <span className="text-emerald-500 flex items-center bg-emerald-500/10 px-2 py-1 rounded">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {selectedCommit.insertions} insertions
                    </span>
                    <span className="text-rose-500 flex items-center bg-rose-500/10 px-2 py-1 rounded">
                      <Minus className="w-3.5 h-3.5 mr-1" />
                      {selectedCommit.deletions} deletions
                    </span>
                  </div>
                </div>

                {/* Changed Files list */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Changed Files ({selectedCommit.changed_files.length})
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1">
                    {selectedCommit.changed_files.length === 0 ? (
                      <span className="text-xs text-slate-600">No file modification statistics recorded.</span>
                    ) : (
                      selectedCommit.changed_files.map((file) => {
                        let statusColor = 'text-slate-400 bg-slate-500/10';
                        if (file.change_type === 'added') statusColor = 'text-emerald-400 bg-emerald-500/10';
                        if (file.change_type === 'deleted') statusColor = 'text-rose-400 bg-rose-500/10';
                        if (file.change_type === 'modified') statusColor = 'text-amber-400 bg-amber-500/10';
                        if (file.change_type === 'renamed') statusColor = 'text-blue-400 bg-blue-500/10';

                        return (
                          <div
                            key={file.path}
                            className="flex items-center justify-between gap-3 p-2 bg-slate-900/30 border border-white/4 rounded-lg text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span className="font-mono text-slate-300 truncate" title={file.path}>
                                {file.path.split('/').pop()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${statusColor}`}>
                                {file.change_type}
                              </span>
                              {(file.insertions > 0 || file.deletions > 0) && (
                                <span className="text-slate-500 font-mono text-[10px]">
                                  +{file.insertions} -{file.deletions}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons (Disabled for Phase 12) */}
              <div className="p-4 border-t border-white/5 bg-slate-950/60 flex items-center gap-2 mt-auto">
                <button
                  disabled
                  className="flex-1 py-2 bg-slate-800 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition"
                >
                  View Diff
                </button>
                <button
                  disabled
                  className="flex-1 py-2 bg-slate-800 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition"
                >
                  Explore Impact
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <GitCommit className="w-10 h-10 text-slate-700 stroke-1 mb-2 animate-pulse" />
              <span className="text-xs text-slate-500">Select a commit to view details.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CommitHistory;
