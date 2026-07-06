import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { X, Layers, ShieldAlert, FolderCode, ArrowRightLeft, Cpu } from 'lucide-react';
import type { Subsystem } from '../hooks/useExplorerLayout';

interface SubsystemDetailsPanelProps {
  subsystem: Subsystem;
  onClose: () => void;
}

export const SubsystemDetailsPanel: React.FC<SubsystemDetailsPanelProps> = memo(({
  subsystem,
  onClose,
}) => {
  const riskColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="h-full w-full glass border-l border-white/10 bg-slate-950/90 flex flex-col z-20 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#FF6B1A]" />
          <span className="font-[Syne] font-bold text-xs text-slate-100">{subsystem.name}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors p-1">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Purpose */}
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1.5">Purpose</div>
          <p className="text-xs text-slate-400 leading-relaxed font-light">{subsystem.description}</p>
        </div>

        {/* Primary Entry File */}
        {subsystem.entryFiles.length > 0 && (
          <div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2">Primary Entry</div>
            <div className="bg-slate-900/60 border border-white/5 rounded-xl p-2.5 flex items-center gap-2 font-mono text-[10px] text-cyan-400">
              <FolderCode size={12} className="text-slate-500 flex-shrink-0" />
              <span className="truncate">{subsystem.entryFiles[0]}</span>
            </div>
          </div>
        )}

        {/* Critical Files */}
        {subsystem.criticalFiles.length > 0 && (
          <div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2">Critical Files</div>
            <div className="space-y-1.5">
              {subsystem.criticalFiles.map(fileId => (
                <div key={fileId} className="bg-slate-900/40 border border-white/5 rounded-xl p-2.5 flex items-center gap-2 font-mono text-[10px] text-slate-350">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="truncate">{fileId.split('/').pop()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subsystem Dependencies */}
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
            <ArrowRightLeft size={10} />
            Subsystem Dependencies
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {/* Incoming */}
            <div className="bg-slate-900/20 border border-white/5 rounded-xl p-2.5">
              <div className="text-slate-500 mb-1">INCOMING</div>
              <div className="space-y-1 font-bold text-slate-350">
                {subsystem.incomingDependencies.length > 0 ? (
                  subsystem.incomingDependencies.map(dep => <div key={dep}>{dep}</div>)
                ) : (
                  <div className="text-[9px] text-slate-600 font-light">None</div>
                )}
              </div>
            </div>

            {/* Outgoing */}
            <div className="bg-slate-900/20 border border-white/5 rounded-xl p-2.5">
              <div className="text-slate-500 mb-1">OUTGOING</div>
              <div className="space-y-1 font-bold text-slate-350">
                {subsystem.dependencies.length > 0 ? (
                  subsystem.dependencies.map(dep => <div key={dep}>{dep}</div>)
                ) : (
                  <div className="text-[9px] text-slate-600 font-light">None</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Risk & Health */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-500 font-bold uppercase tracking-widest">Risk Level</span>
            <span 
              className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] border"
              style={{
                color: riskColors[subsystem.risk],
                borderColor: `${riskColors[subsystem.risk]}40`,
                background: `${riskColors[subsystem.risk]}12`,
              }}
            >
              {subsystem.risk}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono mt-3">
            <span className="text-slate-500 font-bold uppercase tracking-widest">Total files</span>
            <span className="text-slate-200">{subsystem.fileIds.length}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono mt-2">
            <span className="text-slate-500 font-bold uppercase tracking-widest">Functions</span>
            <span className="text-slate-200">{subsystem.metrics.functions}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

SubsystemDetailsPanel.displayName = 'SubsystemDetailsPanel';
export default SubsystemDetailsPanel;
