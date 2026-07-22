import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';

interface ComingSoonProps {
  featureName: string;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({ featureName }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[450px] text-center p-8 bg-[#04050A]/40 border border-white/6 rounded-2xl backdrop-blur-md">
      <div className="relative mb-6">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 opacity-30 blur-lg animate-pulse" />
        <div className="relative p-4 bg-slate-900 border border-white/8 rounded-full text-indigo-400">
          <Sparkles className="w-8 h-8" />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-white tracking-tight">{featureName}</h2>
      <p className="text-slate-400 text-sm max-w-md mt-3 leading-relaxed">
        This feature is under active development. Our agentic intelligence is mapping out the graph layers. Check back soon.
      </p>
      
      <button
        onClick={() => navigate('/dashboard')}
        className="mt-8 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </button>
    </div>
  );
};
