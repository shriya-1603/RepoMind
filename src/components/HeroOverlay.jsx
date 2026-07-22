import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  useScrollProgress,
  activeCardFromProgress,
  usePanelSide,
} from "../lib/scrollStore";
import { FEATURES } from "../data/features";
import CardPanel from "./CardPanel";

const words = ["Turning", "repositories", "into memory."];

export default function HeroOverlay() {
  const navigate = useNavigate();
  const p = useScrollProgress();
  const side = usePanelSide();
  const active = activeCardFromProgress(p);
  const feature = active.index >= 0 ? FEATURES[active.index] : null;

  const introOpacity = Math.max(0, 1 - p / 0.09);
  const introVisible = introOpacity > 0.02;
  const outroVisible = p > 0.955;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Top nav */}
      <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-10 py-6 pointer-events-auto">
        <div
          className="flex items-center gap-2.5"
          data-testid="brand-logo"
          style={{ opacity: Math.max(0, 1 - introOpacity * 3) }}
        >
          <span
            className="font-display text-2xl font-bold tracking-tight text-white"
          >
            {"</> RepoMind"}
          </span>
        </div>
        <button
          data-testid="nav-cta"
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 rounded-full text-sm font-medium bg-white/[0.06] border border-white/12 text-white hover:bg-white/[0.12] transition-colors"
        >
          Open Dashboard
        </button>
      </nav>

      {/* Large centered "RepoMind" — prominent at scroll=0, fades as user scrolls */}
      {introVisible && (
        <div
          className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none"
          style={{ opacity: introOpacity, paddingTop: "clamp(1rem, 3vh, 2rem)" }}
        >
          <motion.span
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="font-display font-black tracking-tight text-gradient select-none leading-none"
            style={{ fontSize: "clamp(3.5rem, 9vw, 7.5rem)" }}
          >
            {"</> RepoMind"}
          </motion.span>
        </div>
      )}

      {/* Intro headline — left-side tagline + animated words + CTA */}
      {introVisible && (
        <div
          className="absolute left-6 sm:left-14 top-1/2 -translate-y-1/2 max-w-xl pointer-events-auto"
          style={{ opacity: introOpacity }}
        >
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-mono-plex text-xs uppercase tracking-[0.3em] text-[var(--accent)] mb-5"
          >
            // AI-Powered Repository Analysis Engine
          </motion.p>
          <h1 className="font-display text-6xl sm:text-7xl lg:text-8xl leading-[0.95] tracking-tight">
            {words.map((w, i) => (
              <span key={i} className="block overflow-hidden">
                <motion.span
                  className="block text-gradient"
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{
                    delay: 0.35 + i * 0.09,
                    type: "spring",
                    stiffness: 90,
                    damping: 16,
                  }}
                >
                  {w}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-[var(--muted)] text-base sm:text-lg mt-6 max-w-md"
          >
            RepoMind parses your repository’s AST, maps every file, function,
            and import into a live Neo4j knowledge graph, then runs an
            AI-powered pipeline to surface architecture insights, dependency
            risks, and grounded answers — in under 60 seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05 }}
            className="flex items-center gap-4 mt-9"
          >
            <button
              data-testid="hero-explore-btn"
              onClick={() => navigate("/dashboard")}
              className="group px-6 py-3 rounded-full font-medium bg-[var(--accent)] text-[#04050A] accent-glow hover:brightness-110 transition-all"
            >
              Get Started
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
            <span className="font-mono-plex text-xs text-[var(--muted)] flex items-center gap-2">
              <motion.span
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
              >
                ↓
              </motion.span>
              Scroll to explore features
            </span>
          </motion.div>
        </div>
      )}

      {/* Active feature panel — sits opposite the hero */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 pointer-events-auto transition-all duration-500 ${
          side === "left" ? "left-6 sm:left-14" : "right-6 sm:right-14"
        }`}
      >
        <AnimatePresence mode="wait">
          {feature && <CardPanel key={feature.id} feature={feature} />}
        </AnimatePresence>
      </div>

      {/* Chapter progress */}
      {!introVisible && !outroVisible && (
        <div className="absolute left-6 sm:left-14 bottom-10 pointer-events-none" data-testid="chapter-progress">
          <div className="flex items-center gap-2 mb-3">
            {FEATURES.map((f, i) => (
              <span
                key={f.id}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: active.index === i ? 28 : 10,
                  background:
                    active.index === i
                      ? "var(--accent)"
                      : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
          <div className="font-mono-plex text-xs text-[var(--muted)]">
            {String(Math.round(p * 100)).padStart(2, "0")}% —{" "}
            {feature ? feature.title : "Orbiting"}
          </div>
        </div>
      )}

      {/* Outro CTA */}
      <AnimatePresence>
        {outroVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-auto"
            style={{
              background:
                "radial-gradient(ellipse 72% 62% at 50% 50%, rgba(4,5,10,0.92) 10%, rgba(4,5,10,0.72) 52%, transparent 82%)",
            }}
            data-testid="outro-cta"
          >
            <h2
              className="font-display text-4xl sm:text-6xl text-white tracking-tight"
              style={{ textShadow: "0 2px 24px rgba(0,0,0,1), 0 0 48px rgba(0,0,0,0.85)" }}
            >
              Meet RepoMind.
            </h2>
            <p
              className="text-white/85 mt-4 max-w-sm leading-relaxed text-base sm:text-lg"
              style={{ textShadow: "0 1px 12px rgba(0,0,0,1)" }}
            >
              Drop in a GitHub URL. Get a complete architecture map, dependency
              graph, semantic search, and AI insights — instantly.
            </p>
            <button
              data-testid="launch-btn"
              onClick={() => navigate("/dashboard")}
              className="mt-8 px-8 py-3.5 rounded-full font-medium bg-[var(--accent)] text-[#04050A] accent-glow hover:brightness-110 transition-all"
            >
              Launch RepoMind →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
