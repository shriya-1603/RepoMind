import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Sparkles, Send, FileCode,
  Bot, User, Loader2, BookOpen, ExternalLink, GitBranch,
} from 'lucide-react';
import { mockSearchResults, mockSemanticAnswers } from '../data/mockRepositoryData';
import { useSemanticSearchReal } from '../hooks/useSemanticSearchReal';
import { useRepo } from '../contexts/RepoContext';
import { getSemanticSearchReal } from '../services/repoApi';
import type { SemanticSearchResult } from '../services/repoApi';
import { trackSearch } from '../services/observability';

// ── Suggested Queries ─────────────────────────────────────────────────────
const SUGGESTED_QUERIES = [
  'How are auth tokens validated?',
  'Where is rate limiting implemented?',
  'How does the graph layout work?',
  'What manages global user state?',
  'Which files handle API errors?',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  loading?: boolean;
}

const typeNodeColors: Record<string, string> = {
  component: '#FF6F61', hook: '#DAA520', util: '#F5E8D8',
  type: '#FF4500', context: '#FF8C00', api: '#FFA500', page: '#FFA07A',
};

const mapMockSearchResult = (result: {
  file: string;
  path: string;
  relevance: number;
  explanation: string;
  lineRange: [number, number];
  type: string;
}): SemanticSearchResult => ({
  type: result.type,
  name: result.file,
  filePath: result.path,
  lineNumber: result.lineRange?.[0] ?? null,
  score: Math.min(1, Math.max(0, result.relevance / 100)),
  reason: result.explanation,
});

// ── Relevance Bar ─────────────────────────────────────────────────────────
const RelevanceBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6 }}
        className="h-full rounded-full"
        style={{
          background: value >= 90 ? '#DAA520' : value >= 70 ? '#FF6F61' : '#FF4500',
        }}
      />
    </div>
    <span className="text-[9px] font-mono text-slate-500">{value}% match</span>
  </div>
);

// ── Streaming Text Hook ───────────────────────────────────────────────────
const useStreamText = (text: string, speed = 8, active = true) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayedText(text);
      return;
    }
    setDisplayedText('');
    setIsStreaming(true);
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < text.length) {
        setDisplayedText(prev => prev + text.charAt(idx));
        idx++;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
      }
    }, speed);
    return () => {
      clearInterval(interval);
      setIsStreaming(false);
    };
  }, [text, speed, active]);

  return { displayedText, isStreaming };
};

const FormattedAnswer: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="font-mono text-[#FFB347] bg-[#FFB347]/10 px-1.5 py-0.5 rounded text-[11px] border border-[#FFB347]/15">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="text-slate-100 font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// ── AI Message Bubble ──────────────────────────────────────────────────────
interface MessageBubbleProps {
  msg: Message;
  isLatestAssistant: boolean;
  onFollowUpClick: (query: string) => void;
}
const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, isLatestAssistant, onFollowUpClick }) => {
  const shouldStream = isLatestAssistant && msg.role === 'assistant' && !msg.loading && msg.id !== 'welcome';
  const { displayedText, isStreaming } = useStreamText(msg.content, 8, shouldStream);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
        msg.role === 'assistant'
          ? 'bg-gradient-to-br from-[#FF6B1A] to-[#FFB347]'
          : 'bg-gradient-to-br from-slate-700 to-slate-800'
      }`}>
        {msg.role === 'assistant' ? <Bot size={16} className="text-white" /> : <User size={14} className="text-white" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1.5 w-full`}>
        <div className={`rounded-2xl px-4 py-3.5 text-xs leading-relaxed w-full ${
          msg.role === 'user'
            ? 'bg-[#FF6B1A]/10 border border-[#FF6B1A]/35 text-slate-200 rounded-tr-sm'
            : 'bg-[#0E0E0E] border border-[#222222] rounded-tl-sm text-slate-300 font-light'
        }`}>
          {msg.loading ? (
            <div className="flex items-center gap-2 py-1">
              <Loader2 size={14} className="text-[#FF6B1A] animate-spin" />
              <span className="text-slate-500 text-xs font-mono">Analyzing codebase AST & semantic index...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Answer Pane */}
              <div className="whitespace-pre-wrap">
                <FormattedAnswer text={shouldStream ? displayedText : msg.content} />
                {shouldStream && isStreaming && (
                  <span className="text-[#FF6B1A] cursor-blink inline-block ml-0.5">▊</span>
                )}
              </div>

              {/* Sources Pane */}
              {msg.sources && msg.sources.length > 0 && !isStreaming && (
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">Sources</div>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map(src => (
                      <span key={src} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#131313] border border-[#222222] font-mono text-[10px] text-[#FFB347] hover:text-[#FF6B1A] hover:border-[#FF6B1A]/40 transition-colors cursor-pointer">
                        <FileCode size={10} />
                        {src.split('/').pop()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Components Pane */}
              {msg.sources && msg.sources.length > 0 && !isStreaming && (
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">Related Components</div>
                  <div className="grid grid-cols-2 gap-2">
                    {msg.sources.slice(0, 2).map((src, i) => {
                      const name = src.split('/').pop() || '';
                      return (
                        <div key={i} className="p-2 rounded-xl bg-[#131313] border border-[#222222] text-[10px] font-mono flex items-center justify-between">
                          <span className="text-slate-400 truncate max-w-[120px]">{name}</span>
                          <span className="badge badge-yellow text-[8px] flex-shrink-0">Active</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Suggested follow-up pills */}
        {msg.role === 'assistant' && !msg.loading && isLatestAssistant && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-1.5 mt-2 pl-0.5"
          >
            {['Where is this token refreshed?', 'Show me the test for this', 'What are the security implications?'].map(q => (
              <button
                key={q}
                onClick={() => onFollowUpClick(q)}
                className="text-[9px] font-semibold px-2.5 py-1 glass rounded-full border border-[#222222] bg-[#0E0E0E] text-[#FFB347] hover:text-[#FF6B1A] hover:border-[#FF6B1A]/30 transition-all active:scale-95 shadow-sm"
              >
                {q}
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// ── Semantic Search Page ───────────────────────────────────────────────────────────────────────

const SemanticSearch: React.FC = () => {
  const { analysisId, repoName } = useRepo();
  const activeRepoLabel = repoName ?? 'this repository';
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    return analysisId ? [] : [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm RepoMind's AI assistant. No repository has been imported yet.\n\nImport a repository from the **Dashboard** to start asking questions about its codebase.`,
      },
    ];
  });
  
  // Set search results to empty list initially when active analysisId exists to avoid mock data
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [expandedResultIdx, setExpandedResultIdx] = useState<number | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: semanticData, loading: isSearchingReal, warning: searchWarning, error: searchError } = useSemanticSearchReal(
    analysisId ?? '',
    searchTerm,
    repoName ?? '',
  );

  useEffect(() => {
    if (analysisId) {
      if (semanticData && semanticData.source === 'neo4j') {
        setSearchResults(semanticData.results || []);
      } else {
        setSearchResults([]);
      }
    } else {
      if (semanticData?.results) {
        setSearchResults(semanticData.results);
      }
    }
  }, [semanticData, analysisId]);

  const semanticSource = analysisId ? (semanticData?.source ?? 'neo4j') : (semanticData?.source ?? 'mock');
  const isLoading = isSearching || isSearchingReal;

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    const trimmed = q.trim();
    setQuery('');
    setSearchTerm(trimmed);

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const loadingMsg: Message = { id: `l-${Date.now()}`, role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsSearching(true);

    let answerContent = '';
    let sourcesList: string[] = [];

    const startTime = Date.now();

    if (analysisId) {
      try {
        const response = await getSemanticSearchReal(analysisId, trimmed);
        const durationMs = Date.now() - startTime;
        trackSearch(analysisId, repoName || 'unknown', durationMs, true);

        if (response.source === 'neo4j') {
          const results = response.results || [];
          setSearchResults(results);
          if (results.length > 0) {
            answerContent = `I found **${results.length}** matching results for query "${trimmed}" in this repository. Here are the most relevant files/functions:\n\n` +
              results.slice(0, 3).map(r => `- \`${r.name}\` (\`${r.filePath}\`): ${r.reason || 'No description available.'}`).join('\n');
            sourcesList = results.map(r => r.filePath).filter(Boolean);
          } else {
            answerContent = `I searched the codebase for "${trimmed}" but found no matching results. Please try another query.`;
          }
        } else {
          setSearchResults([]);
          answerContent = `Semantic search returned mock/unverified results for active analysisId. Disallowed in stabilization mode.`;
        }
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        trackSearch(analysisId, repoName || 'unknown', durationMs, false);
        console.error(err);
        answerContent = `Failed to perform semantic search on backend: ${err.message || 'Unknown error'}`;
      }
    } else {
      // Simulate AI response delay for demo
      await new Promise(r => setTimeout(r, 1600));
      const durationMs = Date.now() - startTime;
      trackSearch('', 'demo', durationMs, true);
      const answer = mockSemanticAnswers[0];
      answerContent = answer.answer;
      sourcesList = answer.sources;
      setSearchResults(mockSearchResults.default.map(mapMockSearchResult));
    }

    const responseMsg: Message = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: answerContent,
      sources: sourcesList,
    };

    setMessages(prev => [...prev.filter(m => !m.loading), responseMsg]);
    setIsSearching(false);

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] font-sans relative">
      {/* Scan line overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 opacity-[0.015]" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 6px 100%' }} />

      {/* No-repo empty state */}
      {!analysisId && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <GitBranch size={24} className="text-slate-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-300">No Repository Imported</div>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              Import a repository from the Dashboard to use Semantic Search.
            </p>
          </div>
        </div>
      )}

      {/* Main UI — only shown when analysisId exists */}
      {analysisId && (<>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/12 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B1A] to-[#FFB347] flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-200 text-sm font-[Syne]">Semantic Code Search</h1>
              <p className="text-xs text-slate-500">Ask anything about {activeRepoLabel} in natural language</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">89,234 chunks indexed</span>
          </div>
        </div>

        {/* Suggested Queries or initial page state */}
        {messages.length <= 1 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto space-y-6 text-center w-full">
            <div className="space-y-2">
              <h1 className="text-[40px] font-extrabold text-[#F5F5F5] font-[Syne] tracking-tight leading-none">
                Query Repository Memory
              </h1>
              <p className="text-[#A0A0A0] text-xs leading-relaxed max-w-md mx-auto">
                Ask questions about structures, endpoints, or data models in natural language.
              </p>
            </div>

            <div className="w-full space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-[#222222] px-4 py-3.5 focus-within:border-[#FF6B1A]/40 transition-all bg-[#0E0E0E] shadow-2xl">
                <Search size={18} className="text-slate-500 flex-shrink-0" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
                  placeholder="Ask RepoMind about the codebase..."
                  className="flex-1 bg-transparent text-sm text-[#F5F5F5] placeholder-slate-600 focus:outline-none font-sans"
                />
                <button
                  onClick={() => handleSearch(query)}
                  disabled={!query.trim() || isLoading}
                  className="px-4 py-2 rounded-xl bg-[#FF6B1A] hover:bg-[#FFB347] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Search
                </button>
              </div>

              <div className="pt-2">
                <p className="text-[10px] text-slate-600 mb-3 uppercase tracking-widest font-mono font-bold">Suggested queries</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUERIES.map(sq => (
                    <button
                      key={sq}
                      onClick={() => handleSearch(sq)}
                      className="text-xs px-3.5 py-2 rounded-xl border border-[#222222] bg-[#0E0E0E] text-[#A0A0A0] hover:text-[#F5F5F5] hover:border-[#FF6B1A]/40 transition-all font-medium active:scale-95"
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Chat Messages screen */
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => {
                const isLatestAssistant = idx === messages.length - 1 && msg.role === 'assistant';
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isLatestAssistant={isLatestAssistant}
                    onFollowUpClick={handleSearch}
                  />
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-white/12 bg-white/[0.02]">
              <div className="flex items-center gap-3 glass rounded-2xl border border-[#222222] px-4 py-3 focus-within:border-[#FF6B1A]/40 transition-all bg-[#0E0E0E]">
                <Search size={16} className="text-slate-500 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
                  placeholder="Ask anything about the codebase..."
                  className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-600 focus:outline-none font-sans"
                />
                <motion.button
                  onClick={() => handleSearch(query)}
                  disabled={!query.trim() || isLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 rounded-xl bg-[#FF6B1A] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {isLoading ? <Loader2 size={14} className="text-white animate-spin" /> : <Send size={14} className="text-white" />}
                </motion.button>
              </div>
              <p className="text-[10px] text-slate-700 mt-2 text-center font-mono">
                AI answers are dynamically generated based on AST indices and semantic knowledge.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Results Sidebar */}
      <motion.div
        initial={{ x: 360 }}
        animate={{ x: 0 }}
        className="w-80 glass border-l border-white/12 flex flex-col flex-shrink-0 overflow-hidden"
      >
        <div className="flex flex-col gap-2 px-4 py-4 border-b border-white/12 bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-[#DAA520] animate-pulse" />
              <span className="text-xs font-semibold text-slate-355 font-[Syne]">Matching Chunks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-cyan text-[10px] font-semibold">{searchResults.length} results</span>
              <span className={`badge text-[10px] font-semibold ${semanticSource === 'neo4j' ? 'badge-emerald' : 'badge-slate'}`}>
                {semanticSource === 'neo4j' ? 'Neo4j' : 'Mock'}
              </span>
            </div>
          </div>
          {(searchWarning || searchError) && (
            <div className="text-[10px] text-slate-400 font-mono">
              {searchWarning || searchError}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-white/[0.02]">
          {searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <Search size={20} className="text-slate-750 mb-2" />
              <div className="text-xs text-slate-500 font-mono">No matching results loaded.</div>
              <div className="text-[10px] text-slate-600 font-mono mt-1">Enter a query to search.</div>
            </div>
          )}
          <AnimatePresence>
            {searchResults.map((result, i) => {
              const color = typeNodeColors[result.type] ?? '#818cf8';
              const isExpanded = expandedResultIdx === i;
              
              const scoreValue = Math.round(result.score * 100);
              const circ = 2 * Math.PI * 6;
              const strokeDash = (scoreValue / 100) * circ;
              const strokeColor = scoreValue >= 90 ? '#DAA520' : scoreValue >= 70 ? '#FF6F61' : '#FF4500';

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="glass rounded-xl p-3.5 border border-white/12 hover:border-white/20 transition-all cursor-pointer group bg-white/[0.01]"
                >
                  {/* File header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
                      <span className="text-[11px] font-mono font-semibold text-slate-300 group-hover:text-white transition-colors truncate max-w-[170px]">
                        {result.name || result.filePath}
                      </span>
                    </div>
                    <ExternalLink size={11} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
                  </div>

                  {/* Upgraded Relevance + Confidence Radial */}
                  <div className="flex items-center gap-2 mb-3">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 -rotate-90 flex-shrink-0">
                      <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
                      <motion.circle
                        cx="8" cy="8" r="6" fill="none"
                        stroke={strokeColor} strokeWidth="1.5"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: circ - strokeDash }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        style={{ filter: `drop-shadow(0 0 2px ${strokeColor}40)` }}
                      />
                    </svg>
                    <div className="flex-1">
                      <RelevanceBar value={scoreValue} />
                    </div>
                  </div>

                  {/* Expandable Reason Card */}
                  <div
                    onClick={() => setExpandedResultIdx(isExpanded ? null : i)}
                    className="mt-2.5 glass rounded-lg p-2.5 font-mono text-[9px] text-slate-400 overflow-hidden cursor-pointer hover:border-white/15 transition-colors bg-black/30 border border-white/12 select-none"
                  >
                    <motion.pre
                      initial={false}
                      animate={{ height: isExpanded ? 'auto' : '64px' }}
                      className="leading-relaxed whitespace-pre-wrap break-all overflow-hidden"
                    >
                      {result.reason}
                    </motion.pre>
                    <div className="text-[8px] text-[#FF6F61] font-mono mt-1 text-right uppercase tracking-wider font-semibold">
                      {isExpanded ? '▲ Click to collapse' : '▼ Click to expand explanation'}
                    </div>
                  </div>

                  {/* Lines */}
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/12">
                    <span className="text-[9px] font-mono text-slate-650 truncate max-w-[140px]">{result.filePath}</span>
                    <span className="text-[9px] font-mono text-slate-550 flex-shrink-0 font-bold">
                      {result.lineNumber !== null ? `L${result.lineNumber}` : 'Line ?'}
                    </span>
                  </div>

                  <p className="mt-2 text-[10px] text-slate-500 leading-relaxed font-light line-clamp-2 italic">
                    {result.type.toUpperCase()} match with {scoreValue}% confidence.
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
      </>)}
    </div>
  );
};

export default SemanticSearch;
