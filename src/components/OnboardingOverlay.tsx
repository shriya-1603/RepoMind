import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, HelpCircle, Eye, GitMerge, X } from 'lucide-react';

interface OnboardingOverlayProps {
  onClose?: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('repomind_seen_explorer_onboarding');
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('repomind_seen_explorer_onboarding', 'true');
    setIsVisible(false);
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-lg glass border border-white/10 rounded-2xl p-6 shadow-3xl text-left bg-slate-950/90"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Map className="text-[#FF6B1A]" size={20} />
                <h3 className="font-[Syne] font-bold text-base text-slate-100">Welcome to System Explorer</h3>
              </div>
              <button 
                onClick={handleDismiss}
                className="text-slate-500 hover:text-slate-200 transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-slate-350 text-xs leading-relaxed">
              <p>
                RepoMind reconstructs codebase structures into a spatial map of subsystems. Here is how you can walk through the system:
              </p>

              <div className="grid gap-3 pt-2">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#FF6B1A]/10 border border-[#FF6B1A]/20 flex items-center justify-center text-[#FF6B1A] flex-shrink-0">
                    <Map size={13} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200 mb-0.5">Explore Subsystems</h4>
                    <p>Each block represents a major architectural area. Click on a block to read its purpose, entry points, and dependencies.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                    <Eye size={13} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200 mb-0.5">Drill-Down to Files</h4>
                    <p>Expand a subsystem chevron to see its files emerge in a clean structured grid inside the block. Viewport zooms in automatically.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                    <GitMerge size={13} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200 mb-0.5">Spotlight Dependency Flows</h4>
                    <p>Select a file node to isolate it. Direct dependency imports and calls stay bright while the rest of the map fades away.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/5 pt-4 mt-5">
              <button
                onClick={handleDismiss}
                className="px-5 py-2 bg-[#FF6B1A] hover:bg-[#E05300] text-white rounded-xl text-xs font-semibold font-[Syne] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#FF6B1A]/10"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
