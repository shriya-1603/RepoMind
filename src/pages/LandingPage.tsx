import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { motion } from "framer-motion";
import Scene from "../three/Scene";
import HeroOverlay from "../components/HeroOverlay";
import { setScrollProgress, setMouse } from "../lib/scrollStore";
import { FEATURES } from "../data/features";

const HERO_VH = 7.4;

const CHAPTERS = [
  {
    n: "01",
    title: "Onboarding is broken.",
    body: "New engineers spend weeks reverse-engineering systems nobody documented. RepoMind turns that first month into a first afternoon.",
  },
  {
    n: "02",
    title: "Structure is invisible.",
    body: "Codebases hide their true shape across thousands of files. We render the architecture as a living knowledge graph you can actually read.",
  },
  {
    n: "03",
    title: "Answers, grounded in code.",
    body: "No hallucinations. Every explanation is anchored to the exact files, symbols and relationships it came from.",
  },
];

function Editorial() {
  const navigate = useNavigate();
  return (
    <div className="relative z-20 bg-[var(--bg)]" data-testid="editorial">
      {/* Marquee */}
      <div className="border-y border-white/8 py-6 overflow-hidden bg-[var(--bg-2)]">
        <div className="flex whitespace-nowrap animate-marquee">
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center shrink-0">
              {[
                "Repository Intelligence",
                "Knowledge Graph",
                "Semantic Search",
                "Dependency Explorer",
                "Architecture Insights",
                "AI Repository Chat",
              ].map((t) => (
                <span
                  key={t}
                  className="font-display text-3xl sm:text-4xl px-8 text-white/25 flex items-center gap-8"
                >
                  {t}
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Manifesto chapters */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-28 sm:py-40">
        <p className="font-mono-plex text-xs uppercase tracking-[0.3em] text-[var(--accent)] mb-16">
          / Manifesto
        </p>
        <div className="space-y-28">
          {CHAPTERS.map((c) => (
            <motion.div
              key={c.n}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
              className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-6 md:gap-12 items-start"
              data-testid={`chapter-${c.n}`}
            >
              <span className="font-mono-plex text-sm text-[var(--muted)] pt-3">
                {c.n} / 03
              </span>
              <div>
                <h3 className="font-display text-4xl sm:text-6xl leading-[1.02] tracking-tight text-white">
                  {c.title}
                </h3>
                <p className="text-[var(--muted)] text-lg mt-6 max-w-2xl">
                  {c.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature recap grid */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 pb-32">
        <p className="font-mono-plex text-xs uppercase tracking-[0.3em] text-[var(--accent)] mb-12">
          / Six ways in
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                type: "spring",
                stiffness: 90,
                damping: 18,
                delay: (i % 3) * 0.08,
              }}
              className="glass-panel rounded-2xl p-6 group hover:-translate-y-1 transition-transform"
              data-testid={`recap-${f.id}`}
            >
              <span className="font-mono-plex text-xs text-[var(--accent)]">
                {f.index}
              </span>
              <h4 className="font-display text-2xl text-white mt-3">
                {f.title}
              </h4>
              <p className="text-[var(--muted)] text-sm mt-2">{f.tagline}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-white/8 py-32 text-center px-6">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
          className="font-display text-5xl sm:text-7xl text-gradient tracking-tight"
        >
          Understand everything.
        </motion.h2>
        <p className="text-[var(--muted)] text-lg mt-6">
          The repository intelligence platform for teams who ship.
        </p>
        <button
          data-testid="footer-launch-btn"
          onClick={() => navigate("/dashboard")}
          className="mt-10 px-8 py-4 rounded-full font-medium bg-[var(--accent)] text-[#04050A] accent-glow hover:brightness-110 transition-all text-lg"
        >
          Launch RepoMind →
        </button>
        <div className="mt-24 flex items-center justify-center gap-2.5 opacity-60">
          <span className="font-display text-white">{"</> RepoMind"}</span>
        </div>
        <p className="font-mono-plex text-xs text-[var(--muted)] mt-4">
          © 2026 RepoMind — A cinematic demo experience
        </p>
      </section>
    </div>
  );
}

export default function LandingPage() {
  const [inHero, setInHero] = useState(true);

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    let raf: number;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    lenis.on("scroll", ({ scroll: y }) => {
      const track = window.innerHeight * (HERO_VH - 1);
      const p = Math.min(1, Math.max(0, y / track));
      setScrollProgress(p);
      setInHero(y < track + window.innerHeight * 0.4);
    });

    const onMove = (e: PointerEvent) => {
      setMouse(
        (e.clientX / window.innerWidth - 0.5) * 2,
        -(e.clientY / window.innerHeight - 0.5) * 2
      );
    };
    window.addEventListener("pointermove", onMove);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="grain">
      {/* Pinned cinematic hero (fixed canvas + overlay) */}
      <div
        className="fixed inset-0 z-0 transition-opacity duration-500"
        style={{
          opacity: inHero ? 1 : 0,
          pointerEvents: inHero ? "auto" : "none",
        }}
      >
        <Scene />
        <HeroOverlay />
      </div>

      {/* Hero scroll track (drives the timeline) */}
      <div style={{ height: `${HERO_VH * 100}vh` }} aria-hidden />

      {/* Editorial content scrolls up over the scene */}
      <Editorial />
    </div>
  );
}
