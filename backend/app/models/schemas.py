from pydantic import BaseModel, HttpUrl
from typing import Any, Dict, List, Literal, Optional


class AnalyzeRepoRequest(BaseModel):
    repo_url: HttpUrl


class AnalysisMetrics(BaseModel):
    cloneTimeMs: int
    parseTimeMs: int
    graphStoreTimeMs: int
    gitActivityTimeMs: int
    totalAnalysisTimeMs: int
    filesScanned: int
    filesParsed: int
    filesSkipped: int
    nodesWritten: Optional[int] = None
    relationshipsWritten: Optional[int] = None
    duplicatesRemoved: Optional[int] = None


class AnalyzeRepoResponse(BaseModel):
    id: str
    status: Literal['queued', 'processing', 'complete']
    message: str
    metrics: Optional[AnalysisMetrics] = None


class AnalysisStatusResponse(BaseModel):
    id: str
    status: Literal['queued', 'processing', 'complete']
    progress: int
    message: str


class RepoSummaryResponse(BaseModel):
    repo_name: str
    files: int
    functions: int
    classes: int
    dependencies: int
    risk_score: int


class GraphNode(BaseModel):
    id: str
    path: str
    name: str
    type: Literal['component', 'hook', 'util', 'type', 'context', 'api', 'page', 'config']
    linesOfCode: int
    exports: List[str]
    importCount: int
    exportCount: int
    complexity: int
    lastModified: str
    description: str
    sourcePreview: str
    blastRadius: List[str]


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    importType: Literal['default', 'named', 'namespace', 're-export']
    symbols: List[str]


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class RefactorScenarioModel(BaseModel):
    id: str
    title: str
    summary: str
    affectedFiles: List[str]
    outcome: str


class ImpactAnalysisResponse(BaseModel):
    id: str
    targetFile: str
    riskLevel: Literal['low', 'medium', 'high', 'critical']
    directDependents: List[str]
    transitiveDependents: List[str]
    impactScore: int
    recommendations: List[str]
    scenarios: List[RefactorScenarioModel]


class ImpactDependencyNode(BaseModel):
    id: str
    type: Literal['file', 'function', 'class', 'import', 'repository']
    label: str
    metadata: Dict[str, Any]


class ImpactDependencyCounts(BaseModel):
    upstream: int
    downstream: int
    total: int


class ImpactAnalysisRealResponse(BaseModel):
    source: Literal['neo4j', 'mock']
    targetNode: ImpactDependencyNode
    upstreamDependencies: List[ImpactDependencyNode]
    downstreamDependencies: List[ImpactDependencyNode]
    affectedFiles: List[str]
    affectedFunctions: List[str]
    affectedClasses: List[str]
    dependencyCounts: ImpactDependencyCounts
    riskScore: int
    explanation: str


class ChangeSimulationRequest(BaseModel):
    target: str


class ChangeSimulationResponse(BaseModel):
    source: Literal['neo4j', 'mock']
    target: str
    directFiles: List[str]
    directFunctions: List[str]
    indirectFunctions: List[str]
    affectedClasses: List[str]
    blastRadius: int
    riskScore: int
    explanation: str


class BlastRadiusDetail(BaseModel):
    direct: int
    indirect: int
    total: int


class ChangeSimulationRealResponse(BaseModel):
    source: Literal['neo4j', 'mock']
    target: Dict[str, Any]
    directlyAffectedFiles: List[str]
    directlyAffectedFunctions: List[str]
    indirectlyAffectedFunctions: List[str]
    affectedClasses: List[str]
    blastRadius: BlastRadiusDetail
    riskScore: int
    explanation: str


class SemanticHit(BaseModel):
    file: str
    path: str
    relevance: int
    snippet: str
    type: Literal['component', 'hook', 'util', 'type', 'context', 'api', 'page']
    explanation: str


class SemanticSearchResponse(BaseModel):
    query: str
    answer: str
    confidence: float
    sources: List[str]
    results: List[SemanticHit]


class RepositoryMetadata(BaseModel):
    repo_id: str
    owner: str
    name: str
    full_name: str
    branch: str
    local_path: str
    imported_at: str
    primary_language: str
    file_count: int
    total_lines: int


class RepositoriesListResponse(BaseModel):
    repositories: List[RepositoryMetadata]


# ── Repository Architect Schemas ──────────────────────────────────────────

class ArchitectureModule(BaseModel):
    """Represents a major module/folder in the architecture."""
    name: str
    path: str
    fileCount: int
    functionCount: int
    classCount: int
    importCount: int
    description: str


class Hotspot(BaseModel):
    """Represents a highly connected/critical node in the graph."""
    name: str
    type: Literal['file', 'function', 'class']
    path: str
    dependencyCount: int
    complexity: int
    criticality: float  # 0-1 score


class OnboardingPath(BaseModel):
    """A single step in the suggested learning/onboarding path."""
    step: int
    title: str
    description: str
    keyFiles: List[str]
    rationale: str


class RiskArea(BaseModel):
    """Represents a potential risk area in the codebase."""
    type: Literal['excessive_dependencies', 'inheritance_chain', 'coupling', 'circular_dependency']
    severity: Literal['low', 'medium', 'high', 'critical']
    nodes: List[str]
    description: str
    recommendation: str


# ── Repository Intelligence v2 Schemas ───────────────────────────────────────

class IntelligenceItem(BaseModel):
    """A single insight: title + description + evidence list.
    Confidence is only set for projectPurpose and domain (not every field)."""
    title: str
    description: str
    confidence: Optional[int] = None   # 0–100; only populated where meaningful
    evidence: List[str]                 # shown via 'Why?' collapsible


class FlowStep(BaseModel):
    """One step in the reconstructed execution flow."""
    step: str
    evidence: List[str]


class OnboardingStep(BaseModel):
    """One step in the 'Start Here' guided reading path."""
    order: int
    file: str
    path: str
    reason: str
    callChain: Optional[List[str]] = None  # ['get_camera()', 'preprocess()', ...]


class CriticalFile(BaseModel):
    """A high fan-in file with concrete impact metrics from the graph."""
    name: str
    path: str
    fanIn: int
    affectedFunctions: int
    affectedModules: int
    executionPct: Optional[int] = None   # % of execution paths through this file
    reason: Optional[str] = None


class RepositoryLayer(BaseModel):
    """A conceptual architectural layer inferred from module/import structure."""
    name: str
    description: str
    components: List[str]


class DomainDetectionV2(BaseModel):
    """Weighted domain classification."""
    domain: str
    confidence: int        # 0–100
    language: str          # 'definite' | 'tentative' | 'uncertain'
    evidence: List[str]    # matched signal labels


class RepositoryIntelligence(BaseModel):
    """v2 evidence-driven technical briefing. Every claim has supporting evidence."""
    projectPurpose: IntelligenceItem     # carries confidence
    executionFlow: List[FlowStep]
    workflowConfidence: int              # 0–100
    workflowReconstructed: bool
    startHere: List[OnboardingStep]
    estimatedOnboardingMinutes: int
    estimatedUnderstandingPct: Optional[int] = None
    repositoryLayers: List[RepositoryLayer]
    architecture: List[IntelligenceItem]
    criticalFiles: List[CriticalFile]
    integrations: List[IntelligenceItem]
    complexity: IntelligenceItem
    domain: DomainDetectionV2           # carries confidence
    observations: List[IntelligenceItem]
    closingSentence: str


class RepositorySummaryReal(BaseModel):
    """Complete repository architecture summary from Neo4j."""
    source: Literal['neo4j', 'mock']

    # Overview section
    totalFiles: int
    totalClasses: int
    totalFunctions: int
    totalImports: int

    # Architecture summary
    majorModules: List[ArchitectureModule]
    highlyCoupled: List[str]  # File paths or module names

    # Hotspots
    mostDependedOnFiles: List[Hotspot]
    mostDependedOnFunctions: List[Hotspot]
    mostDependedOnClasses: List[Hotspot]

    # Suggested onboarding path
    onboardingPath: List[OnboardingPath]

    # Risk areas
    riskAreas: List[RiskArea]
    overallRiskScore: int  # 0-100

    # AI summary (legacy one-liner, kept for backward compat)
    aiSummary: str

    # v2 Repository Intelligence
    repositoryIntelligence: Optional[RepositoryIntelligence] = None


# ── Repository Activity Schemas ───────────────────────────────────────────────

class FileTouched(BaseModel):
    path: str
    commitCount: int
    lastTouched: str
    ownershipScore: float  # contributor_commits_on_file / total_commits_on_file


class Contributor(BaseModel):
    name: str
    email: str
    commitCount: int
    lastActiveDate: str
    filesTouched: List[FileTouched]
    primaryAreas: List[str]


class RecentCommit(BaseModel):
    sha: str
    message: str
    authorName: str
    authorEmail: str
    date: str
    filesChanged: List[str]


class RepositoryOverview(BaseModel):
    defaultBranch: str
    lastCommitDate: str
    totalCommits: int
    activeContributors: int


class RepositoryActivityResponse(BaseModel):
    source: Literal['git', 'unavailable']
    overview: Optional[RepositoryOverview] = None
    recentCommits: List[RecentCommit] = []
    contributors: List[Contributor] = []
