export const FEATURES = [
  {
    id: "overview",
    index: "01",
    title: "Repository Overview",
    tagline: "Zero to full architecture map in under 30 seconds.",
    description:
      "Point RepoMind at any GitHub repository. It clones the source, runs a language-aware AST parser across every file, and compiles a structured snapshot of your entire codebase — files, functions, module hierarchy, language distribution, and contributor map — before you've had time to read the README.",
    kind: "overview",
    metrics: [
      { label: "Index time", value: "< 30s" },
      { label: "AST depth", value: "Full tree" },
      { label: "Languages", value: "Py · TS · JS" },
    ],
    languages: [
      { name: "Python", pct: 52, color: "#E7B45A" },
      { name: "TypeScript", pct: 30, color: "#5B8CFF" },
      { name: "JavaScript", pct: 12, color: "#5FD3B0" },
      { name: "Shell", pct: 6, color: "#8B7DFF" },
    ],
  },
  {
    id: "graph",
    index: "02",
    title: "Neo4j Knowledge Graph",
    tagline: "Your codebase, modelled as a traversable graph.",
    description:
      "Every source file, function definition, import statement, and cross-module call is ingested into Neo4j as typed nodes and directed edges. The result is a fully queryable relationship model of your codebase — run Cypher traversals, compute PageRank on critical nodes, filter by subsystem, or stream it directly into the visual explorer.",
    kind: "graph",
    metrics: [
      { label: "Node types", value: "5" },
      { label: "Edge types", value: "4" },
      { label: "Query engine", value: "Cypher" },
    ],
  },
  {
    id: "search",
    index: "03",
    title: "Semantic Code Search",
    tagline: "Find what you mean, not what you typed.",
    description:
      "Traditional text search matches characters. RepoMind matches concepts. Your AST nodes are embedded into a high-dimensional vector space, so queries like 'where is user authorization enforced?' return semantically relevant files ranked by meaning — not filename coincidence or comment proximity.",
    kind: "search",
    query: "where is user authorization enforced?",
    results: [
      { file: "backend/middleware/verify_token.py", score: 0.97 },
      { file: "backend/services/auth/session.py", score: 0.94 },
      { file: "backend/routes/protected.py", score: 0.89 },
      { file: "frontend/src/contexts/AuthContext.tsx", score: 0.85 },
    ],
    metrics: [
      { label: "Search type", value: "Semantic" },
      { label: "Embeddings", value: "Dense vec" },
    ],
  },
  {
    id: "deps",
    index: "04",
    title: "Dependency & Impact Explorer",
    tagline: "Know exactly what breaks before you touch a line.",
    description:
      "Trace the full transitive import graph from any file or function. RepoMind computes blast radius across the entire dependency graph — surfacing every module coupled to a change target. Detect circular dependencies, visualize coupling depth, and make refactoring decisions backed by graph data, not intuition.",
    kind: "deps",
    metrics: [
      { label: "Traversal", value: "Transitive" },
      { label: "Detects", value: "Cycles" },
      { label: "Scope", value: "Full repo" },
    ],
  },
  {
    id: "arch",
    index: "05",
    title: "Architecture Insights",
    tagline: "AI-generated architecture analysis you can act on.",
    description:
      "An 11-step dependency-sorted generator pipeline analyses your codebase from multiple angles: domain archetype detection, framework identification, layer boundary mapping, subsystem health scoring, and prioritized tech-debt recommendations. Every output is specific — linked to actual files, flagged by severity, and explained in plain language.",
    kind: "arch",
    recommendations: [
      { text: "Extract shared auth logic into a reusable module", risk: "med" },
      { text: "Decouple database layer from service orchestration", risk: "high" },
      { text: "Add integration tests to graph pipeline entry points", risk: "low" },
    ],
    metrics: [
      { label: "Generators", value: "11" },
      { label: "Ordering", value: "Topo-sort" },
    ],
  },
  {
    id: "chat",
    index: "06",
    title: "AI Repository Chat",
    tagline: "Your codebase answers its own questions.",
    description:
      "Ask RepoMind anything in plain English — 'How does request authentication work?' 'Which module owns the payment logic?' Every response is grounded entirely in your code graph: real execution paths, exact file citations, zero hallucination. Ideal for onboarding, architecture reviews, and deep-dive debugging sessions.",
    kind: "chat",
    conversation: [
      { role: "user", text: "How does the pipeline execute generators in order?" },
      {
        role: "assistant",
        text: "The engine uses a 3-state DFS topological sort. Each generator declares its `requires` list. The resolver visits dependencies recursively, detects cycles via a 'visiting' state flag, and appends generators to the execution queue in dependency-resolved order.",
      },
    ],
    files: [
      "backend/services/intelligence/engine/pipeline.py",
      "backend/services/intelligence/engine/context.py",
      "backend/services/intelligence/generators/base_generator.py",
    ],
  },
];
