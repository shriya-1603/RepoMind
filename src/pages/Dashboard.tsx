import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode, Activity, TrendingUp, Zap, Layers, RefreshCw,
  CheckCircle, Search, Loader2, GitBranch, BarChart3, Shield,
  Bot, ArrowRight, ExternalLink, AlertTriangle, Info,
  Users, Clock, GitCommit, ChevronRight, X,
  Code2, CalendarDays, Cpu, Workflow, BookOpen,
  Lightbulb, Puzzle, Globe, Sparkles, ChevronDown, ChevronUp,
  Target, Map,
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import ImportRepoModal from '../components/ImportRepoModal';
import { useRepo } from '../contexts/RepoContext';
import {
  getRepositorySummaryReal,
  getGraphReal,
  getRepositoryActivity,
} from '../services/repoApi';
import type {
  RepositorySummaryRealData,
  RealGraphResponse,
  RealGraphNode,
  RepositoryActivityData,
  Contributor,
  RecentCommit,
  RepositoryIntelligence,
} from '../services/repoApi';
import {
  trackDashboardLoad,
  trackSummaryFetch,
  trackGraphFetch,
  trackActivityFetch,
  trackContributorPanelOpen,
} from '../services/observability';
import { useRepositoryActivityReal as _useRepositoryActivityReal } from '../hooks/useRepositoryActivityReal';
// Re-export so callers outside Dashboard can use the hook directly
export { useRepositoryActivityReal } from '../hooks/useRepositoryActivityReal';

// ── Metric helpers ────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Deterministic health score derived from real backend data. */
function computeHealthScore(
  summary: RepositorySummaryRealData,
  graphData: RealGraphResponse,
): { score: number; breakdown: { label: string; penalty: number; color: string }[] } {
  const nodes = graphData.nodes.length;
  const edges = graphData.edges.length;

  const ed = nodes > 1 ? edges / (nodes * (nodes - 1)) : 0;
  const complexityPenalty = clamp(ed * 40, 0, 30);

  const topHotspots = summary.mostDependedOnFiles.slice(0, 3);
  const avgCriticality = topHotspots.length
    ? topHotspots.reduce((s, h) => s + h.criticality, 0) / topHotspots.length
    : 0;
  const hotspotPenalty = clamp(avgCriticality * 20, 0, 20);

  const lowCoveragePenalty = 0;

  const riskPenalty = clamp(summary.overallRiskScore / 2, 0, 30);

  const score = Math.max(0, Math.round(100 - complexityPenalty - hotspotPenalty - lowCoveragePenalty - riskPenalty));

  return {
    score,
    breakdown: [
      { label: 'Complexity', penalty: Math.round(complexityPenalty), color: '#FF6B1A' },
      { label: 'Hotspots',   penalty: Math.round(hotspotPenalty),    color: '#FFB347' },
      { label: 'Coverage',   penalty: Math.round(lowCoveragePenalty), color: '#FFB347' },
      { label: 'Risk',       penalty: Math.round(riskPenalty),        color: '#FF6B1A' },
    ],
  };
}

/** Deterministic graph complexity label. */
function computeGraphComplexity(
  summary: RepositorySummaryRealData,
  graphData: RealGraphResponse,
): { label: 'Low' | 'Moderate' | 'High'; score: number; color: string } {
  const nodes = graphData.nodes.length;
  const edges = graphData.edges.length;
  const parsedFiles = Math.max(summary.totalFiles, 1);

  const score =
    nodes * 0.3 +
    edges * 0.4 +
    summary.totalImports * 0.2 +
    (summary.totalFunctions / parsedFiles) * 0.1;

  if (score < 30)  return { label: 'Low',      score, color: '#FFB347' };
  if (score < 70)  return { label: 'Moderate', score, color: '#FF6B1A' };
  return            { label: 'High',     score, color: '#FF6B1A' };
}

/** Rank hotspot nodes from real graph: incomingEdges + outgoingEdges + functionCount + importCount. */
function computeHotspots(graphData: RealGraphResponse): {
  node: RealGraphNode;
  score: number;
  incoming: number;
  outgoing: number;
}[] {
  const incoming: Record<string, number> = {};
  const outgoing: Record<string, number> = {};

  for (const edge of graphData.edges) {
    outgoing[edge.source] = (outgoing[edge.source] ?? 0) + 1;
    incoming[edge.target] = (incoming[edge.target] ?? 0) + 1;
  }

  return graphData.nodes
    .filter(n => n.type === 'file' || n.type === 'function' || n.type === 'class')
    .map(node => {
      const inc = incoming[node.id] ?? 0;
      const out = outgoing[node.id] ?? 0;
      const fns = node.metadata?.functions_count ?? 0;
      const imp = node.metadata?.imports_count ?? 0;
      const score = inc + out + (fns as number) + (imp as number);
      return { node, score, incoming: inc, outgoing: out };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/** Fallback: group graph nodes by top-level directory to infer modules. */
function computeModulesFromGraph(graphData: RealGraphResponse): { name: string; fileCount: number }[] {
  const dirs: Record<string, number> = {};
  for (const node of graphData.nodes) {
    const p = node.metadata?.rel_path ?? node.metadata?.path ?? '';
    if (typeof p === 'string' && p) {
      const parts = p.split('/');
      const dir = parts.length > 1 ? parts[0] : '(root)';
      dirs[dir] = (dirs[dir] ?? 0) + 1;
    }
  }
  return Object.entries(dirs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, fileCount]) => ({ name, fileCount }));
}

// ── Utility helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return iso.slice(0, 10);
  }
}

function avatarColor(name: string): string {
  const colors = [
    '#FF6B1A', '#FFB347', '#FFB347', '#F5E8D8',
    '#FF6B1A', '#FF3E3E', '#D48C2B', '#FF8C00',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Small UI primitives ───────────────────────────────────────────────────

const StatPill: React.FC<{
  label: string;
  value: string | number;
  color: string;
  icon: React.ComponentType<any>;
  delay?: number;
}> = ({ label, value, color, icon: Icon, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="flex flex-col gap-1 p-4 rounded-2xl border border-[#222222] bg-[#0E0E0E]"
  >
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">{label}</span>
    </div>
    <div className="text-xl font-bold text-slate-100 font-mono leading-none">{value}</div>
  </motion.div>
);

const HealthDonut: React.FC<{
  score: number;
  breakdown: { label: string; penalty: number; color: string }[];
}> = ({ score, breakdown }) => {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#4ADE80' : score >= 45 ? '#FFB347' : '#FF6B1A';

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <motion.circle
            cx="40" cy="40" r={r} fill="none" stroke={color}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-100 font-mono leading-none">{score}</span>
          <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">Health</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {breakdown.map((b, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
            <span className="text-slate-400 w-20">{b.label}</span>
            <span className="text-slate-300 font-bold">-{b.penalty}pts</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5 border-t border-white/12 pt-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-slate-400 w-20">Final</span>
          <span className="font-bold" style={{ color }}>{score}/100</span>
        </div>
      </div>
    </div>
  );
};

// ── EMPTY STATE ───────────────────────────────────────────────────────────

const EXAMPLE_REPOS = [
  { label: 'Flask',   url: 'https://github.com/pallets/flask' },
  { label: 'React',   url: 'https://github.com/facebook/react' },
  { label: 'FastAPI', url: 'https://github.com/tiangolo/fastapi' },
];

const CAPABILITY_CARDS = [
  {
    icon: GitBranch,
    title: 'Visualize Code Graph',
    desc: 'Explore files, functions, and imports as an interactive dependency graph.',
    color: '#FF6B1A',
  },
  {
    icon: Search,
    title: 'Search the Codebase',
    desc: 'Ask questions in natural language and locate relevant code instantly.',
    color: '#FFB347',
  },
  {
    icon: Zap,
    title: 'Analyze Change Impact',
    desc: 'Understand what breaks before you refactor. Simulate blast radius.',
    color: '#FF3E3E',
  },
  {
    icon: Bot,
    title: 'Generate Onboarding Guide',
    desc: 'AI-generated step-by-step tour of any codebase for new contributors.',
    color: '#FFB347',
  },
];

const EmptyDashboard: React.FC = () => {
  const { startAnalysis, isAnalyzing, errorMessage } = useRepo();
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || isAnalyzing) return;
    await startAnalysis(trimmed);
  }, [url, isAnalyzing, startAnalysis]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const handleExample = (exampleUrl: string) => {
    setUrl(exampleUrl);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-full p-6 md:p-10 flex flex-col items-center justify-start gap-10 max-w-4xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-mono text-[#FFB347]"
          style={{ background: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.2)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A] animate-pulse" />
          Code Intelligence Engine Ready
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-3 font-[Syne] leading-tight">
          Understand any repository<br />
          <span className="gradient-text-aurora">in seconds</span>
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-lg mx-auto">
          Paste a public GitHub repository URL to generate a code intelligence graph —
          visualize dependencies, search semantically, and analyze change impact.
        </p>
      </motion.div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="w-full max-w-2xl"
      >
        <GlassCard padding="lg" className="border-[#FF6B1A]/20">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <Search size={16} />
              </div>
              <input
                ref={inputRef}
                id="repo-url-input"
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://github.com/owner/repository"
                disabled={isAnalyzing}
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 bg-white/[0.03] border border-white/15 focus:outline-none focus:border-[#FF6B1A]/60 focus:bg-white/[0.05] transition-all disabled:opacity-50"
              />
            </div>

            <button
              id="analyze-repo-btn"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !url.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#FF6B1A] to-[#FFB347] hover:from-[#FFB347] hover:to-[#FFB347] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
              style={{ boxShadow: '0 0 20px rgba(255,69,0,0.3)' }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Analyzing repository...
                </>
              ) : (
                <>
                  <ArrowRight size={15} />
                  Analyze Repository
                </>
              )}
            </button>

            {errorMessage && (
              <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                {errorMessage}
              </div>
            )}

            {/* Example repos */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">Examples:</span>
              {EXAMPLE_REPOS.map(ex => (
                <button
                  key={ex.label}
                  onClick={() => handleExample(ex.url)}
                  disabled={isAnalyzing}
                  className="text-[11px] px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Capability cards */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CAPABILITY_CARDS.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.08, duration: 0.35 }}
          >
            <GlassCard hover className="h-full border-white/15">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${card.color}15`, border: `1px solid ${card.color}25` }}
                >
                  <card.icon size={16} style={{ color: card.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">{card.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ── CONTRIBUTOR SIDE PANEL ────────────────────────────────────────────────

const ContributorPanel: React.FC<{
  contributor: Contributor;
  allCommits: RecentCommit[];
  onClose: () => void;
}> = ({ contributor, allCommits, onClose }) => {
  const color = avatarColor(contributor.name);

  // Filter commits by this contributor (match on authorEmail or authorName)
  const myCommits = useMemo(() =>
    allCommits.filter(
      c => c.authorEmail === contributor.email || c.authorName === contributor.name,
    ),
    [allCommits, contributor.email, contributor.name],
  );

  return (
    <motion.div
      key="contributor-panel"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed right-0 top-0 h-full w-full max-w-sm z-50 overflow-y-auto"
      style={{
        background: 'rgba(0,0,0,0.98)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)' }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: `${color}cc` }}
        >
          {initials(contributor.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100 truncate">{contributor.name}</div>
          <div className="text-[10px] text-slate-500 font-mono truncate">{contributor.email}</div>
        </div>
        <button
          id="contributor-panel-close"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12 text-center">
            <div className="text-xl font-bold text-slate-100 font-mono">{contributor.commitCount}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Commits</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12 text-center">
            <div className="text-xl font-bold text-slate-100 font-mono">{contributor.filesTouched.length}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Files</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12 text-center">
            <div className="text-xl font-bold text-slate-100 font-mono">
              {contributor.filesTouched.length > 0
                ? Math.round(
                    (contributor.filesTouched.reduce((s, f) => s + f.ownershipScore, 0) /
                      contributor.filesTouched.length) * 100,
                  )
                : 0}%
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Avg Own.</div>
          </div>
        </div>

        {/* Last active */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CalendarDays size={12} className="text-slate-600" />
          Last active: <span className="text-slate-300 font-mono">{formatDate(contributor.lastActiveDate)}</span>
        </div>

        {/* Primary areas */}
        {contributor.primaryAreas.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">Primary Areas</div>
            <div className="flex flex-wrap gap-1.5">
              {contributor.primaryAreas.map(area => (
                <span key={area} className="text-[10px] px-2 py-0.5 rounded-md font-mono text-[#FFB347]"
                  style={{ background: 'rgba(255, 69, 0, 0.12)', border: '1px solid rgba(255, 69, 0, 0.22)' }}>
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent commits by this contributor */}
        {myCommits.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
              <GitCommit size={10} /> Recent Commits
            </div>
            <div className="space-y-1.5">
              {myCommits.slice(0, 10).map((commit, i) => (
                <motion.div
                  key={commit.sha}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i }}
                  className="p-2.5 rounded-lg bg-white/[0.03] border border-white/12"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[11px] text-slate-300 leading-snug flex-1 min-w-0">
                      {commit.message}
                    </span>
                    <span className="text-[9px] font-mono text-slate-700 flex-shrink-0">
                      {commit.sha.slice(0, 7)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-slate-600">
                    <span>{timeAgo(commit.date)}</span>
                    {commit.filesChanged.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{commit.filesChanged.length} file{commit.filesChanged.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Files touched */}
        {contributor.filesTouched.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">Files & Ownership</div>
            <div className="space-y-1.5">
              {contributor.filesTouched.slice(0, 15).map((ft, i) => {
                const fileName = ft.path.split('/').pop() ?? ft.path;
                const ownerPct = Math.round(ft.ownershipScore * 100);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className="p-2.5 rounded-lg bg-white/[0.03] border border-white/12"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-slate-300 truncate max-w-[160px]" title={ft.path}>
                        {fileName}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600 flex-shrink-0 ml-2">
                        {ft.commitCount} commits
                      </span>
                    </div>
                    {/* Ownership bar */}
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${ownerPct}%` }}
                        transition={{ duration: 0.6, delay: 0.04 * i }}
                        className="h-full rounded-full"
                        style={{ background: `${color}cc` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-600">
                      <span>Ownership: {ownerPct}%</span>
                      <span>{formatDate(ft.lastTouched)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};


// ── AI TECHNICAL BRIEFING COMPONENT ──────────────────────────────────────

const BriefingSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: string;
}> = ({ icon, title, children, accent = '#FF6B1A' }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span style={{ color: accent }}>{icon}</span>
      <h4 className="text-[11px] uppercase tracking-widest font-mono font-bold text-[#A0A0A0]">{title}</h4>
    </div>
    {children}
  </div>
);

const EvidenceToggler: React.FC<{ evidence: string[] }> = ({ evidence }) => {
  const [showEvidence, setShowEvidence] = useState(false);
  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setShowEvidence(!showEvidence)}
        className="text-[10px] font-mono text-[#FF6B1A] hover:underline flex items-center gap-1 font-semibold"
      >
        {showEvidence ? '▾ Evidence' : '▸ Evidence'}
      </button>
      <AnimatePresence>
        {showEvidence && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full flex flex-wrap gap-1.5 items-center mt-1.5 bg-[#070707] p-2 rounded-lg border border-[#1A1A1A]"
          >
            <span className="text-[8.5px] text-[#666666] font-mono uppercase tracking-wider">Concrete Signals:</span>
            {evidence.map((ev, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[8.5px] font-mono text-[#AAAAAA] bg-[#111111] border border-[#222222]"
              >
                {ev}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AITechnicalBriefing: React.FC<{ briefing: RepositoryIntelligence }> = ({ briefing }) => {
  const [showAllDecisions, setShowAllDecisions] = useState(false);
  const [showAllIntegrations, setShowAllIntegrations] = useState(false);
  const [showAllObservations, setShowAllObservations] = useState(false);

  const getConfidenceLabel = (pct: number) => {
    if (pct >= 80) return 'High';
    if (pct >= 50) return 'Medium';
    return 'Low';
  };

  const isUnknownDomain = briefing.domain?.domain === 'Unknown';
  const confidencePct = Math.round(briefing.domain?.confidence ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-[#222222] bg-[#0A0A0A] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bot size={16} className="text-[#FF6B1A]" />
          <h3 className="font-semibold text-[#F5F5F5] text-[17px]">Repository Intelligence</h3>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/20 uppercase tracking-wider">
            AI Analysis
          </span>
        </div>
        {briefing.domain && (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1A1A1A] border border-[#2A2A2A]">
              <Cpu size={10} className={isUnknownDomain ? 'text-[#888888]' : 'text-[#FFB347]'} />
              <span className={`text-[10px] font-mono font-semibold ${isUnknownDomain ? 'text-[#888888]' : 'text-[#FFB347]'}`}>
                {isUnknownDomain ? 'Unknown Domain' : briefing.domain.domain}
              </span>
            </div>
            {!isUnknownDomain && (
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#A0A0A0] font-mono font-bold">
                <span>{getConfidenceLabel(confidencePct)} Confidence</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 space-y-8">

        {/* ── 1. Project Purpose ─────────────────────────────────────────── */}
        {briefing.projectPurpose && (
          <BriefingSection icon={<Target size={13} />} title="What Is This Project">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] text-[#C8C8C8] leading-relaxed font-light flex-1">
                  {briefing.projectPurpose.description}
                </p>
                {!isUnknownDomain && typeof briefing.projectPurpose.confidence === 'number' && (
                  <div className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/20">
                    {getConfidenceLabel(briefing.projectPurpose.confidence)} Confidence
                  </div>
                )}
              </div>
              {!isUnknownDomain && <EvidenceToggler evidence={briefing.projectPurpose.evidence} />}
            </div>
          </BriefingSection>
        )}

        {/* ── 2. Execution Flow ──────────────────────────────────────────── */}
        {briefing.executionFlow?.length > 0 && briefing.workflowReconstructed ? (
          <BriefingSection icon={<Workflow size={13} />} title="Execution Flow Reconstructed" accent="#FFB347">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11px] text-[#888888] font-mono">
                <span>Call flow paths mapped from AST dependency graph</span>
                {typeof briefing.workflowConfidence === 'number' && (
                  <span className="text-[#FFB347] font-semibold">{getConfidenceLabel(briefing.workflowConfidence)} Confidence</span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {briefing.executionFlow.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#0E0E0E] border border-[#1A1A1A]">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FFB347]/10 border border-[#FFB347]/20 flex items-center justify-center text-[9px] font-mono text-[#FFB347] font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#E0E0E0] font-mono leading-relaxed">{step.step}</p>
                      <EvidenceToggler evidence={step.evidence} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BriefingSection>
        ) : (
          <BriefingSection icon={<Workflow size={13} />} title="Execution Flow Reconstructed" accent="#FFB347">
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#1E1E1E] text-[12px] text-[#BBBBBB] leading-relaxed italic">
              This repository contains multiple independent execution paths. A single linear workflow could not be confidently reconstructed.
            </div>
          </BriefingSection>
        )}

        {/* ── 3. Reading Guide / Start Here ─────────────────────────────── */}
        {briefing.startHere?.length > 0 && (
          <BriefingSection icon={<BookOpen size={13} />} title="Start Here — Reading Guide" accent="#34D399">
            <div className="space-y-3">
              <div className="text-[11px] text-[#888888] font-mono flex items-center justify-between">
                <span>Estimated onboarding time: <span className="text-[#34D399] font-bold">{briefing.estimatedOnboardingMinutes} minutes</span></span>
                {briefing.estimatedUnderstandingPct && (
                  <span>Target understanding: <span className="text-[#34D399] font-bold">~{briefing.estimatedUnderstandingPct}%</span></span>
                )}
              </div>
              <div className="space-y-2.5">
                {briefing.startHere.map((item, i) => {
                  const callChain = item.callChain;
                  return (
                    <div key={i} className="p-3.5 rounded-xl bg-[#0E0E0E] border border-[#1A1A1A] hover:border-[#252525] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-md bg-[#34D399]/10 border border-[#34D399]/20 flex items-center justify-center">
                          <span className="text-[10px] font-mono font-bold text-[#34D399]">{item.order}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[12px] font-mono font-semibold text-[#E0E0E0]">{item.file}</span>
                            <span className="text-[9.5px] font-mono text-[#555555]">{item.path}</span>
                          </div>
                          <p className="text-[11.5px] text-[#999999] leading-relaxed mb-2">{item.reason}</p>
                          
                          {callChain && callChain.length > 0 && (
                            <div className="mt-2 bg-[#080808] p-2 rounded border border-[#161616]">
                              <div className="text-[9px] text-[#555555] font-mono uppercase mb-1.5 tracking-wider">Key Call Chains:</div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {callChain.map((call, j) => (
                                  <React.Fragment key={j}>
                                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-[#111111] text-[#34D399] border border-[#34D399]/10">
                                      {call}
                                    </span>
                                    {j < callChain.length - 1 && (
                                      <ArrowRight size={10} className="text-[#333333]" />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </BriefingSection>
        )}

        {/* ── 4. Repository Layers ────────────────────────────────────────── */}
        {briefing.repositoryLayers?.length > 0 && (
          <BriefingSection icon={<Layers size={13} />} title="Repository Architecture Layers" accent="#60A5FA">
            <div className="grid sm:grid-cols-2 gap-3">
              {briefing.repositoryLayers.map((layer, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-[#0E0E0E] border border-[#1A1A1A] hover:border-[#222] transition-colors">
                  <div className="text-[12px] font-semibold text-[#E8E8E8] mb-1">{layer.name}</div>
                  <p className="text-[11px] text-[#888888] leading-relaxed mb-3">{layer.description}</p>
                  {layer.components?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {layer.components.map((comp, j) => (
                        <span key={j} className="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#60A5FA] bg-[#60A5FA]/5 border border-[#60A5FA]/10">
                          {comp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </BriefingSection>
        )}

        {/* ── 5. Architectural Decisions ─────────────────────────────────── */}
        {briefing.architecture?.length > 0 && (
          <BriefingSection icon={<Lightbulb size={13} />} title="Architectural Decisions & Patterns" accent="#FBBF24">
            <div className="space-y-2">
              {(showAllDecisions ? briefing.architecture : briefing.architecture.slice(0, 3)).map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A]">
                  <div className="text-[12px] font-semibold text-[#E8E8E8] mb-1">{item.title}</div>
                  <p className="text-[11.5px] text-[#999999] leading-relaxed">{item.description}</p>
                  <EvidenceToggler evidence={item.evidence} />
                </div>
              ))}
              {briefing.architecture.length > 3 && (
                <button
                  onClick={() => setShowAllDecisions(v => !v)}
                  className="flex items-center gap-1 text-[10px] font-mono text-[#666666] hover:text-[#FF6B1A] transition-colors mt-1"
                >
                  {showAllDecisions ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {showAllDecisions ? 'Show less' : `Show ${briefing.architecture.length - 3} more`}
                </button>
              )}
            </div>
          </BriefingSection>
        )}

        {/* ── 6. Most Critical Files ──────────────────────────────────────── */}
        {briefing.criticalFiles?.length > 0 && (
          <BriefingSection icon={<Puzzle size={13} />} title="Most Critical Files (High Impact)" accent="#A78BFA">
            <div className="overflow-x-auto rounded-xl border border-[#1E1E1E] bg-[#0E0E0E]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E1E1E] bg-[#121212]/50 text-[9.5px] font-mono text-[#666666] uppercase tracking-wider">
                    <th className="p-3">File / Path</th>
                    <th className="p-3 text-center">Fan-In (Dependents)</th>
                    <th className="p-3 text-center">Affected Functions</th>
                    <th className="p-3 text-center">Affected Modules</th>
                  </tr>
                </thead>
                <tbody className="text-[11.5px] font-mono text-[#C0C0C0] divide-y divide-[#161616]">
                  {briefing.criticalFiles.map((file, i) => (
                    <tr key={i} className="hover:bg-[#151515]/30 transition-colors">
                      <td className="p-3 text-left">
                        <div className="font-semibold text-[#E8E8E8]">{file.name}</div>
                        <div className="text-[9.5px] text-[#555555] max-w-[400px] truncate">{file.path}</div>
                        {file.reason && (
                          <div className="text-[10.5px] text-[#888888] mt-1.5 italic font-sans">{file.reason}</div>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold text-[#A78BFA]">{file.fanIn}</td>
                      <td className="p-3 text-center">{file.affectedFunctions}</td>
                      <td className="p-3 text-center">{file.affectedModules}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BriefingSection>
        )}

        {/* ── 7. External Technologies ───────────────────────────────────── */}
        {briefing.integrations?.length > 0 && (
          <BriefingSection icon={<Globe size={13} />} title="External Technologies & Integrations" accent="#60A5FA">
            <div className="grid sm:grid-cols-2 gap-2">
              {(showAllIntegrations ? briefing.integrations : briefing.integrations.slice(0, 4)).map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#0E0E0E] border border-[#1A1A1A] flex flex-col justify-between">
                  <div>
                    <div className="text-[11.5px] font-semibold text-[#D0D0D0] mb-0.5">{item.title}</div>
                    <p className="text-[11px] text-[#777777] leading-relaxed">{item.description}</p>
                  </div>
                  <EvidenceToggler evidence={item.evidence} />
                </div>
              ))}
            </div>
            {briefing.integrations.length > 4 && (
              <button
                onClick={() => setShowAllIntegrations(v => !v)}
                className="flex items-center gap-1 text-[10px] font-mono text-[#666666] hover:text-[#FF6B1A] transition-colors mt-2"
              >
                {showAllIntegrations ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {showAllIntegrations ? 'Show less' : `Show ${briefing.integrations.length - 4} more`}
              </button>
            )}
          </BriefingSection>
        )}

        {/* ── 8. Complexity Summary ──────────────────────────────────────── */}
        {briefing.complexity && (
          <BriefingSection icon={<BarChart3 size={13} />} title="Complexity & Risk Assessment" accent="#F87171">
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#1E1E1E] border-l-2 border-l-[#F87171]/50">
              <div className="text-[12px] text-[#BBBBBB] leading-relaxed">
                {briefing.complexity.description}
              </div>
              <EvidenceToggler evidence={briefing.complexity.evidence} />
            </div>
          </BriefingSection>
        )}

        {/* ── 9. Domain Classification (v3 Card) ────────────────────────── */}
        {briefing.domain && (
          <BriefingSection icon={<Cpu size={13} />} title="Domain Classification" accent="#C084FC">
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-[#1E1E1E]">
              {isUnknownDomain ? (
                <div className="text-[12px] text-[#A0A0A0] italic">
                  We cannot confidently determine the application domain.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[14px] font-semibold text-[#E8E8E8]">{briefing.domain.domain}</span>
                    <span className="text-[11px] font-mono text-[#C084FC] font-semibold">
                      {getConfidenceLabel(briefing.domain.confidence)} Confidence
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1A1A1A] mb-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${briefing.domain.confidence}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-[#C084FC] to-[#A78BFA]"
                    />
                  </div>
                  {briefing.domain.evidence?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {briefing.domain.evidence.map((ev, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono text-[#888888] bg-[#111111] border border-[#1A1A1A]">
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </BriefingSection>
        )}

        {/* ── 10. Surprising Observations ─────────────────────────────────── */}
        {briefing.observations?.length > 0 && (
          <BriefingSection icon={<Sparkles size={13} />} title="Surprising Observations" accent="#FB923C">
            <div className="space-y-2">
              {(showAllObservations ? briefing.observations : briefing.observations.slice(0, 3)).map((item, i) => (
                <div key={i} className="p-3.5 bg-[#0D0D0D] rounded-xl border border-[#1E1E1E] hover:border-[#252525] transition-colors">
                  <div className="flex items-start gap-2.5 mb-1">
                    <Sparkles size={12} className="text-[#FB923C] flex-shrink-0 mt-0.5" />
                    <span className="text-[12.5px] font-semibold text-[#E8E8E8]">{item.title}</span>
                  </div>
                  <p className="text-[11.5px] text-[#999999] leading-relaxed">{item.description}</p>
                  <EvidenceToggler evidence={item.evidence} />
                </div>
              ))}
              {briefing.observations.length > 3 && (
                <button
                  onClick={() => setShowAllObservations(v => !v)}
                  className="flex items-center gap-1 text-[10px] font-mono text-[#666666] hover:text-[#FF6B1A] transition-colors mt-1"
                >
                  {showAllObservations ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {showAllObservations ? 'Show less' : `Show ${briefing.observations.length - 3} more`}
                </button>
              )}
            </div>
          </BriefingSection>
        )}

        {/* ── 11. Closing Sentence ───────────────────────────────────────── */}
        {briefing.closingSentence && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-[#FF6B1A]/5 to-transparent border border-[#FF6B1A]/15">
            <Map size={14} className="text-[#FF6B1A] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#CCCCCC] leading-relaxed italic">
              {briefing.closingSentence}
            </p>
          </div>
        )}

      </div>
    </motion.div>
  );
};

// ── LOADED STATE ──────────────────────────────────────────────────────────

const LoadedDashboard: React.FC = () => {
  const { analysisId, repoName, repoUrl, source, clearActiveRepository } = useRepo();
  const [summary, setSummary] = useState<RepositorySummaryRealData | null>(null);
  const [graphData, setGraphData] = useState<RealGraphResponse | null>(null);
  const [activity, setActivity] = useState<RepositoryActivityData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);
  const dashboardStartRef = useRef(Date.now());

  const fetchData = useCallback(async () => {
    if (!analysisId) return;
    setLoadingSummary(true);
    setLoadingGraph(true);
    setLoadingActivity(true);
    setFetchError(null);

    const summaryStart = Date.now();
    getRepositorySummaryReal(analysisId)
      .then(data => {
        setSummary(data);
        trackSummaryFetch(analysisId, repoName ?? '', Date.now() - summaryStart, true);
      })
      .catch(err => {
        trackSummaryFetch(analysisId, repoName ?? '', Date.now() - summaryStart, false);
        setFetchError(err.message ?? 'Failed to load summary');
      })
      .finally(() => setLoadingSummary(false));

    const graphStart = Date.now();
    getGraphReal(analysisId)
      .then(data => {
        setGraphData(data);
        trackGraphFetch(analysisId, repoName ?? '', Date.now() - graphStart, true);
      })
      .catch(_err => {
        trackGraphFetch(analysisId, repoName ?? '', Date.now() - graphStart, false);
      })
      .finally(() => setLoadingGraph(false));

    const activityStart = Date.now();
    getRepositoryActivity(analysisId)
      .then(data => {
        setActivity(data);
        trackActivityFetch(analysisId, repoName ?? '', Date.now() - activityStart, true);
      })
      .catch(_err => {
        trackActivityFetch(analysisId, repoName ?? '', Date.now() - activityStart, false);
        setActivity({ source: 'unavailable', overview: null, recentCommits: [], contributors: [] });
      })
      .finally(() => setLoadingActivity(false));
  }, [analysisId, repoName]);

  useEffect(() => {
    dashboardStartRef.current = Date.now();
    fetchData();
  }, [fetchData]);

  // Track dashboard load once all fetches complete
  useEffect(() => {
    if (!loadingSummary && !loadingGraph && !loadingActivity) {
      trackDashboardLoad(Date.now() - dashboardStartRef.current, !fetchError);
    }
  }, [loadingSummary, loadingGraph, loadingActivity, fetchError]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData().finally(() => setTimeout(() => setIsRefreshing(false), 800));
  };

  const handleContributorClick = (contributor: Contributor) => {
    setSelectedContributor(contributor);
    trackContributorPanelOpen(analysisId ?? '', repoName ?? '', contributor.name);
    // Observability: contributor panel open is tracked inside trackContributorPanelOpen
  };

  // Derived metrics
  const health = useMemo(
    () => summary && graphData ? computeHealthScore(summary, graphData) : null,
    [summary, graphData],
  );

  const complexity = useMemo(
    () => summary && graphData ? computeGraphComplexity(summary, graphData) : null,
    [summary, graphData],
  );

  const hotspots = useMemo(
    () => graphData ? computeHotspots(graphData) : [],
    [graphData],
  );

  const modules = useMemo(() => {
    if (!summary) return [];
    if (summary.majorModules && summary.majorModules.length > 0) return summary.majorModules;
    if (graphData) {
      return computeModulesFromGraph(graphData).map(m => ({
        name: m.name,
        path: m.name,
        fileCount: m.fileCount,
        functionCount: 0,
        classCount: 0,
        importCount: 0,
        description: `Directory inferred from graph (${m.fileCount} nodes)`,
      }));
    }
    return [];
  }, [summary, graphData]);

  const shortId = analysisId ? analysisId.slice(-8) : '';
  const isLoading = loadingSummary || loadingGraph;


  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Dominant Command Center Header */}
      <div className="p-8 rounded-2xl border border-[#222222] bg-[#0E0E0E] space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[40px] font-extrabold text-[#F5F5F5] font-[Syne] tracking-tight leading-none">
              {repoName ?? 'Repository Command Center'}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {repoUrl && (
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#A0A0A0] hover:text-[#FF6B1A] transition-colors flex items-center gap-1 font-mono"
                >
                  {repoUrl} <ExternalLink size={10} />
                </a>
              )}
              <span className={`badge ${source === 'neo4j' ? 'badge-green' : 'badge-indigo'} text-[10px]`}>
                {source === 'neo4j' ? 'Neo4j' : 'Mock'}
              </span>
              <span className="badge badge-indigo text-[10px] font-mono">id:{shortId}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleRefresh}
              whileTap={{ scale: 0.95 }}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-[#222222] bg-[#131313] text-[#A0A0A0] hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#FF6B1A]' : ''} />
            </motion.button>

            <motion.button
              onClick={() => setIsImportOpen(true)}
              whileHover={{ scale: 1.03 }}
              className="px-3.5 py-2 text-xs rounded-xl border border-[#222222] bg-[#131313] text-[#F5F5F5] hover:text-white transition-colors"
            >
              + Import New Repository
            </motion.button>

            <motion.button
              onClick={clearActiveRepository}
              whileHover={{ scale: 1.02 }}
              className="px-3 py-2 text-xs rounded-xl border border-[#222222] bg-[#131313] text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
              title="Clear active repository"
            >
              ✕ Clear
            </motion.button>
          </div>

          <ImportRepoModal
            open={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onSuccess={() => {
              setIsImportOpen(false);
              fetchData();
            }}
          />
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-[#222222]">
            <div className="space-y-1">
              <span className="text-[10px] text-[#A0A0A0] uppercase tracking-wider font-mono font-bold">Health Score</span>
              <div className="text-3xl font-black text-[#4ADE80] font-mono flex items-baseline gap-1.5">
                {isLoading ? '–' : (health?.score !== undefined && health?.score !== null ? health.score : 'Unavailable')}
                {!isLoading && health?.score !== undefined && health?.score !== null && (
                  <span className="text-[11px] text-[#A0A0A0] font-normal">/ 100</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-[#A0A0A0] uppercase tracking-wider font-mono font-bold">Risk Profile</span>
              <div className="text-3xl font-black text-[#FFB347] font-mono">
                {isLoading ? '–' : (summary ? (summary.overallRiskScore < 30 ? 'Low' : summary.overallRiskScore < 70 ? 'Medium' : 'High') : 'Unavailable')}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-[#A0A0A0] uppercase tracking-wider font-mono font-bold">Contributors</span>
              <div className="text-3xl font-black text-[#F5F5F5] font-mono">
                {loadingActivity
                  ? '–'
                  : activity?.overview?.activeContributors !== undefined && activity?.overview?.activeContributors !== null
                  ? activity.overview.activeContributors
                  : 'Unavailable'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-[#A0A0A0] uppercase tracking-wider font-mono font-bold">Commits</span>
              <div className="text-3xl font-black text-[#F5F5F5] font-mono">
                {loadingActivity
                  ? '–'
                  : activity?.overview?.totalCommits !== undefined && activity?.overview?.totalCommits !== null
                  ? activity.overview.totalCommits.toLocaleString()
                  : 'Unavailable'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Failed to load data</div>
            {fetchError}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !summary && (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-[#222222] bg-[#0E0E0E] gap-4">
          <Loader2 size={36} className="text-[#FF6B1A] animate-spin" />
          <div className="text-center">
            <h3 className="text-sm font-semibold text-[#F5F5F5]">Loading repository data…</h3>
            <p className="text-xs text-[#A0A0A0] mt-1">Fetching graph intelligence from Neo4j.</p>
          </div>
        </div>
      )}

      {/* Main content — only render when summary is available */}
      {summary && (
        <>
            {/* ── AI Technical Briefing ─────────────────────────────────── */}
            {summary.repositoryIntelligence ? (
              <AITechnicalBriefing briefing={summary.repositoryIntelligence} />
            ) : (
              /* Fallback: legacy aiSummary card */
              <div className="p-6 rounded-2xl border border-[#222222] bg-[#0E0E0E] space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Code2 size={15} className="text-[#FF6B1A]" />
                  <h3 className="font-semibold text-[#F5F5F5] text-[18px]">Repository Overview</h3>
                </div>
                <p className="text-[12px] text-[#A0A0A0] leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: summary.aiSummary.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-200">$1</strong>'),
                  }}
                />
              </div>
            )}

          {/* ── Stats row ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatPill icon={FileCode}   label="Files Parsed"  value={summary.totalFiles.toLocaleString()} color="#FF6B1A" delay={0.05} />
            <StatPill icon={Activity}   label="Functions"     value={summary.totalFunctions.toLocaleString()} color="#FFB347" delay={0.08} />
            <StatPill icon={Layers}     label="Classes"       value={summary.totalClasses.toLocaleString()} color="#FFB347" delay={0.11} />
            <StatPill icon={TrendingUp} label="Imports"       value={summary.totalImports.toLocaleString()} color="#FF6B1A" delay={0.14} />
            <StatPill icon={BarChart3}  label="Graph Nodes"   value={graphData ? graphData.nodes.length.toLocaleString() : '–'} color="#F5E8D8" delay={0.17} />
            <StatPill icon={GitBranch}  label="Graph Edges"   value={graphData ? graphData.edges.length.toLocaleString() : '–'} color="#FF3E3E" delay={0.20} />
          </div>

          {/* ── Health + Complexity + Coverage row ──────────────────────── */}
          <div className="grid md:grid-cols-3 gap-5">
            {/* Health Score */}
            <GlassCard delay={0.1} padding="md" className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={15} className="text-emerald-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Health Score</h3>
                <div className="ml-auto group relative">
                  <Info size={13} className="text-slate-600 cursor-help" />
                  <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-64 bg-slate-900 border border-white/10 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed z-20 shadow-2xl">
                    <strong className="text-slate-200">Formula:</strong><br />
                    100 − complexityPenalty − hotspotPenalty − riskPenalty<br />
                    Each term capped: complexity (0–30), hotspots (0–20), risk (0–30)
                  </div>
                </div>
              </div>
              {health ? (
                <HealthDonut score={health.score} breakdown={health.breakdown} />
              ) : (
                <div className="text-xs text-slate-500 font-mono">Computing…</div>
              )}
            </GlassCard>

            {/* Complexity + Coverage */}
            <div className="flex flex-col gap-5">
              <GlassCard delay={0.15} padding="md">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={14} className="text-cyan-400" />
                  <h3 className="font-semibold text-slate-200 text-sm">Graph Complexity</h3>
                </div>
                {complexity ? (
                  <div className="flex items-center gap-3">
                    <span
                      className="text-2xl font-black font-mono"
                      style={{ color: complexity.color }}
                    >
                      {complexity.label}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                      score: {complexity.score.toFixed(1)}<br />
                      nodes: {graphData?.nodes.length ?? 0} · edges: {graphData?.edges.length ?? 0}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-mono">–</div>
                )}
              </GlassCard>

              <GlassCard delay={0.2} padding="md">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={14} className="text-[#FFB347]" />
                  <h3 className="font-semibold text-slate-200 text-sm">Parser Coverage</h3>
                </div>
                <div className="space-y-2 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parsed files</span>
                    <span className="text-slate-200 font-bold">{summary.totalFiles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total repo files</span>
                    <span className="text-slate-500 italic">Unavailable</span>
                  </div>
                  <div className="flex justify-between border-t border-white/12 pt-2 mt-1">
                    <span className="text-slate-500">Coverage</span>
                    <span className="text-[#FFB347] font-bold">Partial</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* ── Modules + Hotspots ──────────────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Major Modules */}
            <div className="lg:col-span-2">
              <GlassCard padding="md" className="border-white/20 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <Layers size={15} className="text-[#FF6B1A]" />
                  <h3 className="font-semibold text-slate-200 text-sm">Major Modules</h3>
                  {summary.majorModules.length === 0 && graphData && (
                    <span className="ml-auto text-[10px] text-slate-600 font-mono italic">inferred from graph</span>
                  )}
                </div>
                <div className="space-y-2">
                  {modules.length > 0 ? (
                    modules.map((mod, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/12 hover:border-white/20 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-200 truncate">{mod.name}</span>
                            <span className="text-[9px] text-slate-600 font-mono flex-shrink-0">{mod.fileCount} files</span>
                          </div>
                          {mod.description && (
                            <div className="text-[10px] text-slate-500 mt-0.5 leading-normal truncate">{mod.description}</div>
                          )}
                        </div>
                        {mod.functionCount > 0 && (
                          <div className="text-[9px] text-slate-600 font-mono flex-shrink-0 text-right">
                            {mod.functionCount} fn<br />
                            {mod.importCount} imp
                          </div>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 font-mono py-3 text-center">
                      No modules detected. Files are flat in root.
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Hotspots */}
            <div>
              <GlassCard padding="none" delay={0.15} className="h-full">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/12">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-rose-400" />
                    <h3 className="font-semibold text-slate-200 text-sm">Hotspot Files</h3>
                  </div>
                  <div className="group relative">
                    <Info size={12} className="text-slate-600 cursor-help" />
                    <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-56 bg-slate-900 border border-white/10 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed z-20 shadow-2xl">
                      Ranked by: incoming + outgoing edges + function count + import count
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {hotspots.length > 0 ? (
                    hotspots.map(({ node, score, incoming, outgoing }, i) => {
                      const path = (node.metadata?.rel_path ?? node.metadata?.path ?? node.label ?? '') as string;
                      const fileName = path.split('/').pop() ?? path;
                      const pct = hotspots[0].score > 0 ? (score / hotspots[0].score) * 100 : 0;
                      return (
                        <motion.div
                          key={node.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.06 * i }}
                          className="px-5 py-3 hover:bg-white/[0.02] transition-colors group"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-mono text-slate-400 truncate group-hover:text-slate-200 transition-colors max-w-[150px]">
                              {fileName}
                            </span>
                            <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">score {score}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1.5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.7, delay: 0.05 * i }}
                              className="h-full rounded-full"
                              style={{ background: 'linear-gradient(90deg, #FF6B1A, #FFB347)' }}
                            />
                          </div>
                          <div className="flex items-center gap-3 text-[9px] text-slate-600 font-mono">
                            <span>↑{outgoing} out</span>
                            <span>↓{incoming} in</span>
                            <span className="truncate text-slate-500">{path}</span>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : graphData ? (
                    <div className="px-5 py-6 text-xs text-slate-500 font-mono text-center">
                      No hotspots detected from the current graph.
                    </div>
                  ) : (
                    <div className="px-5 py-6 text-xs text-slate-500 font-mono text-center">
                      <Loader2 size={14} className="animate-spin mx-auto mb-2" />
                      Loading graph data…
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          </div>

          {/* ── Risk Areas (if any) ───────────────────────────────────── */}
          {summary.riskAreas && summary.riskAreas.length > 0 && (
            <GlassCard padding="md" delay={0.3}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={15} className="text-amber-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Risk Areas</h3>
                <span className="badge badge-yellow text-[10px] ml-1">{summary.riskAreas.length}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {summary.riskAreas.slice(0, 4).map((risk, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/12"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge text-[9px] ${
                        risk.severity === 'critical' ? 'badge-red' :
                        risk.severity === 'high' ? 'badge-yellow' :
                        'badge-indigo'
                      }`}>
                        {risk.severity}
                      </span>
                      <span className="text-xs font-mono text-slate-300">{risk.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{risk.description}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* ── SECTION 2: Recent Activity ────────────────────────────── */}
          {loadingActivity ? (
            <GlassCard padding="md">
              <div className="flex items-center gap-2 mb-4">
                <GitCommit size={15} className="text-[#FF6B1A]" />
                <h2 className="font-semibold text-slate-200 text-sm">Recent Activity</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" />
                Loading git history…
              </div>
            </GlassCard>
          ) : activity && activity.source === 'git' && activity.recentCommits.length > 0 ? (
            <GlassCard padding="none" delay={0.1}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/12">
                <div className="flex items-center gap-2">
                  <GitCommit size={15} className="text-[#FF6B1A]" />
                  <h2 className="font-semibold text-slate-200 text-sm">Recent Activity</h2>
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    git
                  </span>
                </div>
                <span className="text-[10px] text-slate-600 font-mono">
                  {activity.recentCommits.length} commits
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {activity.recentCommits.slice(0, 13).map((commit: RecentCommit, i) => (
                  <motion.div
                    key={commit.sha}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.04 * i }}
                    className="px-5 py-3 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors leading-snug truncate">
                          {commit.message}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600 font-mono flex-wrap">
                          <span className="text-[#FFB347]/80">{commit.authorName}</span>
                          <span>·</span>
                          <span>{timeAgo(commit.date)}</span>
                          {commit.filesChanged.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{commit.filesChanged.length} file{commit.filesChanged.length !== 1 ? 's' : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        id={`commit-sha-${i}`}
                        className="text-[9px] font-mono text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5"
                        title={commit.sha}
                      >
                        {commit.sha.slice(0, 7)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          ) : activity && activity.source === 'unavailable' ? (
            <GlassCard padding="md">
              <div className="flex items-center gap-2 mb-3">
                <GitCommit size={15} className="text-slate-600" />
                <h2 className="font-semibold text-slate-400 text-sm">Recent Activity</h2>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Contributor activity unavailable for this repository.
              </p>
            </GlassCard>
          ) : null}

          {/* ── SECTION 3: Contributors ──────────────────────────────── */}
          {!loadingActivity && activity && activity.source === 'git' && activity.contributors.length > 0 ? (
            <GlassCard padding="md" delay={0.15}>
              <div className="flex items-center gap-2 mb-5">
                <Users size={15} className="text-emerald-400" />
                <h2 className="font-semibold text-slate-200 text-sm">Contributors</h2>
                <span className="badge badge-green text-[10px] ml-1">
                  {activity.contributors.length}
                </span>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded ml-1"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  git
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activity.contributors.map((contributor: Contributor, i) => {
                  const color = avatarColor(contributor.name);
                  return (
                    <motion.button
                      key={contributor.email}
                      id={`contributor-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleContributorClick(contributor)}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/12 hover:border-white/20 hover:bg-white/[0.05] transition-all text-left w-full group"
                    >
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{
                          background: `${color}cc`,
                          boxShadow: `0 0 0 2px ${color}30`,
                        }}
                      >
                        {initials(contributor.name)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                          {contributor.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                          <span>{contributor.commitCount} commits</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock size={9} />
                            {timeAgo(contributor.lastActiveDate)}
                          </span>
                        </div>
                        {contributor.primaryAreas.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {contributor.primaryAreas.slice(0, 2).map(area => (
                              <span
                                key={area}
                                className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                                style={{ background: `${color}15`, color: color, border: `1px solid ${color}25` }}
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <ChevronRight size={12} className="text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            </GlassCard>
          ) : !loadingActivity && activity && activity.source === 'unavailable' ? (
            <GlassCard padding="md">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-slate-600" />
                <h2 className="font-semibold text-slate-400 text-sm">Contributors</h2>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Contributor activity unavailable for this repository.
              </p>
            </GlassCard>
          ) : null}
        </>
      )}

      {/* Contributor side panel */}
      <AnimatePresence>
        {selectedContributor && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedContributor(null)}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            />
            <ContributorPanel
              contributor={selectedContributor}
              allCommits={activity?.recentCommits ?? []}
              onClose={() => setSelectedContributor(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Root Dashboard ────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { analysisId } = useRepo();
  return (
    <AnimatePresence mode="wait">
      {analysisId ? (
        <motion.div
          key="loaded"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
          className="h-full"
        >
          <LoadedDashboard />
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
          className="h-full"
        >
          <EmptyDashboard />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Dashboard;
