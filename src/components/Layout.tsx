import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, GitBranch, Search, Zap, Bot,
  ChevronLeft, ChevronRight, Settings, Cpu, Menu,
} from 'lucide-react';
import CommandPalette from './CommandPalette';
import AmbientBackground from './AmbientBackground';
import { useRepo } from '../contexts/RepoContext';
import { getGraphReal, getRepositoryActivity } from '../services/repoApi';
import type { RealGraphResponse, RepositoryActivityData } from '../services/repoApi';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',       shortcut: '1' },
  { path: '/graph',     icon: GitBranch,        label: 'Graph Explorer',  shortcut: '2' },
  { path: '/search',   icon: Search,            label: 'Semantic Search', shortcut: '3' },
  { path: '/impact',   icon: Zap,               label: 'Impact Analysis', shortcut: '4' },
  { path: '/onboard',  icon: Bot,               label: 'AI Onboarding',   shortcut: '5' },
];

// ── Presence Data Hook ──────────────────────────────────────────────────

interface PresenceData {
  nodeCount: number | 'Unavailable';
  edgeCount: number | 'Unavailable';
  commitCount: number | 'Unavailable';
  contributorCount: number | 'Unavailable';
  lastCommitDate: string;
}

const usePresenceData = (analysisId: string | null): PresenceData | null => {
  const [data, setData] = useState<PresenceData | null>(null);

  useEffect(() => {
    if (!analysisId) { setData(null); return; }
    let active = true;

    Promise.allSettled([
      getGraphReal(analysisId),
      getRepositoryActivity(analysisId),
    ]).then(([graphRes, activityRes]) => {
      if (!active) return;
      const graph = graphRes.status === 'fulfilled' && graphRes.value ? graphRes.value as RealGraphResponse : null;
      const activity = activityRes.status === 'fulfilled' && activityRes.value ? activityRes.value as RepositoryActivityData : null;
      setData({
        nodeCount:        graph?.nodes ? graph.nodes.length : 'Unavailable',
        edgeCount:        graph?.edges ? graph.edges.length : 'Unavailable',
        commitCount:      activity?.overview?.totalCommits !== undefined && activity?.overview?.totalCommits !== null
                            ? activity.overview.totalCommits
                            : 'Unavailable',
        contributorCount: activity?.overview?.activeContributors !== undefined && activity?.overview?.activeContributors !== null
                            ? activity.overview.activeContributors
                            : 'Unavailable',
        lastCommitDate:   activity?.overview?.lastCommitDate ?? '',
      });
    });

    return () => { active = false; };
  }, [analysisId]);

  return data;
};

// ── Helpers ───────────────────────────────────────────────────────────

function timeAgoShort(iso: string): string {
  if (!iso) return '';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / 86_400_000);
    if (days < 1)  return 'today';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  } catch { return ''; }
}

// ── Presence stat row ──────────────────────────────────────────────────

const PresenceStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    <span className="text-[9px] font-mono font-medium" style={{ color: '#9CA3AF' }}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
  </div>
);

// ── Repository Presence Layer ─────────────────────────────────────────────

const RepositoryPresenceLayer: React.FC<{
  repoName: string | null;
  source: string;
  analysisId: string | null;
  collapsed: boolean;
  presenceData: PresenceData | null;
}> = ({ repoName, source, analysisId, collapsed, presenceData }) => {
  const isActive = !!repoName && source !== 'none';
  const shortId  = analysisId ? analysisId.slice(-8) : null;

  if (collapsed) {
    return (
      <div
        className="mx-3 mb-2 flex items-center justify-center py-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0"
          style={{
            background: isActive ? 'rgba(255, 69, 0, 0.12)' : 'rgba(255,255,255,0.03)',
            color: isActive ? '#FF4500' : '#374151',
            border: isActive ? '1px solid rgba(255, 69, 0, 0.22)' : '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {isActive && repoName ? repoName[0].toUpperCase() : '—'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-3">
      <div
        className="rounded-xl p-3"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {isActive ? (
          <>
            {/* Repo name + source badge */}
            <div className="flex items-start justify-between gap-1.5 mb-3">
              <div className="min-w-0 flex-1">
                <div
                  className="text-xs font-semibold text-white truncate leading-tight"
                  style={{ letterSpacing: '-0.015em' }}
                >
                  {repoName}
                </div>
                {shortId && (
                  <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    #{shortId}
                  </div>
                )}
              </div>
              <span
                className="text-[8px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                style={{
                  background: source === 'neo4j' ? 'rgba(255, 69, 0, 0.12)' : 'rgba(255,255,255,0.04)',
                  color:      source === 'neo4j' ? '#FF4500' : '#374151',
                  border:     source === 'neo4j' ? '1px solid rgba(255, 69, 0, 0.22)' : '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {source === 'neo4j' ? 'neo4j' : 'local'}
              </span>
            </div>

            {/* Real stats */}
            {presenceData ? (
              <div className="space-y-1.5">
                <PresenceStat label="Nodes"        value={presenceData.nodeCount} />
                <PresenceStat label="Edges"        value={presenceData.edgeCount} />
                <PresenceStat label="Commits"      value={presenceData.commitCount} />
                <PresenceStat label="Contributors" value={presenceData.contributorCount} />
                {presenceData.lastCommitDate && (
                  <div
                    className="pt-1.5 mt-0.5"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <PresenceStat
                      label="Last commit"
                      value={timeAgoShort(presenceData.lastCommitDate)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: '#FF4500' }}
                />
                <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  Loading context…
                </span>
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="text-[11px] font-medium mb-1" style={{ color: '#374151' }}>
              No repository
            </div>
            <div className="text-[10px] leading-relaxed" style={{ color: '#1F2937' }}>
              Import a GitHub URL to begin.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface NavItemProps {
  path: string;
  icon: React.ComponentType<any>;
  label: string;
  shortcut: string;
  collapsed: boolean;
  mobile: boolean;
  onNavigate: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  path, icon: Icon, label, shortcut, collapsed, mobile, onNavigate,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <NavLink
      to={path}
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
      title={collapsed && !mobile ? label : undefined}
    >
      <Icon size={15} className="flex-shrink-0" style={{ opacity: 0.75 }} />
      <AnimatePresence>
        {(!collapsed || mobile) && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 truncate"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Shortcut hint on hover */}
      {(!collapsed || mobile) && (
        <AnimatePresence mode="wait">
          {hovered && (
            <motion.span
              key="shortcut"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                background: 'rgba(255, 69, 0, 0.12)',
                border: '1px solid rgba(255, 69, 0, 0.22)',
                color: '#FF4500',
              }}
            >
              ⌘{shortcut}
            </motion.span>
          )}
        </AnimatePresence>
      )}
    </NavLink>
  );
};

// ── Main Layout ────────────────────────────────────────────────────────────
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { repoName, source, analysisId } = useRepo();
  const presenceData = usePresenceData(analysisId);
  const location = useLocation();

  // Page title derived from route
  const pageTitle = useMemo(() => {
    const match = navItems.find(n => location.pathname.startsWith(n.path));
    return match?.label ?? 'RepoMind';
  }, [location.pathname]);

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <motion.aside
      animate={{ width: mobile ? 260 : collapsed ? 68 : 240 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative flex flex-col h-full glass border-r border-white/12 overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(255, 69, 0, 0.12)',
            border: '1px solid rgba(255, 69, 0, 0.22)',
          }}
        >
          <Cpu size={13} style={{ color: '#FF4500' }} />
        </div>
        <AnimatePresence>
          {(!collapsed || mobile) && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <span
                className="font-semibold text-[15px] text-white"
                style={{ letterSpacing: '-0.025em' }}
              >
                RepoMind
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Repository Presence Layer */}
      <div className="pt-3">
        <RepositoryPresenceLayer
          repoName={repoName}
          source={source}
          analysisId={analysisId}
          collapsed={collapsed && !mobile}
          presenceData={presenceData}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5">
        {navItems.map(item => (
          <NavItem
            key={item.path}
            {...item}
            collapsed={collapsed}
            mobile={mobile}
            onNavigate={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Bottom: Settings only — no fake user */}
      <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <button
          id="settings-btn"
          className="sidebar-nav-item w-full"
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings size={14} className="flex-shrink-0" style={{ opacity: 0.5 }} />
          {(!collapsed || mobile) && (
            <span style={{ opacity: 0.5 }}>Settings</span>
          )}
        </button>
      </div>

      {/* Collapse button */}
      {!mobile && (
        <button
          id="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[4.5rem] w-5 h-5 rounded-full flex items-center justify-center transition-all z-10"
          style={{
            background: '#0A0A0A',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#6B7280',
          }}
        >
          {collapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>
      )}
    </motion.aside>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060606' }}>
      {/* Ambient background — behind everything */}
      <AmbientBackground />

      {/* Desktop Sidebar */}
      <div className="relative hidden md:flex" style={{ zIndex: 10 }}>
        <Sidebar />
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 h-full z-50 md:hidden"
            >
              <div className="h-full">
                <Sidebar mobile />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center justify-between px-4 md:px-5 py-3 flex-shrink-0"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            background: '#000000',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Left: hamburger + page context */}
          <div className="flex items-center gap-3">
            <button
              id="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              className="md:hidden transition-colors"
              style={{ color: '#6B7280' }}
            >
              <Menu size={18} />
            </button>

            {/* Page / repo context */}
            <div className="hidden sm:flex items-center gap-2">
              <span
                className="text-sm font-medium"
                style={{ color: '#D1D5DB', letterSpacing: '-0.01em' }}
              >
                {pageTitle}
              </span>
              {repoName && source !== 'none' && (
                <>
                  <span style={{ color: '#1F2937' }}>/</span>
                  <span className="text-sm" style={{ color: '#4B5563', letterSpacing: '-0.01em' }}>
                    {repoName}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: ⌘K + source badge */}
          <div className="flex items-center gap-2">
            {/* Subtle ⌘K trigger */}
            <button
              id="command-palette-btn"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg transition-all"
              style={{
                padding: '5px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#4B5563',
              }}
            >
              <Search size={11} />
              <span className="text-[10px] font-mono">⌘K</span>
            </button>

            {/* Source badge — only when repo is active */}
            {source === 'neo4j' && analysisId && (
              <div
                id="source-badge"
                className="hidden sm:flex items-center gap-1 rounded-lg text-[9px] font-mono"
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255, 69, 0, 0.07)',
                  border: '1px solid rgba(255, 69, 0, 0.15)',
                  color: '#FF4500',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#FF4500' }}
                />
                neo4j
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

export default Layout;
