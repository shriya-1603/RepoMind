import React from 'react';
import { Layers } from 'lucide-react';
import type { Subsystem } from '../hooks/useExplorerLayout';

interface SystemMinimapProps {
  subsystems: Subsystem[];
  expandedSubsystemId: string | null;
  onSubsystemClick: (id: string) => void;
}

export const SystemMinimap: React.FC<SystemMinimapProps> = ({
  subsystems,
  expandedSubsystemId,
  onSubsystemClick,
}) => {
  return (
    <div className="absolute bottom-6 right-6 z-10 glass border border-white/8 bg-slate-950/80 p-3 rounded-xl shadow-2xl w-48 text-left pointer-events-auto">
      <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5 mb-2">
        <Layers size={11} className="text-[#FF6B1A]" />
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">
          Architecture Overview
        </span>
      </div>
      <div className="space-y-1">
        {subsystems.map(sub => {
          const isActive = expandedSubsystemId === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => onSubsystemClick(sub.id)}
              className={`w-full text-left px-2 py-1 rounded transition-colors flex items-center justify-between text-[10px] font-mono border ${
                isActive
                  ? 'bg-[#FF6B1A]/10 border-[#FF6B1A]/20 text-[#FF6B1A]'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="truncate max-w-[120px]">{sub.name.replace(' Area', '')}</span>
              <span className="text-[8px] opacity-75">{sub.fileIds.length}f</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default SystemMinimap;
