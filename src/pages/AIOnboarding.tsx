import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, ChevronRight, ChevronLeft, CheckCircle, FileCode,
  BookOpen, Code2, Cpu, TestTube, Shield, Send, Sparkles, Layers, ArrowRight, Loader2
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { mockOnboardingSteps } from '../data/mockRepositoryData';
import type { OnboardingStep } from '../data/mockRepositoryData';
import { useRepo } from '../contexts/RepoContext';
import { useRepositorySummaryReal } from '../hooks/useRepositorySummaryReal';

// ── Step Icons ─────────────────────────────────────────────────────────────
const stepIcons: React.ComponentType<any>[] = [Layers, Cpu, ArrowRight, FileCode, TestTube];

// ── Stepper Circular Progress Ring ─────────────────────────────────────────
const StepperProgressRing: React.FC<{ state: 'done' | 'active' | 'pending'; percent: number }> = ({ state, percent }) => {
  const r = 18;
  const strokeWidth = 2.5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const strokeColor = state === 'done' ? '#4ADE80' : state === 'active' ? '#FF4500' : 'rgba(255,255,255,0.05)';

  return (
    <svg viewBox="0 0 42 42" className="w-10 h-10 absolute inset-0 -rotate-90 select-none pointer-events-none">
      <circle cx="21" cy="21" r={r} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth={strokeWidth} />
      {state !== 'pending' && (
        <motion.circle
          cx="21"
          cy="21"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: state === 'active' ? 'drop-shadow(0 0 3px rgba(255,69,0,0.5))' : 'none' }}
        />
      )}
    </svg>
  );
};

// ── Progress Stepper ──────────────────────────────────────────────────────
const Stepper: React.FC<{ steps: OnboardingStep[]; currentIdx: number; onClick: (i: number) => void }> = ({
  steps, currentIdx, onClick,
}) => {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((step, i) => {
        const Icon = stepIcons[i] ?? Cpu;
        const state = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
        
        // Circular progress calculations
        const completedPercent = (currentIdx / steps.length) * 100;
        const percent = state === 'done' ? 100 : state === 'active' ? completedPercent : 0;

        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => onClick(i)}
              className="flex flex-col items-center gap-1.5 group flex-shrink-0"
            >
              <div className="relative w-10 h-10 flex items-center justify-center">
                <StepperProgressRing state={state} percent={percent} />
                <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center transition-all duration-300 z-10 ${
                  state === 'done'   ? 'bg-emerald-500/10 border border-emerald-500/20' :
                  state === 'active' ? 'bg-[#FF4500]/15 border border-[#FF4500]/30 shadow-md' :
                                       'bg-white/[0.02] border border-white/12'
                }`}>
                  {state === 'done' ? (
                    <CheckCircle size={13} className="text-emerald-400" />
                  ) : (
                    <Icon size={13} className={state === 'active' ? 'text-[#FF4500]' : 'text-slate-500'} />
                  )}
                </div>
              </div>
              <span className={`text-[9px] font-semibold font-mono uppercase tracking-wider ${
                state === 'active' ? 'text-[#FF4500]' : state === 'done' ? 'text-emerald-400' : 'text-slate-700'
              }`}>
                {step.title.split(' ')[0]}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 min-w-[30px] h-px mb-4 transition-all duration-500 ${i < currentIdx ? 'bg-emerald-500/50' : 'bg-white/5'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Chat Messages ─────────────────────────────────────────────────────────
interface ChatMsg { role: 'user' | 'ai'; text: string; }

const AI_RESPONSES: Record<string, string> = {
  default: "I can answer any question about this codebase. Try asking about the architecture, key files, testing approach, or anything else!",
  architecture: "The codebase follows a **feature-slice architecture** with React 18, TypeScript, and Vite. Core state is split between React Query (server), Zustand (client), and React Context (theme/auth).",
  testing: "Tests use Jest + Testing Library for unit/integration, and Playwright for E2E. Current coverage is **78.4%**, with a CI gate at 70% minimum. Run `npm test` to execute all 166 tests.",
  auth: "Authentication uses JWT stored in localStorage. The `AuthContext` validates on mount via jwtDecode, and the Axios interceptor attaches tokens to every request automatically.",
};

// ── Markdown Formatter ────────────────────────────────────────────────────
const FormattedAnswer: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded text-[10px] border border-cyan-500/15">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// ── File Key Pill ─────────────────────────────────────────────────────────
const FilePill: React.FC<{ path: string }> = ({ path }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass border border-white/12 font-mono text-[10px] text-[#FF6F61]">
    <FileCode size={9} />
    {path.includes('/') ? path.split('/').pop() : path}
  </span>
);

// ── Mini Dependency Minimap (StepMiniGraph) ────────────────────────────────
const StepMiniGraph: React.FC<{ keyFiles: string[] }> = ({ keyFiles }) => {
  if (!keyFiles || keyFiles.length === 0) return null;

  const nodeCoords = [
    { x: 90,  y: 40 },
    { x: 40,  y: 110 },
    { x: 140, y: 110 },
    { x: 90,  y: 180 }
  ];

  const nodes = keyFiles.slice(0, 4).map((file, i) => {
    const isMain = i === 0;
    const ext = file.split('.').pop() || '';
    const color = ext === 'tsx' ? '#FF4500' : ext === 'ts' ? '#DAA520' : '#FF6F61';
    const name = file.split('/').pop() || file;
    return { name, isMain, color, ...nodeCoords[i] };
  });

  return (
    <div className="glass rounded-2xl p-4 border border-white/12 bg-white/[0.005] w-full max-w-[190px] h-[220px] flex flex-col justify-between shadow-2xl ml-auto">
      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold border-b border-white/12 pb-1 block text-left">
        Dependency Map
      </span>
      
      <svg viewBox="0 0 180 210" className="w-full h-full">
        {nodes.slice(1).map((node, i) => (
          <g key={i}>
            <line x1={nodes[0].x} y1={nodes[0].y} x2={node.x} y2={node.y} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
            <line x1={nodes[0].x} y1={nodes[0].y} x2={node.x} y2={node.y} stroke="rgba(255, 69, 0, 0.15)" strokeWidth="1" strokeDasharray="3 4" />
          </g>
        ))}

        {nodes.map((n, i) => (
          <g key={i}>
            {n.isMain && (
              <motion.circle
                cx={n.x} cy={n.y} r="12" fill="none" stroke={n.color} strokeWidth="1" strokeOpacity="0.4"
                animate={{ scale: [0.9, 1.3, 0.9], opacity: [0.15, 0.5, 0.15] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            )}
            <circle cx={n.x} cy={n.y} r="6.5" fill="#0f172a" stroke={n.color} strokeWidth="1.5" style={{ filter: n.isMain ? `drop-shadow(0 0 4px ${n.color}60)` : 'none' }} />
            <circle cx={n.x} cy={n.y} r="2" fill={n.color} />
            
            <rect x={n.x - 28} y={n.y + 9} width="56" height="12" rx="3.5" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <text x={n.x} y={n.y + 17} fill="#94a3b8" fontSize="6.5" fontFamily="monospace" textAnchor="middle" className="select-none font-bold">
              {n.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ── Content Renderer ──────────────────────────────────────────────────────
interface StepContentProps {
  step: OnboardingStep;
  isLastStep: boolean;
}
const StepContent: React.FC<StepContentProps> = ({ step, isLastStep }) => {
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const quizQuestions = [
    {
      q: 'What state management solution is used for server state?',
      options: ['Redux', 'React Query', 'Zustand', 'MobX'],
      correct: 1
    },
    {
      q: 'What is the current test coverage?',
      options: ['45%', '67%', '78.4%', '95%'],
      correct: 2
    },
    {
      q: 'How many direct dependents does api.ts have?',
      options: ['3', '5', '7', '12'],
      correct: 2
    }
  ];

  return (
    <div className="space-y-5">
      {/* Main Content */}
      <div className="text-xs text-slate-400 leading-relaxed font-light">
        {step.content.split('\n\n').map((para, i) => (
          <p key={i} className="mb-3"><FormattedAnswer text={para} /></p>
        ))}
      </div>

      {/* Code Snippet */}
      {step.codeSnippet && (
        <div className="glass rounded-xl overflow-hidden border border-white/6 bg-white/[0.005]">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border-b border-white/5">
            <Code2 size={12} className="text-slate-500" />
            <span className="text-[9px] text-slate-655 font-mono">TypeScript / ES6</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-400 leading-relaxed overflow-x-auto whitespace-pre">
            {step.codeSnippet}
          </pre>
        </div>
      )}

      {/* Key Files */}
      {step.keyFiles.length > 0 && (
        <div className="pt-2">
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono font-bold">
            <BookOpen size={9} />
            Key Files Reference
          </div>
          <div className="flex flex-wrap gap-2">
            {step.keyFiles.map(f => <FilePill key={f} path={f} />)}
          </div>
        </div>
      )}

      {/* Final Step Badge */}
      {isLastStep && (
        <div className="glass-emerald rounded-xl p-4 flex items-center gap-3 border border-emerald-500/25 bg-emerald-500/[0.01]">
          <CheckCircle size={20} className="text-emerald-400 flex-shrink-0 animate-pulse" />
          <div className="text-left">
            <div className="text-sm font-semibold text-emerald-300">Onboarding Complete!</div>
            <p className="text-xs text-slate-550 mt-0.5 leading-relaxed font-light">You're now ready to contribute to this codebase with confidence.</p>
          </div>
        </div>
      )}

      {/* Generate Quiz Section */}
      {isLastStep && (
        <div className="space-y-4 pt-4 border-t border-white/5">
          {!showQuiz ? (
            <button
              onClick={() => setShowQuiz(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-glow-emerald flex items-center gap-2 active:scale-95 ml-auto"
            >
              <Sparkles size={13} /> Test Your Knowledge (Quiz)
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass rounded-2xl p-4 border border-[#FF4500]/25 bg-black/95 space-y-4 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-white/12 pb-2">
                <span className="text-xs font-bold text-[#FF6F61] font-mono">RepoMind Competency Quiz</span>
                <button onClick={() => setShowQuiz(false)} className="text-[9px] text-slate-500 hover:text-slate-350 font-semibold">[Close Quiz]</button>
              </div>
              
              <div className="space-y-4">
                {quizQuestions.map((item, qIdx) => (
                  <div key={qIdx} className="space-y-2">
                    <div className="text-xs font-semibold text-slate-200 font-sans">{qIdx+1}. {item.q}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {item.options.map((opt, oIdx) => {
                        const isSelected = quizAnswers[qIdx] === oIdx;
                        const isCorrect = item.correct === oIdx;
                        let btnCls = "glass border-white/12 hover:border-white/20 text-slate-400 bg-white/[0.005]";
                        
                        if (quizSubmitted) {
                          if (isCorrect) {
                            btnCls = "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold shadow-md shadow-emerald-950/10";
                          } else if (isSelected) {
                            btnCls = "bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold shadow-md shadow-rose-950/10";
                          } else {
                            btnCls = "opacity-30 border border-white/12 text-slate-655";
                          }
                        } else if (isSelected) {
                          btnCls = "bg-[#FF4500]/15 border border-[#FF4500]/40 text-[#FF6F61] font-bold shadow-md shadow-[#FF4500]/10";
                        }

                        return (
                          <button
                            key={oIdx}
                            disabled={quizSubmitted}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }))}
                            className={`px-3 py-2 text-left rounded-xl text-xs transition-all active:scale-95 ${btnCls}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {!quizSubmitted ? (
                <button
                  onClick={() => setQuizSubmitted(true)}
                  disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                  className="w-full py-2.5 bg-[#FF4500] hover:bg-[#FF6F61] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-md"
                >
                  Submit Answers
                </button>
              ) : (
                <div className="pt-2 border-t border-white/12 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">
                    Result Score:{' '}
                    <strong className="text-slate-200">
                      {quizQuestions.reduce((acc, curr, i) => acc + (quizAnswers[i] === curr.correct ? 1 : 0), 0)} / {quizQuestions.length} Correct
                    </strong>
                  </span>
                  <button
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                    }}
                    className="text-[10px] text-[#FF6F61] font-bold hover:underline"
                  >
                    Retry Quiz
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

// ── AI Onboarding Page ────────────────────────────────────────────────────
const AIOnboarding: React.FC = () => {
  const { analysisId, repoName } = useRepo();
  const [stepIdx, setStepIdx] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'ai', text: "I'm RepoMind's onboarding assistant. I'll guide you through the codebase architecture. Click through the steps above, or ask me anything!" },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Fetch repository architect summary — only when a real analysisId exists
  const architectSummary = useRepositorySummaryReal(analysisId ?? null);

  // Compute steps dynamically from architectSummary onboardingPath or mock steps
  const steps: OnboardingStep[] = React.useMemo(() => {
    if (analysisId && architectSummary && architectSummary.data) {
      if (architectSummary.data.onboardingPath && architectSummary.data.onboardingPath.length > 0) {
        return architectSummary.data.onboardingPath.map((path: any, idx: number) => ({
          id: `step-${idx}`,
          title: path.title,
          readTime: '3 min',
          icon: idx === 0 ? 'Layers' : idx === 1 ? 'Cpu' : idx === 2 ? 'ArrowRight' : idx === 3 ? 'FileCode' : 'TestTube',
          content: `${path.description}\n\n**Rationale:** ${path.rationale}`,
          keyFiles: path.keyFiles || [],
          codeSnippet: '',
        }));
      }
      return [];
    }
    return mockOnboardingSteps;
  }, [analysisId, architectSummary]);

  const currentStep = steps[stepIdx];
  const isLast = steps.length > 0 ? (stepIdx === steps.length - 1) : true;

  const handleAsk = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 1200));
    const lower = q.toLowerCase();
    const answer =
      lower.includes('test') ? AI_RESPONSES.testing :
      lower.includes('auth') ? AI_RESPONSES.auth :
      lower.includes('architect') || lower.includes('overview') ? AI_RESPONSES.architecture :
      AI_RESPONSES.default;
    setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    setIsTyping(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans relative">
      {/* Scan line overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 opacity-[0.015]" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 6px 100%' }} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[40px] font-extrabold text-[#F5F5F5] flex items-center gap-3 font-[Syne] leading-none"
          >
            <div className="w-10 h-10 rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/20 flex items-center justify-center text-[#4ADE80]">
              <Bot size={18} className="animate-pulse" />
            </div>
            Engineer Onboarding
          </motion.h1>
          <p className="text-[#A0A0A0] text-xs mt-2.5">
            {repoName
              ? <>Start Here · Estimated: 8 minutes · Active workspace: <span className="font-mono text-[#FFB347]">{repoName}</span></>
              : 'Import a repository to generate your personalized onboarding guide'
            }
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Shield size={14} className="text-[#4ADE80]" />
          <span className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-widest font-bold">
            {analysisId && architectSummary && architectSummary.data ? `${100 - architectSummary.data.overallRiskScore}%` : '85%'} Onboarding Readiness
          </span>
        </div>
      </div>

      {analysisId && architectSummary.loading ? (
        <div className="flex flex-col items-center justify-center p-12 glass border border-white/5 rounded-3xl gap-4">
          <Loader2 size={36} className="text-indigo-400 animate-spin" />
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-200">Generating developer onboarding path...</h3>
            <p className="text-xs text-slate-500 mt-1">Analyzing codebase modules and semantic dependencies.</p>
          </div>
        </div>
      ) : analysisId && steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 glass border border-white/5 rounded-3xl gap-4">
          <Shield size={36} className="text-indigo-400 animate-pulse" />
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-205">Not enough repository intelligence available.</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Onboarding guides are generated dynamically from Neo4j repository intelligence graphs.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Step Tracker */}
          <GlassCard delay={0.1} padding="md">
            <Stepper steps={steps} currentIdx={stepIdx} onClick={setStepIdx} />
          </GlassCard>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Step Content */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <GlassCard padding="lg" animate={false}>
                    {/* Step Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center text-2xl animate-pulse">
                          💡
                        </div>
                        <div>
                          <div className="text-[9px] font-mono text-slate-550 uppercase tracking-wider mb-0.5">
                            Step {stepIdx + 1} of {steps.length}
                          </div>
                          <h2 className="text-base font-bold text-slate-100 font-[Syne]">{currentStep.title}</h2>
                        </div>
                      </div>

                      {/* Estimated read time badge */}
                      <span className="badge badge-indigo text-[9px] font-mono select-none flex items-center gap-1 self-start sm:self-center font-bold">
                        ⏱ Est. read time: ~{currentStep.readTime}
                      </span>
                    </div>

                    {/* Grid Split Content & StepMiniGraph (only on desktop lg) */}
                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-1">
                        <StepContent step={currentStep} isLastStep={isLast} />
                      </div>
                      {currentStep.keyFiles.length > 0 && (
                        <div className="hidden lg:block w-48 flex-shrink-0">
                          <StepMiniGraph keyFiles={currentStep.keyFiles} />
                        </div>
                      )}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-5 border-t border-white/5">
                      <motion.button
                        onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
                        disabled={stepIdx === 0}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-xs font-semibold text-slate-450 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft size={14} />
                        Previous
                      </motion.button>

                      <div className="flex gap-1.5 select-none">
                        {steps.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setStepIdx(i)}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              i === stepIdx ? 'w-4 bg-indigo-500' : i < stepIdx ? 'bg-emerald-500/60' : 'bg-white/15'
                            }`}
                          />
                        ))}
                      </div>

                      <motion.button
                        onClick={() => setStepIdx(Math.min(steps.length - 1, stepIdx + 1))}
                        disabled={isLast}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                      >
                        Next
                        <ChevronRight size={14} />
                      </motion.button>
                    </div>
                  </GlassCard>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* AI Chat */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              <GlassCard animate={false} padding="none" className="flex-1 flex flex-col bg-white/[0.005]">
                {/* Chat Header */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5 bg-white/[0.01]">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-glow-indigo">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-200">Ask RepoMind</div>
                <div className="text-[9px] text-emerald-450 flex items-center gap-1 font-semibold font-mono">
                  <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  Onboarding bot online
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[380px] bg-white/[0.002]">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === 'ai' ? 'bg-gradient-to-br from-indigo-500 to-violet-600' : 'bg-slate-700'
                  }`}>
                    {msg.role === 'ai' ? <Bot size={13} className="text-white" /> : <Sparkles size={11} className="text-slate-350" />}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed text-left ${
                    msg.role === 'user'
                      ? 'glass-indigo rounded-tr-sm text-slate-200'
                      : 'glass rounded-tl-sm text-slate-400 font-light'
                  }`}>
                    <FormattedAnswer text={msg.text} />
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <Bot size={13} className="text-white animate-pulse" />
                  </div>
                  <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                    {[0, 1, 2].map(j => (
                      <motion.div
                        key={j}
                        className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Chat Input */}
            <div className="px-3 pb-4 pt-2 bg-white/[0.005] border-t border-white/5">
              <div className="flex items-center gap-2 glass rounded-xl border border-white/8 px-3 py-2 focus-within:border-indigo-500/40 transition-all bg-white/[0.01]">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAsk()}
                  placeholder="Ask onboarding assistant..."
                  className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-655 focus:outline-none"
                />
                <motion.button
                  onClick={handleAsk}
                  disabled={!chatInput.trim() || isTyping}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center disabled:opacity-30 transition-all active:scale-95 shadow-md"
                >
                  <Send size={12} className="text-white" />
                </motion.button>
              </div>
            </div>
          </GlassCard>
          </div>
        </div>
        </>
      )}

      {/* Repository Architect Panels */}
      {architectSummary.data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* AI Summary */}
          <GlassCard variant="indigo" padding="md" animate={false}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-indigo-300">Architecture Summary</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{architectSummary.data.aiSummary}</p>
            </div>
          </GlassCard>

          {/* Architecture Modules Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Layers size={12} className="text-violet-400" />
              Architecture Modules
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {architectSummary.data.majorModules.map((module, i) => (
                <motion.div
                  key={module.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-xl p-3 border border-white/5 bg-white/[0.01]"
                >
                  <div className="text-[10px] font-mono font-bold text-violet-400 mb-1">{module.name}</div>
                  <div className="space-y-1">
                    <div className="text-[9px] text-slate-500">
                      <span className="text-slate-400 font-bold">{module.fileCount}</span> files
                    </div>
                    <div className="text-[9px] text-slate-500">
                      <span className="text-slate-400 font-bold">{module.functionCount}</span> functions
                    </div>
                    <div className="text-[9px] text-slate-500">
                      <span className="text-slate-400 font-bold">{module.classCount}</span> classes
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-600 mt-2 leading-tight">{module.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Hotspots Panel */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Most Depended-On Files */}
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileCode size={12} className="text-cyan-400" />
                Critical Files
              </h3>
              <div className="space-y-2">
                {architectSummary.data.mostDependedOnFiles.slice(0, 3).map((file, i) => (
                  <motion.div
                    key={file.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-lg p-3 border border-white/5 bg-cyan-500/[0.01]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono font-bold text-cyan-300">{file.name}</div>
                        <div className="text-[8px] text-slate-600 mt-1">{file.dependencyCount} dependents</div>
                      </div>
                      <div className="text-xs font-bold text-cyan-400">{(file.criticality * 100).toFixed(0)}%</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Most Depended-On Functions */}
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Code2 size={12} className="text-violet-400" />
                Core Functions
              </h3>
              <div className="space-y-2">
                {architectSummary.data.mostDependedOnFunctions.slice(0, 3).map((func, i) => (
                  <motion.div
                    key={func.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-lg p-3 border border-white/5 bg-violet-500/[0.01]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono font-bold text-violet-300">{func.name}()</div>
                        <div className="text-[8px] text-slate-600 mt-1">{func.dependencyCount} calls</div>
                      </div>
                      <div className="text-xs font-bold text-violet-400">{(func.criticality * 100).toFixed(0)}%</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Most Depended-On Classes */}
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Cpu size={12} className="text-emerald-400" />
                Core Classes
              </h3>
              <div className="space-y-2">
                {architectSummary.data.mostDependedOnClasses.slice(0, 3).map((cls, i) => (
                  <motion.div
                    key={cls.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass rounded-lg p-3 border border-white/5 bg-emerald-500/[0.01]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono font-bold text-emerald-300">{cls.name}</div>
                        <div className="text-[8px] text-slate-600 mt-1">{cls.complexity} methods</div>
                      </div>
                      <div className="text-xs font-bold text-emerald-400">{(cls.criticality * 100).toFixed(0)}%</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Areas Panel */}
          {architectSummary.data.riskAreas.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Shield size={12} className="text-orange-400" />
                Risk Areas ({architectSummary.data.overallRiskScore}/100)
              </h3>
              <div className="space-y-2">
                {architectSummary.data.riskAreas.map((risk, i) => {
                  const colors = {
                    low: { bg: 'bg-emerald-500/[0.01]', border: 'border-emerald-500/20', text: 'text-emerald-300' },
                    medium: { bg: 'bg-yellow-500/[0.01]', border: 'border-yellow-500/20', text: 'text-yellow-300' },
                    high: { bg: 'bg-orange-500/[0.01]', border: 'border-orange-500/20', text: 'text-orange-300' },
                    critical: { bg: 'bg-rose-500/[0.01]', border: 'border-rose-500/20', text: 'text-rose-300' },
                  };
                  const color = colors[risk.severity];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`glass rounded-lg p-3 border ${color.border} ${color.bg}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className={`text-[10px] font-mono font-bold ${color.text}`}>
                          {risk.type.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <span className={`badge text-[8px] font-bold ${
                          risk.severity === 'critical' ? 'badge-red' :
                          risk.severity === 'high' ? 'badge-orange' :
                          risk.severity === 'medium' ? 'badge-yellow' :
                          'badge-green'
                        }`}>{risk.severity}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 mb-2">{risk.description}</p>
                      <p className="text-[8px] text-slate-600 italic">💡 {risk.recommendation}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overall Risk Score Indicator */}
          <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/5 bg-white/[0.01]">
            <div>
              <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Overall Risk Score</div>
              <div className="text-sm text-slate-300 mt-1">This codebase has a <strong>medium risk</strong> profile.</div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-3xl font-bold font-mono">{architectSummary.data.overallRiskScore}</div>
              <div className="text-[9px] text-slate-600">/100</div>
            </div>
          </div>

          {/* Mock/Real Data Source Indicator */}
          {architectSummary.data.source === 'mock' && (
            <div className="text-[9px] text-slate-600 text-center font-mono">
              Data source: 📋 Mock Fallback
            </div>
          )}
        </motion.div>
      )}

      {/* Loading State for Architect Data */}
      {architectSummary.loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-xl p-8 border border-white/5 flex flex-col items-center justify-center gap-3"
        >
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-indigo-400"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">Analyzing repository architecture...</span>
        </motion.div>
      )}

      {/* Error State for Architect Data */}
      {architectSummary.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-xl p-4 border border-rose-500/30 bg-rose-500/[0.01]"
        >
          <div className="text-xs text-rose-300">⚠️ {architectSummary.error}</div>
        </motion.div>
      )}
    </div>
  );
};

export default AIOnboarding;
