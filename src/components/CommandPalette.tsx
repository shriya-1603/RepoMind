import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, FileCode, Zap, Sparkles, LayoutDashboard, GitBranch, Shield, ArrowRight } from 'lucide-react';
import { mockFileNodes } from '../data/mockRepositoryData';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;  category: 'Actions' | 'Files';
  icon: React.ComponentType<any>;
  action: () => void;}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Reset indices and focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Command palette contents
  const actions: CommandItem[] = [
    { id: 'act-dash',   title: 'Jump to Dashboard',         subtitle: 'Overview of repository metrics', category: 'Actions', icon: LayoutDashboard, action: () => { navigate('/dashboard'); onClose(); } },
    { id: 'act-graph',  title: 'Open Graph Explorer',       subtitle: 'Interactive dependency visualization', category: 'Actions', icon: GitBranch, action: () => { navigate('/graph'); onClose(); } },
    { id: 'act-search', title: 'Start Semantic Search',     subtitle: 'Ask natural language code questions', category: 'Actions', icon: Sparkles, action: () => { navigate('/search'); onClose(); } },
    { id: 'act-impact', title: 'Simulate API Refactor',     subtitle: 'Impact analysis for api.ts', category: 'Actions', icon: Zap, action: () => { navigate('/impact'); onClose(); } },
    { id: 'act-onbd',   title: 'Start AI Onboarding',       subtitle: 'Guided walkthrough of codebase', category: 'Actions', icon: Shield, action: () => { navigate('/onboard'); onClose(); } },
  ];

  const fileItems: CommandItem[] = mockFileNodes.map(node => ({
    id: `file-${node.id}`,
    title: node.name,
    subtitle: node.path,
    category: 'Files',
    icon: FileCode,
    action: () => {
      navigate(`/graph`); // Jump to graph
      // Note: in a real app we might pass selected file context
      onClose();
    }
  }));

  const allItems = [...actions, ...fileItems];

  // Filter based on input
  const filtered = allItems.filter(item => {
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
    );
  });

  // Handle keyboard interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  // Auto-scroll selected item into view
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const activeEl = itemsContainerRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Group items by category for rendering
  const categories = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Flattened index mapping to get correct index mapping
  let currentIndexTracker = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-start justify-center pt-[12vh] px-4"
        >
          <motion.div
            initial={{ scale: 0.96, y: -8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: -8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            ref={containerRef}
            className="w-full max-w-xl glass border border-white/10 rounded-2xl shadow-2xl glow-indigo overflow-hidden flex flex-col"
          >
            {/* Input bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
              <Search size={18} className="text-slate-500 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search files or actions... (Up/Down to navigate)"
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
              />
              <span className="text-[10px] bg-white/5 border border-white/10 text-slate-500 rounded px-1.5 py-0.5 font-mono">
                ESC
              </span>
            </div>

            {/* Results */}
            <div
              ref={itemsContainerRef}
              className="flex-1 max-h-[340px] overflow-y-auto p-2 space-y-3"
            >
              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-xs text-slate-500">No results found for "{query}"</span>
                </div>
              ) : (
                Object.entries(categories).map(([catName, items]) => (
                  <div key={catName}>
                    <div className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold px-3 mb-1.5 mt-1">
                      {catName}
                    </div>
                    <div className="space-y-0.5">
                      {items.map(item => {
                        const globalIndex = currentIndexTracker++;
                        const isActive = globalIndex === selectedIndex;
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            data-active={isActive}
                            onClick={item.action}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all relative ${
                              isActive ? 'bg-white/[0.05] border border-white/5 shadow-inner' : 'border border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/[0.03] text-slate-500'
                            }`}>
                              <Icon size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-semibold ${isActive ? 'text-slate-100' : 'text-slate-400'}`}>
                                {item.title}
                              </div>
                              <div className="text-[10px] text-slate-600 truncate font-mono mt-0.5">
                                {item.subtitle}
                              </div>
                            </div>
                            {isActive && (
                              <motion.div
                                layoutId="arrow-run"
                                className="text-indigo-400 text-xs font-semibold flex items-center gap-1"
                              >
                                Run <ArrowRight size={10} />
                              </motion.div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-white/[0.01] border-t border-white/5 flex items-center justify-between text-[10px] text-slate-600">
              <div className="flex items-center gap-3">
                <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
                <span><kbd className="font-mono">↵</kbd> Select</span>
              </div>
              <div>
                <span>Press <kbd className="font-mono font-semibold">Cmd+K</kbd> to toggle anywhere</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
