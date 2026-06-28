import { apiFetch } from './api';

export interface AnalyzeRepoRequest {
  repo_url: string;
}

export interface AnalysisStatus {
  id: string;
  status: 'queued' | 'processing' | 'complete';
  progress: number;
  message: string;
}

export interface RepoSummary {
  repo_name: string;
  files: number;
  functions: number;
  classes: number;
  dependencies: number;
  risk_score: number;
}

export interface GraphNode {
  id: string;
  path: string;
  name: string;
  type: string;
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

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  importType: 'default' | 'named' | 'namespace' | 're-export';
  symbols: string[];
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Real graph types (returned by /graph-real) ─────────────────────────────

export type RealNodeType =
  | 'repository'
  | 'file'
  | 'function'
  | 'class'
  | 'import'
  // fallback for mock data node types
  | 'component'
  | 'hook'
  | 'util'
  | 'type'
  | 'context'
  | 'api'
  | 'page'
  | 'config';

export interface RealNodeMetadata {
  analysis_id?: string;
  repo_name?: string;
  path?: string;
  rel_path?: string;
  file_path?: string;
  line_number?: number;
  params?: string[];
  decorators?: string[];
  bases?: string[];
  methods?: string[];
  module?: string;
  import_type?: string;
  names?: string[];
  functions_count?: number;
  classes_count?: number;
  imports_count?: number;
  exports_count?: number;
  complexity?: number;
  description?: string;
  exports?: string[];
  blastRadius?: string[];
  lastModified?: string;
  linesOfCode?: number;
  [key: string]: unknown;
}

export interface RealGraphNode {
  id: string;
  type: RealNodeType;
  label: string;
  metadata: RealNodeMetadata;
}

export interface RealGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface RealGraphResponse {
  source: 'neo4j' | 'mock';
  nodes: RealGraphNode[];
  edges: RealGraphEdge[];
}

export interface ImpactScenario {
  id: string;
  title: string;
  summary: string;
  affectedFiles: string[];
  outcome: string;
}

export interface ImpactAnalysis {
  id: string;
  targetFile: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  directDependents: string[];
  transitiveDependents: string[];
  impactScore: number;
  recommendations: string[];
  scenarios: ImpactScenario[];
}

export interface SemanticHit {
  file: string;
  path: string;
  relevance: number;
  snippet: string;
  type: string;
  explanation: string;
}

export interface LegacySemanticSearchResponse {
  query: string;
  answer: string;
  confidence: number;
  sources: string[];
  results: SemanticHit[];
}

export interface SemanticSearchResult {
  type: 'function' | 'class' | 'file' | 'import' | string;
  name: string;
  filePath: string;
  lineNumber: number | null;
  score: number;
  reason: string;
}

export interface SemanticSearchResponse {
  source: 'neo4j' | 'mock';
  query: string;
  results: SemanticSearchResult[];
}

export interface ImpactDependencyNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'import' | 'repository';
  label: string;
  metadata: Record<string, unknown>;
}

export interface ImpactDependencyCounts {
  upstream: number;
  downstream: number;
  total: number;
}

export interface ImpactAnalysisRealData {
  source: 'neo4j' | 'mock';
  targetNode: ImpactDependencyNode;
  upstreamDependencies: ImpactDependencyNode[];
  downstreamDependencies: ImpactDependencyNode[];
  affectedFiles: string[];
  affectedFunctions: string[];
  affectedClasses: string[];
  dependencyCounts: ImpactDependencyCounts;
  riskScore: number;
  explanation: string;
}

export interface ChangeSimulationResponse {
  source: 'neo4j' | 'mock';
  target: string;
  directFiles: string[];
  directFunctions: string[];
  indirectFunctions: string[];
  affectedClasses: string[];
  blastRadius: number;
  riskScore: number;
  explanation: string;
}

export interface BlastRadiusDetail {
  direct: number;
  indirect: number;
  total: number;
}

export interface ChangeSimulationRealResponse {
  source: 'neo4j' | 'mock';
  target: {
    id: string;
    type: string;
    label: string;
    metadata: Record<string, unknown>;
  };
  directlyAffectedFiles: string[];
  directlyAffectedFunctions: string[];
  indirectlyAffectedFunctions: string[];
  affectedClasses: string[];
  blastRadius: BlastRadiusDetail;
  riskScore: number;
  explanation: string;
}



// ── Repository Architect types (returned by /repository-summary-real) ──────

export interface ArchitectureModule {
  name: string;
  path: string;
  fileCount: number;
  functionCount: number;
  classCount: number;
  importCount: number;
  description: string;
}

export interface Hotspot {
  name: string;
  type: 'file' | 'function' | 'class';
  path: string;
  dependencyCount: number;
  complexity: number;
  criticality: number;
}

export interface OnboardingPath {
  step: number;
  title: string;
  description: string;
  keyFiles: string[];
  rationale: string;
}

export interface RiskArea {
  type: 'excessive_dependencies' | 'inheritance_chain' | 'coupling' | 'circular_dependency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  nodes: string[];
  description: string;
  recommendation: string;
}

// ── Repository Intelligence v2 Types ────────────────────────────────────────

/** A single insight with an optional confidence score and supporting evidence.
 *  Evidence is shown via a 'Why?' toggle — not always visible.
 *  Confidence is ONLY set for projectPurpose and domain. */
export interface IntelligenceItem {
  title: string;
  description: string;
  confidence?: number;   // 0–100; only set on purpose + domain
  evidence: string[];    // concrete signals; shown via 'Why?' collapsible
}

/** One step in the reconstructed execution flow. */
export interface FlowStep {
  step: string;
  evidence: string[];
}

/** One step in the 'Start Here' reading guide. */
export interface OnboardingStep {
  order: number;
  file: string;
  path: string;
  reason: string;
  callChain?: string[];  // e.g. ['get_camera()', 'preprocess()', 'detect_faces()']
}

/** A high fan-in file with impact metrics from the graph. */
export interface CriticalFile {
  name: string;
  path: string;
  fanIn: number;
  affectedFunctions: number;
  affectedModules: number;
  executionPct?: number;  // % of execution paths through this file
  reason?: string;
}

/** A conceptual architectural layer. */
export interface RepositoryLayer {
  name: string;
  description: string;
  components: string[];
}

/** Weighted domain classification. */
export interface DomainDetectionV2 {
  domain: string;
  confidence: number;          // 0–100
  language: 'definite' | 'tentative' | 'uncertain';
  evidence: string[];
}

/** The complete v2 evidence-driven technical briefing. */
export interface RepositoryIntelligence {
  projectPurpose: IntelligenceItem;       // carries confidence
  executionFlow: FlowStep[];
  workflowConfidence: number;             // 0–100
  workflowReconstructed: boolean;
  startHere: OnboardingStep[];
  estimatedOnboardingMinutes: number;
  estimatedUnderstandingPct?: number;
  repositoryLayers: RepositoryLayer[];
  architecture: IntelligenceItem[];       // no per-item confidence
  criticalFiles: CriticalFile[];
  integrations: IntelligenceItem[];       // no per-item confidence
  complexity: IntelligenceItem;           // no confidence
  domain: DomainDetectionV2;              // carries confidence
  observations: IntelligenceItem[];       // no per-item confidence
  closingSentence: string;
}

export interface RepositorySummaryRealData {
  source: 'neo4j' | 'mock';
  totalFiles: number;
  totalClasses: number;
  totalFunctions: number;
  totalImports: number;
  majorModules: ArchitectureModule[];
  highlyCoupled: string[];
  mostDependedOnFiles: Hotspot[];
  mostDependedOnFunctions: Hotspot[];
  mostDependedOnClasses: Hotspot[];
  onboardingPath: OnboardingPath[];
  riskAreas: RiskArea[];
  overallRiskScore: number;
  aiSummary: string;
  // v2 Repository Intelligence
  repositoryIntelligence?: RepositoryIntelligence;
}



export interface AnalysisMetrics {
  cloneTimeMs: number;
  parseTimeMs: number;
  graphStoreTimeMs: number;
  gitActivityTimeMs: number;
  totalAnalysisTimeMs: number;
  filesScanned: number;
  filesParsed: number;
  filesSkipped: number;
}

export interface AnalyzeRepoResponse {
  id: string;
  status: string;
  message: string;
  metrics?: AnalysisMetrics;
}

export const analyzeRepo = async (repoUrl: string) => {
  return apiFetch<AnalyzeRepoResponse>('/analyze-repo', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  });
};

export const getAnalysisStatus = async (analysisId: string) => {
  return apiFetch<AnalysisStatus>(`/analysis-status/${analysisId}`);
};

export const getRepoSummary = async (analysisId: string) => {
  return apiFetch<RepoSummary>(`/repo-summary/${analysisId}`);
};

export const getGraph = async (analysisId: string) => {
  return apiFetch<GraphResponse>(`/graph/${analysisId}`);
};

export const getGraphReal = async (analysisId: string) => {
  return apiFetch<RealGraphResponse>(`/graph-real/${analysisId}`);
};

export const getImpactAnalysis = async (analysisId: string) => {
  return apiFetch<ImpactAnalysis>(`/impact-analysis/${analysisId}`);
};

export const getImpactAnalysisReal = async (analysisId: string, target: string) => {
  return apiFetch<ImpactAnalysisRealData>(
    `/impact-analysis-real/${analysisId}?target=${encodeURIComponent(target)}`
  );
};

export const runChangeSimulation = async (analysisId: string, target: string) => {
  return apiFetch<ChangeSimulationResponse>(`/change-simulation/${analysisId}`, {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
};

export const runChangeSimulationReal = async (analysisId: string, target: string) => {
  return apiFetch<ChangeSimulationRealResponse>(`/change-simulation-real/${analysisId}`, {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
};

export const searchSemantic = async (analysisId: string, query: string) => {
  return apiFetch<LegacySemanticSearchResponse>(`/semantic-search/${analysisId}?query=${encodeURIComponent(query)}`);
};

export const getSemanticSearchReal = async (analysisId: string, query: string) => {
  return apiFetch<SemanticSearchResponse>(`/semantic-search-real/${analysisId}?query=${encodeURIComponent(query)}`);
};

export const getRepositorySummaryReal = async (analysisId: string) => {
  return apiFetch<RepositorySummaryRealData>(`/repository-summary-real/${analysisId}`);
};

export interface RepositoryMetadata {
  repo_id: string;
  owner: string;
  name: string;
  full_name: string;
  branch: string;
  local_path: string;
  imported_at: string;
  primary_language: string;
  file_count: number;
  total_lines: number;
}

export const importRepository = async (url: string, branch?: string) => {
  return apiFetch<RepositoryMetadata>('/repositories/import', {
    method: 'POST',
    body: JSON.stringify({ url, branch }),
  });
};

export const getRepositories = async () => {
  return apiFetch<{ repositories: RepositoryMetadata[] }>('/repositories');
};

export const getRepository = async (repoId: string) => {
  return apiFetch<RepositoryMetadata>(`/repositories/${repoId}`);
};

// ── Repository Activity types (returned by /repository-activity) ────────────

export interface FileTouched {
  path: string;
  commitCount: number;
  lastTouched: string;
  ownershipScore: number; // 0–1: this contributor's commits / total commits on file
}

export interface Contributor {
  name: string;
  email: string;
  commitCount: number;
  lastActiveDate: string;
  filesTouched: FileTouched[];
  primaryAreas: string[];
}

export interface RecentCommit {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  date: string;
  filesChanged: string[];
}

export interface RepositoryOverview {
  defaultBranch: string;
  lastCommitDate: string;
  totalCommits: number;
  activeContributors: number;
}

export interface RepositoryActivityData {
  source: 'git' | 'unavailable';
  overview: RepositoryOverview | null;
  recentCommits: RecentCommit[];
  contributors: Contributor[];
}

export const getRepositoryActivity = async (analysisId: string) => {
  return apiFetch<RepositoryActivityData>(`/repository-activity/${analysisId}`);
};
