import React from 'react';

/**
 * AmbientBackground
 * Very subtle dot grid + faint animated trace lines.
 * Communicates "repository topology" without distracting from content.
 * Zero pointer events — purely decorative.
 */
const AmbientBackground: React.FC = () => (
  <div
    className="fixed inset-0 overflow-hidden select-none pointer-events-none"
    style={{ zIndex: 0 }}
    aria-hidden="true"
  >
    {/* Dot grid */}
    <svg
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="rm-ambient-grid"
          x="0"
          y="0"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="0.5" cy="0.5" r="0.6" fill="rgba(245,232,216,0.065)" />
        </pattern>

        {/* Faint trace line gradient */}
        <linearGradient id="rm-trace-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,69,0,0)" />
          <stop offset="40%" stopColor="rgba(255,69,0,0.05)" />
          <stop offset="100%" stopColor="rgba(255,69,0,0)" />
        </linearGradient>
        <linearGradient id="rm-trace-b" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,111,97,0)" />
          <stop offset="50%" stopColor="rgba(255,111,97,0.04)" />
          <stop offset="100%" stopColor="rgba(255,111,97,0)" />
        </linearGradient>
      </defs>

      {/* Fill grid */}
      <rect width="100%" height="100%" fill="url(#rm-ambient-grid)" />

      {/* Trace line A — diagonal */}
      <line
        x1="15%"
        y1="0%"
        x2="85%"
        y2="100%"
        stroke="url(#rm-trace-a)"
        strokeWidth="1"
        style={{
          animation: 'rm-trace-drift-a 18s ease-in-out infinite alternate',
        }}
      />

      {/* Trace line B */}
      <line
        x1="70%"
        y1="0%"
        x2="30%"
        y2="100%"
        stroke="url(#rm-trace-b)"
        strokeWidth="1"
        style={{
          animation: 'rm-trace-drift-b 24s ease-in-out infinite alternate',
        }}
      />
    </svg>

    {/* Radial glow background — toned down to complete dark neutral */}
    <div
      className="absolute inset-0"
      style={{
        background: '#060606',
      }}
    />

    {/* Radial vignette — darkens edges */}
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 100% 70% at 50% 50%, transparent 95%, rgba(0,0,0,0.95) 100%)',
      }}
    />

    <style>{`
      @keyframes rm-trace-drift-a {
        0%   { opacity: 0.4; transform: translateX(-8px); }
        100% { opacity: 0.8; transform: translateX(8px); }
      }
      @keyframes rm-trace-drift-b {
        0%   { opacity: 0.6; transform: translateX(6px); }
        100% { opacity: 0.3; transform: translateX(-6px); }
      }
    `}</style>
  </div>
);

export default AmbientBackground;
