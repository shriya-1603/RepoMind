import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import GlassCard from './GlassCard';
import type { ImpactAnalysisRealData } from '../services/repoApi';

interface ImpactDetailsPanelProps {
  data: ImpactAnalysisRealData | null;
  loading: boolean;
  error: string | null;
  warning?: string | null;
  onDismissWarning?: () => void;
}

export const ImpactDetailsPanel: React.FC<ImpactDetailsPanelProps> = ({
  data,
  loading,
  error,
  warning,
  onDismissWarning,
}) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="glass rounded-xl p-6 border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center gap-3"
      >
        <Loader2 size={18} className="animate-spin text-indigo-400" />
        <span className="text-xs text-slate-500">Analyzing impact...</span>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="glass rounded-xl p-4 border border-rose-500/30 bg-rose-500/[0.01]"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-rose-300">Error</div>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="glass rounded-xl p-6 border border-white/5 bg-white/[0.01] text-center"
      >
        <span className="text-xs text-slate-500">Select a target to analyze impact</span>
      </motion.div>
    );
  }

  const riskColors = {
    low: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    medium: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    high: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    critical: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  };

  const getRiskLevel = (score: number): keyof typeof riskColors => {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  const riskLevel = getRiskLevel(data.riskScore);
  const colors = riskColors[riskLevel];
  const RiskIcon = riskLevel === 'critical' ? AlertTriangle : riskLevel === 'high' ? AlertCircle : CheckCircle;
  const riskCardVariant = { low: 'cyan', medium: 'indigo', high: 'violet', critical: 'rose' } as const;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="space-y-3"
      >
        {/* Warning banner if Neo4j unavailable */}
        {warning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-xl px-4 py-3 border border-amber-500/20 bg-amber-500/5 flex items-center gap-3"
          >
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-200">{warning}</span>
            {onDismissWarning && (
              <button
                onClick={onDismissWarning}
                className="ml-auto text-amber-600 hover:text-amber-400 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}

        {/* Main Risk Card */}
        <GlassCard variant={riskCardVariant[riskLevel]} padding="md" animate={false}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                <RiskIcon size={16} className={colors.text} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  {data.targetNode.label}
                  <span className={`text-[10px] font-mono font-semibold ${colors.text}`}>
                    {riskLevel.toUpperCase()} ({data.riskScore}/100)
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mt-2 whitespace-pre-wrap">
                  {data.explanation}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Dependency Counts Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-lg p-3 border border-white/5 bg-white/[0.01]">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Upstream</div>
            <div className="text-lg font-bold text-indigo-400 font-mono">{data.dependencyCounts.upstream}</div>
          </div>
          <div className="glass rounded-lg p-3 border border-white/5 bg-white/[0.01]">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Downstream</div>
            <div className="text-lg font-bold text-violet-400 font-mono">{data.dependencyCounts.downstream}</div>
          </div>
          <div className="glass rounded-lg p-3 border border-white/5 bg-white/[0.01]">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Total Affected</div>
            <div className="text-lg font-bold text-cyan-400 font-mono">{data.dependencyCounts.total}</div>
          </div>
        </div>

        {/* Affected Items */}
        {(data.affectedFiles.length > 0 || data.affectedFunctions.length > 0 || data.affectedClasses.length > 0) && (
          <div className="space-y-2">
            {data.affectedFiles.length > 0 && (
              <div className="glass rounded-lg p-3 border border-white/5 bg-white/[0.01]">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-2 font-bold">
                  Affected Files ({data.affectedFiles.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.affectedFiles.slice(0, 6).map((file, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-indigo-300">
                      {file.split('/').pop()}
                    </span>
                  ))}
                  {data.affectedFiles.length > 6 && (
                    <span className="text-[10px] text-slate-500 px-2 py-1">+{data.affectedFiles.length - 6} more</span>
                  )}
                </div>
              </div>
            )}

            {data.affectedFunctions.length > 0 && (
              <div className="glass rounded-lg p-3 border border-white/5 bg-white/[0.01]">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-2 font-bold">
                  Affected Functions ({data.affectedFunctions.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.affectedFunctions.slice(0, 4).map((func, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-1 bg-violet-500/10 border border-violet-500/20 rounded text-violet-300">
                      {func}()
                    </span>
                  ))}
                  {data.affectedFunctions.length > 4 && (
                    <span className="text-[10px] text-slate-500 px-2 py-1">+{data.affectedFunctions.length - 4} more</span>
                  )}
                </div>
              </div>
            )}

            {data.affectedClasses.length > 0 && (
              <div className="glass rounded-lg p-3 border border-white/5 bg-white/[0.01]">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-2 font-bold">
                  Affected Classes ({data.affectedClasses.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.affectedClasses.slice(0, 4).map((cls, i) => (
                    <span key={i} className="text-[10px] font-mono px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-cyan-300">
                      {cls}
                    </span>
                  ))}
                  {data.affectedClasses.length > 4 && (
                    <span className="text-[10px] text-slate-500 px-2 py-1">+{data.affectedClasses.length - 4} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Source Badge */}
        <div className="text-[9px] text-slate-600 text-right font-mono">
          Data source: {data.source === 'neo4j' ? '🔄 Live Neo4j' : '📋 Mock Fallback'}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
