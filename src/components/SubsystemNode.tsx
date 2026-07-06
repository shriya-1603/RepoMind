import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, FolderCode, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import type { NodeProps } from '@xyflow/react';

export interface SubsystemNodeData {
  label: string;
  id: string;
  description: string;
  filesCount: number;
  functionsCount: number;
  classesCount: number;
  entryFile?: string;
  risk: 'low' | 'medium' | 'high';
  isExpanded?: boolean;
  opacity?: number;
  onExpandToggle?: (id: string) => void;
}

const SubsystemNode: React.FC<NodeProps> = memo(({ data }) => {
  const nodeData = data as unknown as SubsystemNodeData;
  const isExpanded = !!nodeData.isExpanded;
  const opacity = nodeData.opacity !== undefined ? nodeData.opacity : 1;

  const riskColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  const borderGlow = isExpanded
    ? '0 0 25px rgba(255, 107, 26, 0.25), 0 4px 20px rgba(0,0,0,0.6)'
    : '0 4px 16px rgba(0,0,0,0.3)';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: isExpanded ? 'rgba(15, 23, 42, 0.45)' : 'rgba(30, 41, 59, 0.15)',
        border: isExpanded ? '1px solid rgba(255, 107, 26, 0.45)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '16px',
        backdropFilter: 'blur(16px)',
        boxShadow: borderGlow,
        opacity,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        pointerEvents: 'all',
      }}
      className="relative flex flex-col justify-between group"
    >
      {/* Top entry highlighter bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300"
        style={{
          background: isExpanded 
            ? 'linear-gradient(90deg, transparent, #FF6B1A, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)'
        }}
      />

      <div className="flex flex-col gap-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900/80 border border-white/8 flex items-center justify-center text-[#FF6B1A] shadow-md">
              <Layers size={14} className={isExpanded ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 className="font-[Syne] font-bold text-xs text-slate-100 uppercase tracking-wide">
                {nodeData.label}
              </h3>
              <p className="text-[9px] text-[#FF6B1A] font-semibold tracking-wider font-mono">
                SUBSYSTEM
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (nodeData.onExpandToggle) {
                nodeData.onExpandToggle(nodeData.id);
              }
            }}
            className="w-6 h-6 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors ml-auto active:scale-95"
            title={isExpanded ? 'Zoom out of subsystem' : 'Zoom into subsystem'}
          >
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Short Purpose Text */}
        {!isExpanded && (
          <p className="text-[10px] text-slate-450 leading-relaxed font-light mt-1">
            {nodeData.description}
          </p>
        )}

        {/* Primary Entry file hint */}
        {nodeData.entryFile && !isExpanded && (
          <div className="flex items-center gap-2 mt-2 bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 font-mono text-[9px] text-slate-400">
            <FolderCode size={11} className="text-slate-500" />
            <span>Entry:</span>
            <span className="text-cyan-400 truncate max-w-[140px]">{nodeData.entryFile}</span>
          </div>
        )}
      </div>

      {/* Metrics Footer (Only visible when collapsed to keep cards clean) */}
      {!isExpanded && (
        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-4 text-[9px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span>{nodeData.filesCount} files</span>
            <span>•</span>
            <span>{nodeData.functionsCount} functions</span>
          </div>

          {/* Risk dot scale */}
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={10} style={{ color: riskColors[nodeData.risk] }} />
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full" style={{ background: riskColors[nodeData.risk] }} />
              <span className="w-1 h-1 rounded-full" style={{ background: nodeData.risk !== 'low' ? riskColors[nodeData.risk] : 'rgba(255,255,255,0.1)' }} />
              <span className="w-1 h-1 rounded-full" style={{ background: nodeData.risk === 'high' ? riskColors[nodeData.risk] : 'rgba(255,255,255,0.1)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Incremental visual file-grid placeholders when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.2 }}
            className="flex-1 border-t border-dashed border-white/8 mt-4 pt-3 flex flex-col justify-start"
          >
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">
              FILES INSIDE AREA
            </div>
            <div className="grid grid-cols-2 gap-2.5 h-full opacity-10 pointer-events-none select-none">
              {Array.from({ length: Math.min(nodeData.filesCount, 4) }).map((_, idx) => (
                <div key={idx} className="h-14 rounded-xl border border-white/5 bg-white/[0.01]" />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

SubsystemNode.displayName = 'SubsystemNode';
export default SubsystemNode;
