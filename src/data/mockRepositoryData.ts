// ─── Repository Types ──────────────────────────────────────────────────────

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  issues: number;
  healthScore: number;
  graphComplexity: number;
  filesIndexed: number;
  linesOfCode: number;
  branches: number;
  lastActivity: string;
  languages: LanguageStat[];
  topics: string[];
}

export interface LanguageStat {
  name: string;
  percentage: number;
  color: string;
}

export interface Commit {
  id: string;
  sha: string;
  message: string;
  author: string;
  avatarUrl: string;
  timestamp: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  type: 'feature' | 'fix' | 'refactor' | 'docs' | 'chore' | 'perf';
  branch: string;
}

export interface HotspotFile {
  path: string;
  editFrequency: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  linesOfCode: number;
  dependencies: number;
  lastModified: string;
}

// ─── Graph Types ───────────────────────────────────────────────────────────

export type NodeType = 'component' | 'hook' | 'util' | 'type' | 'context' | 'api' | 'config' | 'page';

export interface FileNode {
  id: string;
  path: string;
  name: string;
  type: NodeType;
  linesOfCode: number;
  exports: string[];
  importCount: number;
  exportCount: number;
  complexity: number;
  lastModified: string;
  description: string;
  sourcePreview: string;
  blastRadius: string[];
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  importType: 'default' | 'named' | 'namespace' | 're-export';
  symbols: string[];
}

// ─── Search Types ──────────────────────────────────────────────────────────

export interface SearchResult {
  file: string;
  path: string;
  relevance: number;
  snippet: string;
  lineRange: [number, number];
  type: NodeType;
  explanation: string;
}

export interface SemanticAnswer {
  query: string;
  answer: string;
  confidence: number;
  sources: string[];
}

// ─── Mock Repositories ─────────────────────────────────────────────────────

export const mockRepositories: Repository[] = [
  {
    id: 'repo-1',
    name: 'next.js',
    fullName: 'vercel/next.js',
    owner: 'vercel',
    description: 'The React Framework for the Web — production-grade React applications that scale.',
    language: 'TypeScript',
    stars: 128400,
    forks: 27100,
    issues: 2847,
    healthScore: 94,
    graphComplexity: 87,
    filesIndexed: 4218,
    linesOfCode: 892140,
    branches: 42,
    lastActivity: '2 minutes ago',
    topics: ['react', 'nextjs', 'ssr', 'typescript', 'framework'],
    languages: [
      { name: 'TypeScript', percentage: 78, color: '#3178c6' },
      { name: 'JavaScript', percentage: 14, color: '#f7df1e' },
      { name: 'CSS', percentage: 5, color: '#563d7c' },
      { name: 'MDX', percentage: 3, color: '#fcb900' },
    ],
  },
  {
    id: 'repo-2',
    name: 'react',
    fullName: 'facebook/react',
    owner: 'facebook',
    description: 'The library for web and native user interfaces. Declarative, efficient, and flexible.',
    language: 'JavaScript',
    stars: 231600,
    forks: 47300,
    issues: 1203,
    healthScore: 98,
    graphComplexity: 92,
    filesIndexed: 1847,
    linesOfCode: 412890,
    branches: 18,
    lastActivity: '14 minutes ago',
    topics: ['javascript', 'ui', 'library', 'react', 'frontend'],
    languages: [
      { name: 'JavaScript', percentage: 85, color: '#f7df1e' },
      { name: 'TypeScript', percentage: 10, color: '#3178c6' },
      { name: 'HTML', percentage: 3, color: '#e34f26' },
      { name: 'CSS', percentage: 2, color: '#563d7c' },
    ],
  },
  {
    id: 'repo-3',
    name: 'langchain',
    fullName: 'langchain-ai/langchain',
    owner: 'langchain-ai',
    description: 'Build context-aware reasoning applications with LLMs and RAG pipelines.',
    language: 'Python',
    stars: 96800,
    forks: 15400,
    issues: 784,
    healthScore: 82,
    graphComplexity: 76,
    filesIndexed: 3104,
    linesOfCode: 645200,
    branches: 31,
    lastActivity: '1 hour ago',
    topics: ['llm', 'ai', 'rag', 'langchain', 'python', 'openai'],
    languages: [
      { name: 'Python', percentage: 92, color: '#3572A5' },
      { name: 'TypeScript', percentage: 5, color: '#3178c6' },
      { name: 'Makefile', percentage: 3, color: '#427819' },
    ],
  },
];

// ─── Mock Graph Data ───────────────────────────────────────────────────────

export const mockFileNodes: FileNode[] = [
  {
    id: 'node-1',
    path: 'src/App.tsx',
    name: 'App.tsx',
    type: 'component',
    linesOfCode: 124,
    exports: ['App', 'AppProps'],
    importCount: 8,
    exportCount: 2,
    complexity: 6,
    lastModified: '3 hours ago',
    description: 'Root application component. Sets up routing, global providers, and theme configuration.',
    sourcePreview: `import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import GraphExplorer from './pages/GraphExplorer';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/graph" element={<GraphExplorer />} />
            </Routes>
          </Layout>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};`,
    blastRadius: ['node-2', 'node-3', 'node-5', 'node-7'],
  },
  {
    id: 'node-2',
    path: 'src/contexts/AuthContext.tsx',
    name: 'AuthContext.tsx',
    type: 'context',
    linesOfCode: 287,
    exports: ['AuthProvider', 'useAuth', 'AuthContext'],
    importCount: 4,
    exportCount: 3,
    complexity: 14,
    lastModified: '1 day ago',
    description: 'Authentication context providing JWT management, session validation, and user state.',
    sourcePreview: `import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { apiClient } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, isAuthenticated: false
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token && !isTokenExpired(token)) {
      setState({ user: jwtDecode(token), token, isAuthenticated: true });
    }
  }, []);`,
    blastRadius: ['node-1', 'node-3', 'node-8', 'node-9'],
  },
  {
    id: 'node-3',
    path: 'src/hooks/useGraphData.ts',
    name: 'useGraphData.ts',
    type: 'hook',
    linesOfCode: 198,
    exports: ['useGraphData', 'GraphDataState'],
    importCount: 6,
    exportCount: 2,
    complexity: 11,
    lastModified: '6 hours ago',
    description: 'Custom React hook for fetching, caching, and transforming repository dependency graph data.',
    sourcePreview: `import { useState, useEffect, useCallback, useRef } from 'react';
import { GraphNode, GraphEdge } from '../types/graph';
import { fetchGraphData } from '../services/graphApi';

interface GraphDataState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  error: string | null;
}

export const useGraphData = (repoId: string) => {
  const [state, setState] = useState<GraphDataState>({
    nodes: [], edges: [], loading: true, error: null
  });
  const cache = useRef<Map<string, GraphDataState>>(new Map());

  const fetchData = useCallback(async () => {
    if (cache.current.has(repoId)) {
      setState(cache.current.get(repoId)!);
      return;
    }
    setState(prev => ({ ...prev, loading: true }));`,
    blastRadius: ['node-1', 'node-5', 'node-10'],
  },
  {
    id: 'node-4',
    path: 'src/services/api.ts',
    name: 'api.ts',
    type: 'api',
    linesOfCode: 342,
    exports: ['apiClient', 'ApiError', 'RequestConfig'],
    importCount: 3,
    exportCount: 3,
    complexity: 18,
    lastModified: '2 days ago',
    description: 'Central API client with interceptors, retry logic, auth token refresh, and error normalization.',
    sourcePreview: `import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.VITE_API_URL || 'https://api.repomind.dev/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) { super(message); }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = \`Bearer \${token}\`;
  return config;
});`,
    blastRadius: ['node-2', 'node-3', 'node-6', 'node-7', 'node-8', 'node-9'],
  },
  {
    id: 'node-5',
    path: 'src/components/GraphCanvas.tsx',
    name: 'GraphCanvas.tsx',
    type: 'component',
    linesOfCode: 456,
    exports: ['GraphCanvas', 'GraphCanvasProps'],
    importCount: 11,
    exportCount: 2,
    complexity: 22,
    lastModified: '5 hours ago',
    description: 'Primary React Flow canvas component for rendering interactive dependency graphs with custom nodes.',
    sourcePreview: `import React, { useCallback, useMemo } from 'react';
import ReactFlow, { Controls, Background, MiniMap } from '@xyflow/react';
import { useGraphData } from '../hooks/useGraphData';
import { CustomFileNode } from './CustomFileNode';
import { CustomDependencyEdge } from './CustomDependencyEdge';

const nodeTypes = { fileNode: CustomFileNode };
const edgeTypes = { dependency: CustomDependencyEdge };

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ repoId, onNodeSelect }) => {
  const { nodes, edges, loading } = useGraphData(repoId);

  const styledNodes = useMemo(() => nodes.map(node => ({
    ...node,
    type: 'fileNode',
    style: { border: 'none', background: 'transparent' }
  })), [nodes]);`,
    blastRadius: ['node-1'],
  },
  {
    id: 'node-6',
    path: 'src/utils/semanticSearch.ts',
    name: 'semanticSearch.ts',
    type: 'util',
    linesOfCode: 215,
    exports: ['searchFiles', 'buildSearchIndex', 'rankResults'],
    importCount: 2,
    exportCount: 3,
    complexity: 12,
    lastModified: '1 week ago',
    description: 'Semantic search utilities including TF-IDF vector ranking and cosine similarity scoring.',
    sourcePreview: `import { FileNode } from '../types/graph';
import { cosineSimilarity, tokenize, stemWord } from './nlp';

interface SearchIndex {
  vectors: Map<string, number[]>;
  vocabulary: string[];
  idf: number[];
}

export const buildSearchIndex = (nodes: FileNode[]): SearchIndex => {
  const allTokens = nodes.flatMap(n =>
    tokenize(n.path + ' ' + n.exports.join(' ') + ' ' + n.description)
  );
  const vocabulary = [...new Set(allTokens.map(stemWord))];
  // ... TF-IDF computation
};

export const rankResults = (query: string, index: SearchIndex): SearchResult[] => {
  const queryVec = vectorize(tokenize(query).map(stemWord), index);
  return index.vectors
    .entries()
    .map(([id, vec]) => ({ id, score: cosineSimilarity(queryVec, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
};`,
    blastRadius: ['node-7'],
  },
  {
    id: 'node-7',
    path: 'src/pages/SemanticSearch.tsx',
    name: 'SemanticSearch.tsx',
    type: 'page',
    linesOfCode: 378,
    exports: ['SemanticSearch'],
    importCount: 9,
    exportCount: 1,
    complexity: 16,
    lastModified: '4 hours ago',
    description: 'Semantic search page with natural language query processing, AI answer generation, and file result ranking.',
    sourcePreview: `import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, FileCode } from 'lucide-react';
import { useSemanticSearch } from '../hooks/useSemanticSearch';

export const SemanticSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { results, answer, search } = useSemanticSearch();

  const handleSearch = useCallback(async (q: string) => {
    setIsSearching(true);
    await search(q);
    setIsSearching(false);
  }, [search]);`,
    blastRadius: ['node-1'],
  },
  {
    id: 'node-8',
    path: 'src/types/user.ts',
    name: 'user.ts',
    type: 'type',
    linesOfCode: 67,
    exports: ['User', 'UserRole', 'UserPreferences'],
    importCount: 0,
    exportCount: 3,
    complexity: 2,
    lastModified: '1 month ago',
    description: 'Core user type definitions and role enumeration for authentication and authorization.',
    sourcePreview: `export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  preferences: UserPreferences;
  createdAt: string;
  lastLoginAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  graphLayout: 'dagre' | 'force' | 'radial';
  defaultRepo: string | null;
  notifications: boolean;
}`,
    blastRadius: ['node-2', 'node-4'],
  },
  {
    id: 'node-9',
    path: 'src/middleware/rateLimit.ts',
    name: 'rateLimit.ts',
    type: 'util',
    linesOfCode: 88,
    exports: ['createRateLimiter', 'RateLimitConfig'],
    importCount: 1,
    exportCount: 2,
    complexity: 8,
    lastModified: '3 weeks ago',
    description: 'Token bucket rate limiter for API request throttling to prevent service abuse.',
    sourcePreview: `interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const createRateLimiter = (config: RateLimitConfig) => {
  const buckets = new Map<string, { tokens: number; lastRefill: number }>();

  return (key: string): boolean => {
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: config.maxRequests, lastRefill: now };
    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor(elapsed / config.windowMs) * config.maxRequests;
    bucket.tokens = Math.min(config.maxRequests, bucket.tokens + refill);
    if (bucket.tokens <= 0) return false;
    bucket.tokens--;
    buckets.set(key, { ...bucket, lastRefill: now });
    return true;
  };
};`,
    blastRadius: ['node-4'],
  },
  {
    id: 'node-10',
    path: 'src/hooks/useImpactAnalysis.ts',
    name: 'useImpactAnalysis.ts',
    type: 'hook',
    linesOfCode: 156,
    exports: ['useImpactAnalysis', 'ImpactResult'],
    importCount: 4,
    exportCount: 2,
    complexity: 9,
    lastModified: '2 days ago',
    description: 'Hook for computing blast radius and dependency impact when modifying a target file.',
    sourcePreview: `import { useMemo } from 'react';
import { FileNode, DependencyEdge } from '../types/graph';

export interface ImpactResult {
  directDependents: string[];
  transitiveDependents: string[];
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedTests: string[];
}

export const useImpactAnalysis = (
  targetNodeId: string,
  nodes: FileNode[],
  edges: DependencyEdge[]
): ImpactResult => {
  return useMemo(() => {
    const visited = new Set<string>();
    const queue = [targetNodeId];
    // BFS traversal for blast radius
    while (queue.length > 0) {
      const current = queue.shift()!;
      edges.filter(e => e.source === current)
           .forEach(e => { if (!visited.has(e.target)) {
             visited.add(e.target);
             queue.push(e.target);
           }});
    }
    const count = visited.size;
    return {
      directDependents: [...visited].slice(0, 3),
      transitiveDependents: [...visited].slice(3),
      riskScore: Math.min(100, count * 12),
      riskLevel: count > 7 ? 'critical' : count > 4 ? 'high' : count > 2 ? 'medium' : 'low',
      affectedTests: [],
    };
  }, [targetNodeId, nodes, edges]);
};`,
    blastRadius: ['node-5', 'node-7'],
  },
];

export const mockDependencyEdges: DependencyEdge[] = [
  { id: 'e-1-2', source: 'node-1', target: 'node-2', importType: 'named', symbols: ['AuthProvider'] },
  { id: 'e-1-3', source: 'node-1', target: 'node-3', importType: 'default', symbols: ['useGraphData'] },
  { id: 'e-1-5', source: 'node-1', target: 'node-5', importType: 'default', symbols: ['GraphCanvas'] },
  { id: 'e-2-4', source: 'node-2', target: 'node-4', importType: 'named', symbols: ['apiClient'] },
  { id: 'e-2-8', source: 'node-2', target: 'node-8', importType: 'named', symbols: ['User', 'UserRole'] },
  { id: 'e-3-4', source: 'node-3', target: 'node-4', importType: 'named', symbols: ['apiClient'] },
  { id: 'e-4-9', source: 'node-4', target: 'node-9', importType: 'named', symbols: ['createRateLimiter'] },
  { id: 'e-5-3', source: 'node-5', target: 'node-3', importType: 'named', symbols: ['useGraphData'] },
  { id: 'e-6-4', source: 'node-6', target: 'node-4', importType: 'named', symbols: ['apiClient'] },
  { id: 'e-7-6', source: 'node-7', target: 'node-6', importType: 'named', symbols: ['searchFiles', 'rankResults'] },
  { id: 'e-7-4', source: 'node-7', target: 'node-4', importType: 'named', symbols: ['apiClient'] },
  { id: 'e-10-3', source: 'node-10', target: 'node-3', importType: 'named', symbols: ['useGraphData'] },
];

// ─── Mock Commits ──────────────────────────────────────────────────────────

export const mockCommits: Commit[] = [
  {
    id: 'c-1', sha: 'a7f3d2e', message: 'feat: add semantic search with vector embeddings',
    author: 'sarah.chen', avatarUrl: '', timestamp: '12 minutes ago',
    filesChanged: 8, additions: 342, deletions: 28, type: 'feature', branch: 'feat/semantic-search',
  },
  {
    id: 'c-2', sha: 'b9c1a4f', message: 'fix: resolve circular dependency in auth middleware',
    author: 'marcus.dev', avatarUrl: '', timestamp: '1 hour ago',
    filesChanged: 3, additions: 47, deletions: 89, type: 'fix', branch: 'fix/auth-circular',
  },
  {
    id: 'c-3', sha: 'c3e8d12', message: 'refactor: extract rate limiter into dedicated utility module',
    author: 'alex.nord', avatarUrl: '', timestamp: '3 hours ago',
    filesChanged: 5, additions: 123, deletions: 198, type: 'refactor', branch: 'main',
  },
  {
    id: 'c-4', sha: 'd4f9b73', message: 'perf: memoize graph layout computation to reduce re-renders',
    author: 'priya.k', avatarUrl: '', timestamp: '6 hours ago',
    filesChanged: 2, additions: 31, deletions: 14, type: 'perf', branch: 'main',
  },
  {
    id: 'c-5', sha: 'e2a1c56', message: 'docs: update API documentation and add usage examples',
    author: 'tom.wright', avatarUrl: '', timestamp: '1 day ago',
    filesChanged: 12, additions: 890, deletions: 45, type: 'docs', branch: 'docs/api-v2',
  },
  {
    id: 'c-6', sha: 'f6b8d90', message: 'chore: upgrade React Flow to v12 with breaking changes resolved',
    author: 'sarah.chen', avatarUrl: '', timestamp: '2 days ago',
    filesChanged: 19, additions: 456, deletions: 312, type: 'chore', branch: 'chore/deps-upgrade',
  },
];

// ─── Mock Hotspots ─────────────────────────────────────────────────────────

export const mockHotspots: HotspotFile[] = [
  { path: 'src/services/api.ts', editFrequency: 94, riskLevel: 'critical', linesOfCode: 342, dependencies: 7, lastModified: '2 days ago' },
  { path: 'src/contexts/AuthContext.tsx', editFrequency: 78, riskLevel: 'high', linesOfCode: 287, dependencies: 4, lastModified: '1 day ago' },
  { path: 'src/components/GraphCanvas.tsx', editFrequency: 71, riskLevel: 'high', linesOfCode: 456, dependencies: 11, lastModified: '5 hours ago' },
  { path: 'src/pages/SemanticSearch.tsx', editFrequency: 62, riskLevel: 'medium', linesOfCode: 378, dependencies: 9, lastModified: '4 hours ago' },
  { path: 'src/hooks/useGraphData.ts', editFrequency: 55, riskLevel: 'medium', linesOfCode: 198, dependencies: 6, lastModified: '6 hours ago' },
  { path: 'src/utils/semanticSearch.ts', editFrequency: 31, riskLevel: 'low', linesOfCode: 215, dependencies: 2, lastModified: '1 week ago' },
];

// ─── Mock Search Data ──────────────────────────────────────────────────────

export const mockSearchResults: Record<string, SearchResult[]> = {
  default: [
    {
      file: 'AuthContext.tsx', path: 'src/contexts/AuthContext.tsx',
      relevance: 97, type: 'context',
      snippet: `const token = localStorage.getItem('auth_token');\nif (token && !isTokenExpired(token)) {\n  setState({ user: jwtDecode(token), token, isAuthenticated: true });`,
      lineRange: [38, 41],
      explanation: 'Primary authentication token validation logic. JWT tokens are decoded using jwtDecode and expiry is checked before restoring session state.',
    },
    {
      file: 'api.ts', path: 'src/services/api.ts',
      relevance: 89, type: 'api',
      snippet: `apiClient.interceptors.request.use(config => {\n  const token = localStorage.getItem('auth_token');\n  if (token) config.headers.Authorization = \`Bearer \${token}\`;\n  return config;\n});`,
      lineRange: [54, 58],
      explanation: 'Axios request interceptor that automatically attaches the Bearer token to every outgoing API request.',
    },
    {
      file: 'rateLimit.ts', path: 'src/middleware/rateLimit.ts',
      relevance: 72, type: 'util',
      snippet: `export const createRateLimiter = (config: RateLimitConfig) => {\n  const buckets = new Map<string, { tokens: number; lastRefill: number }>();`,
      lineRange: [9, 11],
      explanation: 'Token bucket rate limiter that guards API endpoints from abuse. Used by the auth middleware to throttle login attempts.',
    },
    {
      file: 'user.ts', path: 'src/types/user.ts',
      relevance: 64, type: 'type',
      snippet: `export interface User {\n  id: string;\n  email: string;\n  role: UserRole;\n  preferences: UserPreferences;\n}`,
      lineRange: [1, 9],
      explanation: 'Core user type definition used across auth, profile, and permission-checking features.',
    },
  ],
};

export const mockSemanticAnswers: SemanticAnswer[] = [
  {
    query: 'how are auth tokens validated?',
    confidence: 96,
    answer: `Authentication tokens are validated through a **two-stage process**:

**1. Client-side validation** (AuthContext.tsx:38-45)
When the app initializes, it retrieves the JWT from \`localStorage\` and calls \`isTokenExpired(token)\` to verify the token hasn't reached its \`exp\` claim. If valid, the decoded payload is restored to React state.

**2. Server-side validation** (api.ts:54-58)
Every API request passes through an Axios interceptor that attaches the token as a \`Bearer\` header. The backend verifies signature and expiry using the HS256 algorithm.

**Rate limiting** (rateLimit.ts:9-31) is applied to the \`/auth/login\` endpoint using a token bucket algorithm to prevent brute force attacks.`,
    sources: ['src/contexts/AuthContext.tsx', 'src/services/api.ts', 'src/middleware/rateLimit.ts'],
  },
];

// ─── Impact Analysis Data ──────────────────────────────────────────────────

export interface ImpactData {
  targetFile: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  directDependents: string[];
  transitiveDependents: string[];
  affectedTests: string[];
  aiAnalysis: string;
}

export const mockImpactData: Record<string, ImpactData> = {
  'node-4': {
    targetFile: 'src/services/api.ts',
    riskScore: 94,
    riskLevel: 'critical',
    directDependents: ['AuthContext.tsx', 'useGraphData.ts', 'SemanticSearch.tsx'],
    transitiveDependents: ['App.tsx', 'GraphCanvas.tsx', 'ImpactAnalysis.tsx', 'Dashboard.tsx', 'useImpactAnalysis.ts'],
    affectedTests: ['auth.test.ts', 'api.test.ts', 'graphData.test.ts', 'semanticSearch.test.ts', 'integration/userFlow.test.ts'],
    aiAnalysis: `**Critical Impact Warning** — \`api.ts\` is the central nervous system of this codebase. Any modification carries **94% blast radius risk**.

**Why it's dangerous:**
- 7 direct importers depend on \`apiClient\` for all network operations
- The Axios interceptor handles global auth token injection — breaking this breaks all authenticated requests
- Error normalization in \`ApiError\` class is relied upon by every error boundary

**Recommended approach:**
1. Write comprehensive unit tests before modifying (\`api.test.ts\` has 67% coverage — bring to 95%+)
2. Use adapter pattern to wrap \`apiClient\` calls behind a service layer
3. Deploy changes behind a feature flag
4. Run full integration test suite before merging`,
  },
  'node-2': {
    targetFile: 'src/contexts/AuthContext.tsx',
    riskScore: 76,
    riskLevel: 'high',
    directDependents: ['App.tsx', 'api.ts', 'user.ts'],
    transitiveDependents: ['GraphCanvas.tsx', 'Dashboard.tsx', 'SemanticSearch.tsx'],
    affectedTests: ['auth.test.ts', 'userContext.test.ts', 'integration/login.test.ts'],
    aiAnalysis: `**High Impact** — \`AuthContext.tsx\` provides the authentication state to the entire component tree via React Context.

Modifying the \`AuthState\` interface shape or the \`useAuth\` hook signature will break all consumer components. The JWT refresh logic at line 67-89 is particularly fragile.`,
  },
};

// ─── AI Onboarding Data ────────────────────────────────────────────────────

export interface OnboardingStep {
  id: string;
  title: string;
  icon: string;
  content: string;
  keyFiles: string[];
  codeSnippet?: string;
  readTime?: string;
}

export const mockOnboardingSteps: OnboardingStep[] = [
  {
    id: 'auth',
    title: '1. Authentication',
    icon: '🔑',
    readTime: '2 min',
    content: `Authentication is session-based and powered by a global JWT context.

- **Token Storage:** Tokens are securely stored in the client application context on bootstrap.
- **Session Validation:** On application mount, \`AuthContext.tsx\` decodes the existing token payload and triggers a validation handshake with the backend.
- **Refresh Cycle:** Token expiration is handled automatically via silent background checks prior to outgoing HTTP requests.`,
    keyFiles: ['src/contexts/AuthContext.tsx', 'src/services/api.ts'],
  },
  {
    id: 'api-layer',
    title: '2. API Layer',
    icon: '📡',
    readTime: '2 min',
    content: `The network architecture operates through a centralized client stack.

- **Client Setup:** Powered by an Axios client instance initialized with custom endpoints.
- **Interceptors:** A request interceptor automatically attaches credentials. A response interceptor catches validation/handshake failures and attempts to request refetches.
- **Route Protection:** Component route guards intercept requests for unauthenticated sessions and redirect users to onboarding or landing pages.`,
    keyFiles: ['src/services/api.ts', 'src/services/repoApi.ts'],
  },
  {
    id: 'data-models',
    title: '3. Data Models',
    icon: '💾',
    readTime: '2 min',
    content: `The database architecture relies on Graph relationships mapped from AST code analyses.

- **Graph Schema:** Nodes denote classes, functions, and files. Edges denote imports, calls, or dependencies.
- **Types:** Strictly typed data interfaces (e.g. \`RealGraphNode\`, \`ImpactData\`) represent repository summaries.
- **Mapping:** Vector index references connect semantic queries back to specific AST ranges in local files.`,
    keyFiles: ['src/services/repoApi.ts', 'src/contexts/RepoContext.tsx'],
  },
  {
    id: 'runtime-flow',
    title: '4. Runtime Flow',
    icon: '⚡',
    readTime: '2 min',
    content: `The application follows a standard Vite/React development lifecycle.

- **Entrypoint:** Execution begins in \`src/main.tsx\`, mounting the layout tree to the DOM.
- **Vitals Calculation:** Dashboard metrics are computed from node counts and complexity ratios.
- **Simulation Pipeline:** Changes to components can be run in isolation, feeding dependency paths into the visual blast-radius calculator.`,
    keyFiles: ['src/main.tsx', 'src/components/Layout.tsx', 'src/pages/Dashboard.tsx'],
  }
];

// ─── Phase 2 Advanced Features Data ───────────────────────────────────────

export interface CommitSnapshot {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  filesIndexed: number;
  linesOfCode: number;
  healthScore: number;
  graphComplexity: number;
}

export const mockCommitSnapshots: CommitSnapshot[] = [
  { sha: 'init', message: 'Initial commit (scaffolding & structure)', author: 'sarah.chen', timestamp: '2 weeks ago', filesIndexed: 45, linesOfCode: 12400, healthScore: 99, graphComplexity: 12 },
  { sha: 'routing', message: 'feat: setup client-side routing & pages', author: 'marcus.dev', timestamp: '10 days ago', filesIndexed: 280, linesOfCode: 85000, healthScore: 97, graphComplexity: 24 },
  { sha: 'auth', message: 'feat: implement JWT AuthContext & api interceptor', author: 'alex.nord', timestamp: '7 days ago', filesIndexed: 1240, linesOfCode: 320000, healthScore: 92, graphComplexity: 58 },
  { sha: 'search', message: 'feat: add semantic search & vector engine', author: 'sarah.chen', timestamp: '5 days ago', filesIndexed: 3102, linesOfCode: 654000, healthScore: 89, graphComplexity: 74 },
  { sha: 'perf', message: 'perf: memoize graph layouts & lazy routing', author: 'priya.k', timestamp: '2 days ago', filesIndexed: 4218, linesOfCode: 892140, healthScore: 94, graphComplexity: 87 }
];

export interface ASTNode {
  name: string;
  type: string;
  range: [number, number];
  children?: ASTNode[];
}

export const mockASTData: Record<string, ASTNode> = {
  'node-1': {
    name: 'App.tsx',
    type: 'Program',
    range: [1, 23],
    children: [
      { name: 'import react-router-dom', type: 'ImportDeclaration', range: [2, 2] },
      { name: 'ThemeProvider', type: 'ImportDeclaration', range: [3, 3] },
      {
        name: 'App',
        type: 'ExportNamedDeclaration (Function)',
        range: [10, 23],
        children: [
          {
            name: 'return BrowserRouter',
            type: 'ReturnStatement (JSX)',
            range: [11, 22],
            children: [
              { name: 'ThemeProvider', type: 'JSXElement', range: [12, 21] },
              { name: 'AuthProvider', type: 'JSXElement', range: [13, 20] },
              { name: 'Routes', type: 'JSXElement', range: [15, 18] },
            ]
          }
        ]
      }
    ]
  },
  'node-4': {
    name: 'api.ts',
    type: 'Program',
    range: [1, 24],
    children: [
      { name: 'import axios', type: 'ImportDeclaration', range: [1, 1] },
      { name: 'BASE_URL', type: 'VariableDeclaration (const)', range: [3, 3] },
      {
        name: 'ApiError',
        type: 'ExportNamedDeclaration (Class)',
        range: [5, 11],
        children: [
          { name: 'constructor', type: 'MethodDefinition', range: [6, 10] }
        ]
      },
      { name: 'apiClient', type: 'ExportNamedDeclaration (const)', range: [13, 17] },
      { name: 'requestInterceptor', type: 'ExpressionStatement', range: [19, 23] }
    ]
  }
};

export interface RefactorScenario {
  id: string;
  title: string;
  description: string;
  originalCode: string;
  refactoredCode: string;
  affectedFiles: {
    path: string;
    status: 'success' | 'broken';
    originalCodeSnippet: string;
    proposedFixSnippet: string;
    explanation: string;
  }[];
}

export const mockRefactorScenarios: Record<string, RefactorScenario[]> = {
  'node-4': [
    {
      id: 'scen-1',
      title: 'Rename apiClient to secureApiClient',
      description: 'Standardize naming conventions for security compliance and distinguish from public HTTP clients.',
      originalCode: 'export const apiClient: AxiosInstance = axios.create({\n  baseURL: BASE_URL,\n  timeout: 30000,\n});',
      refactoredCode: 'export const secureApiClient: AxiosInstance = axios.create({\n  baseURL: BASE_URL,\n  timeout: 30000,\n});',
      affectedFiles: [
        {
          path: 'src/contexts/AuthContext.tsx',
          status: 'broken',
          originalCodeSnippet: 'import { apiClient } from \'../services/api\';\n\nconst res = await apiClient.get(\'/auth/me\');',
          proposedFixSnippet: 'import { secureApiClient } from \'../services/api\';\n\nconst res = await secureApiClient.get(\'/auth/me\');',
          explanation: "ReferenceError: 'apiClient' is not exported by 'src/services/api.ts'. Change all usages to 'secureApiClient'."
        },
        {
          path: 'src/hooks/useGraphData.ts',
          status: 'broken',
          originalCodeSnippet: 'import { apiClient } from \'../services/api\';',
          proposedFixSnippet: 'import { secureApiClient } from \'../services/api\';',
          explanation: "ReferenceError: 'apiClient' is not exported by 'src/services/api.ts'."
        },
        {
          path: 'src/pages/SemanticSearch.tsx',
          status: 'broken',
          originalCodeSnippet: 'import { apiClient } from \'../services/api\';',
          proposedFixSnippet: 'import { secureApiClient } from \'../services/api\';',
          explanation: "ReferenceError: 'apiClient' is not exported by 'src/services/api.ts'."
        }
      ]
    },
    {
      id: 'scen-2',
      title: 'Add request ID to ApiError signature',
      description: 'Require a unique correlation requestId parameter on all ApiError creations to simplify logs parsing.',
      originalCode: 'export class ApiError extends Error {\n  constructor(\n    public status: number,\n    public code: string,\n    message: string\n  ) { super(message); }\n}',
      refactoredCode: 'export class ApiError extends Error {\n  constructor(\n    public status: number,\n    public code: string,\n    public requestId: string,\n    message: string\n  ) { super(message); }\n}',
      affectedFiles: [
        {
          path: 'src/contexts/AuthContext.tsx',
          status: 'success',
          originalCodeSnippet: '// No direct ApiError creation, only type references',
          proposedFixSnippet: '// No changes required',
          explanation: 'Uses ApiError type annotations only, no constructor invocations.'
        },
        {
          path: 'src/hooks/useGraphData.ts',
          status: 'broken',
          originalCodeSnippet: 'throw new ApiError(500, \'GRAPH_FETCH_FAIL\', \'Failed to retrieve nodes\');',
          proposedFixSnippet: 'throw new ApiError(500, \'GRAPH_FETCH_FAIL\', \'req-\' + Date.now(), \'Failed to retrieve nodes\');',
          explanation: 'Expected 4 arguments, but got 3 in constructor instantiation.'
        }
      ]
    }
  ]
};

