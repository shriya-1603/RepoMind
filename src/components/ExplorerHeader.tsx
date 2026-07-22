import React from 'react';
import { Map, Focus, FolderKanban, ChevronRight } from 'lucide-react';

export interface NavPathItem {
  id: string;
  label: string;
  type: 'system' | 'file' | 'class' | 'function';
}

interface ExplorerHeaderProps {
  viewMode: 'system' | 'graph';
  activeSubsystemName: string | null;
  activeFileName: string | null;
  navPath: NavPathItem[];
  onBreadcrumbClick: (index: number) => void;
}

export const ExplorerHeader: React.FC<ExplorerHeaderProps> = ({
  viewMode,
  activeSubsystemName,
  activeFileName,
  navPath,
  onBreadcrumbClick,
}) => {
  const getContextString = () => {
    if (viewMode === 'graph') {
      return { subtitle: 'Flat codebase network projection', icon: FolderKanban };
    }
    const current = navPath[navPath.length - 1];
    if (current.type === 'function') {
      return { subtitle: 'Function implementation call-chain map', icon: Focus };
    }
    if (current.type === 'class') {
      return { subtitle: 'Class methods and inheritance hierarchy', icon: Focus };
    }
    if (current.type === 'file') {
      return { subtitle: activeSubsystemName ? `Inside ${activeSubsystemName} Subsystem` : 'File Node Details', icon: Focus };
    }
    if (activeSubsystemName) {
      return { subtitle: 'Exploring inner files and metrics', icon: Map };
    }
    return { subtitle: 'Overview of repository subsystems', icon: Map };
  };

  const { subtitle, icon: Icon } = getContextString();

  return (
    <div className="absolute top-4 left-4 z-10 pointer-events-auto flex items-center gap-3 glass border border-white/8 bg-slate-950/80 px-4 py-2.5 rounded-xl shadow-2xl">
      <div className="w-7 h-7 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent)]">
        <Icon size={14} />
      </div>
      <div className="flex flex-col">
        {/* Interactive Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {navPath.map((item, idx) => (
            <React.Fragment key={item.id + '-' + idx}>
              {idx > 0 && <span className="text-[10px] text-slate-600">➔</span>}
              <button
                onClick={() => onBreadcrumbClick(idx)}
                className={`text-xs font-mono font-semibold transition-all hover:text-white ${
                  idx === navPath.length - 1 ? 'text-[var(--accent-text)]' : 'text-slate-400'
                }`}
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
        <p className="text-[9px] text-slate-500 font-mono mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
};
