import React from 'react';
import { motion } from 'framer-motion';
import { Map, Focus, FolderKanban } from 'lucide-react';

interface ExplorerHeaderProps {
  viewMode: 'system' | 'graph';
  activeSubsystemName: string | null;
  activeFileName: string | null;
}

export const ExplorerHeader: React.FC<ExplorerHeaderProps> = ({
  viewMode,
  activeSubsystemName,
  activeFileName,
}) => {
  const getContextString = () => {
    if (viewMode === 'graph') {
      return { title: 'Dependency Graph', subtitle: 'Flat codebase network', icon: FolderKanban };
    }
    if (activeFileName) {
      return { title: `Focus: ${activeFileName}`, subtitle: activeSubsystemName ? `Inside ${activeSubsystemName} Subsystem` : 'File Node Details', icon: Focus };
    }
    if (activeSubsystemName) {
      return { title: `Subsystem: ${activeSubsystemName}`, subtitle: 'Exploring inner files and metrics', icon: Map };
    }
    return { title: 'System Map', subtitle: 'Overview of repository subsystems', icon: Map };
  };

  const { title, subtitle, icon: Icon } = getContextString();

  return (
    <div className="absolute top-4 left-4 z-10 pointer-events-auto flex items-center gap-3 glass border border-white/8 bg-slate-950/80 px-4 py-2.5 rounded-xl shadow-2xl">
      <div className="w-7 h-7 rounded-lg bg-[#FF6B1A]/10 border border-[#FF6B1A]/20 flex items-center justify-center text-[#FF6B1A]">
        <Icon size={14} />
      </div>
      <div>
        <motion.h2 
          key={title}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-bold text-slate-200 font-[Syne]"
        >
          {title}
        </motion.h2>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
};
