import { motion } from "framer-motion";

const spring = { type: "spring", stiffness: 120, damping: 18 };

function Metrics({ metrics }) {
  return (
    <div className="flex flex-wrap gap-2 mt-5">
      {metrics?.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.25 + i * 0.08 }}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10"
          data-testid={`metric-${m.label}`}
        >
          <div className="font-display text-lg leading-none text-white">
            {m.value}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mt-1">
            {m.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Overview({ f }) {
  return (
    <div className="mt-5 space-y-3">
      {f.languages.map((l, i) => (
        <div key={l.name}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/80">{l.name}</span>
            <span className="font-mono-plex text-[var(--muted)]">{l.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: l.color }}
              initial={{ width: 0 }}
              animate={{ width: `${l.pct}%` }}
              transition={{ ...spring, delay: 0.2 + i * 0.1 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function GraphViz() {
  const nodes = Array.from({ length: 16 }).map((_, i) => ({
    x: 30 + ((i * 53) % 260),
    y: 30 + ((i * 89) % 150),
    r: 4 + (i % 3) * 2,
  }));
  return (
    <svg viewBox="0 0 300 200" className="mt-4 w-full h-40">
      {nodes.map((n, i) =>
        i < nodes.length - 1 ? (
          <motion.line
            key={`l${i}`}
            x1={n.x}
            y1={n.y}
            x2={nodes[(i + 3) % nodes.length].x}
            y2={nodes[(i + 3) % nodes.length].y}
            stroke="#5B8CFF"
            strokeOpacity="0.35"
            strokeWidth="0.7"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
          />
        ) : null
      )}
      {nodes.map((n, i) => (
        <motion.circle
          key={`n${i}`}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={i % 4 === 0 ? "#E7B45A" : "#7DA3FF"}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...spring, delay: 0.1 + i * 0.05 }}
        />
      ))}
    </svg>
  );
}

function Search({ f }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/12">
        <span className="text-[var(--accent)]">⌕</span>
        <span className="font-mono-plex text-sm text-white/90">{f.query}</span>
        <motion.span
          className="w-[2px] h-4 bg-[var(--accent)]"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      </div>
      <div className="mt-3 space-y-2">
        {f.results.map((r, i) => (
          <motion.div
            key={r.file}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring, delay: 0.3 + i * 0.1 }}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-[rgba(91,140,255,0.12)] to-transparent border border-white/8"
          >
            <span className="font-mono-plex text-xs text-white/85">{r.file}</span>
            <span className="font-mono-plex text-[10px] text-[var(--accent-soft)]">
              {r.score}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Deps() {
  return (
    <div className="mt-4">
      <svg viewBox="0 0 300 150" className="w-full h-32">
        {[[60, 40], [220, 40], [140, 110], [40, 110], [250, 110]].map(
          ([x, y], i) => (
            <g key={i}>
              <motion.line
                x1={x}
                y1={y}
                x2={140}
                y2={75}
                stroke="#5B8CFF"
                strokeWidth="0.8"
                strokeOpacity="0.4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.1 }}
              />
              <motion.rect
                x={x - 22}
                y={y - 9}
                width="44"
                height="18"
                rx="4"
                fill="rgba(255,255,255,0.06)"
                stroke="#3a4568"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...spring, delay: 0.1 + i * 0.08 }}
              />
            </g>
          )
        )}
        <circle cx="140" cy="75" r="10" fill="#E7B45A" />
      </svg>
      <motion.div
        className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-full bg-[rgba(231,180,90,0.14)] border border-[rgba(231,180,90,0.4)]"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
        <span className="text-xs text-[var(--gold)]">
          3 circular dependencies detected
        </span>
      </motion.div>
    </div>
  );
}

function Arch({ f }) {
  const riskColor = { low: "#5FD3B0", med: "#E7B45A", high: "#FF7A7A" };
  return (
    <div className="mt-4 space-y-2">
      {f.recommendations.map((r, i) => (
        <motion.div
          key={r.text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.25 + i * 0.1 }}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] border border-white/8"
        >
          <span className="text-xs text-white/85">{r.text}</span>
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              color: riskColor[r.risk],
              background: `${riskColor[r.risk]}22`,
            }}
          >
            {r.risk}
          </span>
        </motion.div>
      ))}
      <div className="grid grid-cols-12 gap-1 mt-3">
        {Array.from({ length: 36 }).map((_, i) => (
          <motion.div
            key={i}
            className="aspect-square rounded-sm"
            style={{
              background: `rgba(${i % 5 === 0 ? "255,122,122" : i % 3 === 0 ? "231,180,90" : "95,211,176"},${0.2 + (i % 4) * 0.2})`,
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.015 }}
          />
        ))}
      </div>
    </div>
  );
}

function Chat({ f }) {
  return (
    <div className="mt-4 space-y-3">
      {f.conversation.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.3 + i * 0.35 }}
          className={`max-w-[92%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
            c.role === "user"
              ? "ml-auto bg-[rgba(91,140,255,0.2)] border border-[rgba(91,140,255,0.4)] text-white"
              : "bg-white/[0.05] border border-white/10 text-white/85"
          }`}
        >
          {c.text}
        </motion.div>
      ))}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {f.files.map((file, i) => (
          <motion.span
            key={file}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring, delay: 1.1 + i * 0.12 }}
            className="font-mono-plex text-[10px] px-2 py-1 rounded-md bg-[rgba(95,211,176,0.12)] border border-[rgba(95,211,176,0.35)] text-[#7fe0c2]"
          >
            {file}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

export default function CardPanel({ feature }) {
  return (
    <motion.div
      key={feature.id}
      initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
      transition={spring}
      className="glass-panel rounded-3xl p-6 w-[380px] max-w-[86vw]"
      data-testid={`card-panel-${feature.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono-plex text-xs text-[var(--accent)]">
          {feature.index}
        </span>
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
          RepoMind
        </span>
      </div>
      <h3 className="font-display text-2xl text-white mt-2">{feature.title}</h3>
      <p className="text-[var(--accent-soft)] text-sm mt-1">{feature.tagline}</p>
      <p className="text-[var(--muted)] text-[13px] leading-relaxed mt-2">
        {feature.description}
      </p>

      {feature.kind === "overview" && <Overview f={feature} />}
      {feature.kind === "graph" && <GraphViz />}
      {feature.kind === "search" && <Search f={feature} />}
      {feature.kind === "deps" && <Deps />}
      {feature.kind === "arch" && <Arch f={feature} />}
      {feature.kind === "chat" && <Chat f={feature} />}

      {(feature.kind === "graph" ||
        feature.kind === "search" ||
        feature.kind === "deps") && <Metrics metrics={feature.metrics} />}
    </motion.div>
  );
}
