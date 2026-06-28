from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Any
from app.models.schemas import (
    AnalyzeRepoRequest,
    AnalyzeRepoResponse,
    AnalysisStatusResponse,
    RepoSummaryResponse,
    GraphResponse,
    ImpactAnalysisResponse,
    ImpactAnalysisRealResponse,
    ChangeSimulationRequest,
    ChangeSimulationResponse,
    ChangeSimulationRealResponse,
    SemanticSearchResponse,
    RepositorySummaryReal,
    RepositoryActivityResponse,
    AnalysisMetrics,
)
from app.services.mock_data import enqueue_analysis, get_status, get_analysis_result, build_impact_real_payload, build_repository_summary_payload
from app.services.repo_service import import_repository, list_repositories, get_repository
from app.models.schemas import RepositoryMetadata, RepositoriesListResponse
from app.services.git_metadata_service import extract_git_metadata, store_git_metadata, get_git_metadata
import logging
import subprocess
import tempfile
import uuid
import os
from app.services.parser_service import ParserService
from app.graph.neo4j_client import Neo4jClient
from app.services.graph_service import GraphService
from app.services.repository_architect import RepositoryArchitectService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post('/repositories/import', response_model=RepositoryMetadata)
def repositories_import(payload: dict) -> RepositoryMetadata:
    url = payload.get('url')
    branch = payload.get('branch')
    if not url:
        raise HTTPException(status_code=400, detail='Missing repository URL')
    try:
        meta = import_repository(url, branch)
        return RepositoryMetadata(**meta)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get('/repositories', response_model=RepositoriesListResponse)
def repositories_list() -> RepositoriesListResponse:
    repos = list_repositories()
    return RepositoriesListResponse(repositories=repos)


@router.get('/repositories/{repo_id}', response_model=RepositoryMetadata)
def repositories_get(repo_id: str) -> RepositoryMetadata:
    repo = get_repository(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail='Repository not found')
    return RepositoryMetadata(**repo)


@router.post('/analyze-local', response_model=AnalyzeRepoResponse)
def analyze_local(payload: dict) -> AnalyzeRepoResponse:
    """Analyze a local repository by absolute filesystem path.
    Input: { "path": "/absolute/path/to/repo", "name": "optional-name" }
    """
    repo_path = payload.get('path', '').strip()
    if not repo_path or not os.path.isdir(repo_path):
        raise HTTPException(status_code=400, detail=f'Directory not found: {repo_path}')

    analysis_id = f'analysis-{uuid.uuid4().hex[:8]}'
    repo_name = payload.get('name') or os.path.basename(repo_path.rstrip('/')) or 'local_repo'

    logger.info(f'[analyze-local] started for {repo_path} -> {analysis_id}')

    parser_svc = ParserService()
    parsed_output = parser_svc.scan_repository(repo_path)
    logger.info(f'[analyze-local] parsed {len(parsed_output)} items')

    try:
        client = Neo4jClient()
        if client.test_connection():
            graph_svc = GraphService(client=client)
            graph_svc.store_graph(analysis_id, repo_name, parsed_output)
            logger.info(f'[analyze-local] stored in Neo4j analysis_id={analysis_id}')
        client.close()
    except Exception as e:
        logger.error(f'[analyze-local] Neo4j error: {e}')

    from app.services.mock_data import ANALYSIS_STORE, build_repo_summary, build_graph_payload, build_impact_payload, build_semantic_payload
    ANALYSIS_STORE[analysis_id] = {
        'repo_url': repo_path,
        'status': 'complete',
        'progress': 100,
        'summary': build_repo_summary(repo_name),
        'graph': build_graph_payload(),
        'impact': build_impact_payload(),
        'semantic': build_semantic_payload('What is the architecture?'),
    }

    return AnalyzeRepoResponse(
        id=analysis_id,
        status='complete',
        message=f'Local repository analysis completed: {repo_name}',
    )


@router.post('/analyze-repo', response_model=AnalyzeRepoResponse)
def analyze_repo(request: AnalyzeRepoRequest) -> Any:
    import time
    repo_url_str = str(request.repo_url)
    analysis_id = f'analysis-{uuid.uuid4().hex[:8]}'
    
    logger.info(f"[ANALYZE] stage=clone_started repo={repo_url_str}")
    print(f"[ANALYZE] stage=clone_started repo={repo_url_str}")
    
    total_start = time.time()
    clone_duration = 0
    parse_duration = 0
    store_duration = 0
    activity_duration = 0
    
    is_remote = repo_url_str.startswith("http://") or repo_url_str.startswith("https://")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        repo_path = repo_url_str
        if is_remote:
            repo_path = os.path.join(temp_dir, "repo")
            start_clone = time.time()
            try:
                clone_result = subprocess.run(
                    ["git", "clone", "--depth", "1", "--single-branch", repo_url_str, repo_path],
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=600,
                )
                clone_duration = int((time.time() - start_clone) * 1000)
                logger.info(f"[ANALYZE] stage=clone_completed duration={clone_duration}ms")
                print(f"[ANALYZE] stage=clone_completed duration={clone_duration}ms")
                
                if clone_result.returncode != 0:
                    logger.error(f"[ANALYZE] clone failed: {clone_result.stderr}")
                    return JSONResponse(
                        status_code=400,
                        content={
                            "status": "failed",
                            "stage": "clone",
                            "message": f"Repository clone failed: {clone_result.stderr.strip()}"
                        }
                    )
            except subprocess.TimeoutExpired as exc:
                clone_duration = int((time.time() - start_clone) * 1000)
                logger.error(f"[ANALYZE] clone timed out: {exc}")
                return JSONResponse(
                    status_code=408,
                    content={
                        "status": "failed",
                        "stage": "clone",
                        "message": "Repository clone timed out. Try a smaller repo or retry later."
                    }
                )
        
        # Calculate size metrics (for filesScanned estimation)
        total_files = 0
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [
                d for d in dirs
                if not d.startswith(".")
                and d not in {
                    "node_modules", "dist", "build", ".git", "coverage", 
                    "vendor", "tmp", "__pycache__", ".pytest_cache", 
                    ".tox", ".mypy_cache", ".next", ".nuxt", "target", 
                    ".gradle", ".mvn", ".idea", ".vscode", ".venv", "venv", "env"
                }
            ]
            total_files += len(files)

        # Parse files
        logger.info(f"[ANALYZE] stage=parse_started files={total_files}")
        print(f"[ANALYZE] stage=parse_started files={total_files}")
        start_parse = time.time()
        parser_svc = ParserService()
        parsed_output = parser_svc.scan_repository(repo_path)
        parse_duration = int((time.time() - start_parse) * 1000)
        logger.info(f"[ANALYZE] stage=parse_completed duration={parse_duration}ms")
        print(f"[ANALYZE] stage=parse_completed duration={parse_duration}ms")

        # Store graph in Neo4j
        start_store = time.time()
        try:
            client = Neo4jClient()
            if client.test_connection():
                graph_svc = GraphService(client=client)
                repo_name = os.path.basename(repo_url_str.rstrip("/"))
                if not repo_name:
                    repo_name = "unknown_repo"
                
                # Pass timing metrics in parsed_output to store in the Repository node
                parsed_output["timing_metrics"] = {
                    "cloneTimeMs": clone_duration,
                    "parseTimeMs": parse_duration,
                    "graphStoreTimeMs": 0,
                    "gitActivityTimeMs": 0,
                    "totalAnalysisTimeMs": 0
                }
                
                graph_svc.store_graph(analysis_id, repo_name, parsed_output)
                store_duration = int((time.time() - start_store) * 1000)
                logger.info(f"[ANALYZE] stage=graph_store_completed duration={store_duration}ms")
                print(f"[ANALYZE] stage=graph_store_completed duration={store_duration}ms")
            client.close()
        except Exception as e:
            store_duration = int((time.time() - start_store) * 1000)
            logger.error(f"Neo4j storage error: {e}")
            print(f"Neo4j storage error: {e}")

        # Extract git metadata using canonical extract_activity
        start_activity = time.time()
        from app.services.git_metadata_service import extract_activity
        git_meta = extract_activity(repo_path, analysis_id, repo_url_str)
        activity_duration = int((time.time() - start_activity) * 1000)
        logger.info(f"[ANALYZE] stage=activity_completed duration={activity_duration}ms")
        print(f"[ANALYZE] stage=activity_completed duration={activity_duration}ms")

    total_duration = int((time.time() - total_start) * 1000)
    logger.info(f"[ANALYZE] stage=complete analysis_id={analysis_id}")
    print(f"[ANALYZE] stage=complete analysis_id={analysis_id}")

    # Seed mock data store so UI doesn't crash on other endpoints
    from app.services.mock_data import ANALYSIS_STORE, build_repo_summary, build_graph_payload, build_impact_payload, build_semantic_payload
    ANALYSIS_STORE[analysis_id] = {
        'repo_url': repo_url_str,
        'status': 'complete',
        'progress': 100,
        'summary': build_repo_summary('ParsedRepo'),
        'graph': build_graph_payload(),
        'impact': build_impact_payload(),
        'semantic': build_semantic_payload('What is the architecture?'),
    }

    metrics = AnalysisMetrics(
        cloneTimeMs=clone_duration,
        parseTimeMs=parse_duration,
        graphStoreTimeMs=store_duration,
        gitActivityTimeMs=activity_duration,
        totalAnalysisTimeMs=total_duration,
        filesScanned=parsed_output["summary"].get("files_scanned", total_files),
        filesParsed=parsed_output["summary"].get("files_parsed", 0),
        filesSkipped=parsed_output["summary"].get("files_skipped", 0),
        nodesWritten=parsed_output.get("nodes_written"),
        relationshipsWritten=parsed_output.get("relationships_written"),
        duplicatesRemoved=parsed_output.get("duplicates_removed")
    )

    return AnalyzeRepoResponse(
        id=analysis_id,
        status='complete',
        message='Repository analysis completed successfully.',
        metrics=metrics,
    )


@router.get('/analysis-status/{analysis_id}', response_model=AnalysisStatusResponse)
def analysis_status(analysis_id: str) -> AnalysisStatusResponse:
    status_payload = get_status(analysis_id)
    if not status_payload:
        raise HTTPException(status_code=404, detail='Analysis not found')

    return AnalysisStatusResponse(
        id=analysis_id,
        status=status_payload['status'],
        progress=status_payload['progress'],
        message=f"Analysis {status_payload['status']}.",
    )


@router.get('/repo-summary/{analysis_id}', response_model=RepoSummaryResponse)
def repo_summary(analysis_id: str) -> RepoSummaryResponse:
    item = get_analysis_result(analysis_id)
    if not item:
        raise HTTPException(status_code=404, detail='Analysis not found')
    summary = item['summary']
    return RepoSummaryResponse(**summary)


@router.get('/graph/{analysis_id}', response_model=GraphResponse)
def graph(analysis_id: str) -> GraphResponse:
    try:
        from app.graph.neo4j_client import Neo4jClient
        from app.services.graph_service import GraphService

        client = Neo4jClient()
        if client.test_connection():
            svc = GraphService(client=client)
            data = svc.get_graph_for_analysis(analysis_id)
            client.close()
            if data and data.get('nodes'):
                return GraphResponse(**data)
    except Exception:
        pass

    item = get_analysis_result(analysis_id)
    if not item:
        raise HTTPException(status_code=404, detail='Analysis not found')
    return GraphResponse(**item['graph'])


@router.get('/graph-real/{analysis_id}')
def graph_real(analysis_id: str) -> Any:
    """
    Return real graph data from Neo4j for the given analysis_id.
    Falls back to mock graph payload when Neo4j is unreachable or has no data.

    Response shape:
      {
        "source": "neo4j" | "mock",
        "nodes": [{"id", "type", "label", "metadata"}, ...],
        "edges": [{"id", "source", "target", "type"}, ...]
      }
    """
    try:
        from app.graph.neo4j_client import Neo4jClient
        from app.services.graph_service import GraphService

        client = Neo4jClient()
        if not client.test_connection():
            raise RuntimeError('Neo4j unreachable')

        svc = GraphService(client=client)
        data = svc.get_graph_for_analysis(analysis_id)
        client.close()

        if data['nodes']:
            logger.info("graph retrieved")
            print("graph retrieved")
            return {**data, 'source': 'neo4j'}

        # Neo4j connected but no nodes for this analysis – fall through to mock
    except Exception:
        pass

    # ── Fallback: convert mock graph to the unified shape ──────────────────
    item = get_analysis_result(analysis_id)
    mock_graph = item.get('graph', {'nodes': [], 'edges': []}) if item else {'nodes': [], 'edges': []}

    nodes = []
    for n in mock_graph.get('nodes', []):
        node_type = n.get('type', 'component')
        nodes.append({
            'id': n.get('id', ''),
            'type': node_type,
            'label': n.get('name', n.get('id', '')),
            'metadata': {
                'path': n.get('path', ''),
                'linesOfCode': n.get('linesOfCode', 0),
                'imports_count': n.get('importCount', 0),
                'exports_count': n.get('exportCount', 0),
                'complexity': n.get('complexity', 0),
                'description': n.get('description', ''),
                'exports': n.get('exports', []),
                'blastRadius': n.get('blastRadius', []),
                'lastModified': n.get('lastModified', ''),
            },
        })

    edges = []
    for e in mock_graph.get('edges', []):
        rel_type = 'FILE_IMPORTS_MODULE'
        if e.get('importType') == 'named':
            rel_type = 'FILE_CONTAINS_FUNCTION'
        edges.append({
            'id': e.get('id', ''),
            'source': e.get('source', ''),
            'target': e.get('target', ''),
            'type': rel_type,
        })

    logger.info("fallback used")
    print("fallback used")
    return {'source': 'mock', 'nodes': nodes, 'edges': edges}


@router.get('/impact-analysis/{analysis_id}', response_model=ImpactAnalysisResponse)
def impact_analysis(analysis_id: str) -> ImpactAnalysisResponse:
    item = get_analysis_result(analysis_id)
    if not item:
        raise HTTPException(status_code=404, detail='Analysis not found')
    return ImpactAnalysisResponse(**item['impact'])


@router.get('/impact-analysis-real/{analysis_id}', response_model=ImpactAnalysisRealResponse)
def impact_analysis_real(analysis_id: str, target: str = Query(..., min_length=1)) -> ImpactAnalysisRealResponse:
    """Return real impact analysis for the target node using Neo4j.

    Falls back to realistic mock impact analysis when Neo4j is unavailable.
    """
    try:
        client = Neo4jClient()
        if not client.test_connection():
            raise RuntimeError('Neo4j unreachable')

        svc = GraphService(client=client)
        result = svc.get_impact_analysis_for_target(analysis_id, target)
        client.close()

        if result:
            return ImpactAnalysisRealResponse(**result)
    except Exception as exc:
        logger.warning('impact analysis real failed: %s', exc)

    item = get_analysis_result(analysis_id)
    if not item:
        raise HTTPException(status_code=404, detail='Analysis not found')

    return ImpactAnalysisRealResponse(**build_impact_real_payload(item['impact'], target))


@router.get('/semantic-search/{analysis_id}', response_model=SemanticSearchResponse)
def semantic_search(analysis_id: str, query: str = Query(..., min_length=1)) -> SemanticSearchResponse:
    item = get_analysis_result(analysis_id)
    if not item:
        raise HTTPException(status_code=404, detail='Analysis not found')
    answer_payload = item['semantic']
    answer_payload['query'] = query
    return SemanticSearchResponse(**answer_payload)


@router.get('/semantic-search-real/{analysis_id}')
def semantic_search_real(analysis_id: str, query: str = Query(..., min_length=1)):
    """Return semantic search results from Neo4j for the analysis.

    Falls back to realistic mock semantic results when Neo4j is unavailable.
    """
    try:
        client = Neo4jClient()
        if not client.test_connection():
            raise RuntimeError('Neo4j unreachable')

        svc = GraphService(client=client)
        rows = svc.get_semantic_search(analysis_id, query, limit=50)
        client.close()

        if rows is not None:
            return {"source": "neo4j", "results": rows}
    except Exception as exc:
        logger.warning('semantic search real failed: %s', exc)

    # Fallback to mock
    item = get_analysis_result(analysis_id)
    if not item:
        raise HTTPException(status_code=404, detail='Analysis not found')
    mock = item.get('semantic', {})
    mock_results = mock.get('results', [])
    # Normalize mock results to expected shape
    normalized = []
    for r in mock_results:
        normalized.append({
            'type': r.get('type', 'file'),
            'name': r.get('file') or r.get('name') or r.get('path') or '',
            'filePath': r.get('path') or r.get('file') or '',
            'lineNumber': None,
            'score': min(1.0, (r.get('relevance', 50) / 100.0)),
            'reason': r.get('explanation', '')
        })
    return {"source": "mock", "results": normalized}


@router.post('/change-simulation/{analysis_id}', response_model=ChangeSimulationResponse)
def change_simulation(analysis_id: str, payload: ChangeSimulationRequest) -> ChangeSimulationResponse:
    try:
        client = Neo4jClient()
        if not client.test_connection():
            raise RuntimeError('Neo4j unreachable')

        svc = GraphService(client=client)
        result = svc.simulate_change(analysis_id, payload.target)
        client.close()

        if result:
            return ChangeSimulationResponse(**result)
    except Exception as exc:
        logger.warning('change simulation failed: %s', exc)

    item = get_analysis_result(analysis_id)
    if not item:
        raise HTTPException(status_code=404, detail='Analysis not found')

    impact_payload = item.get('impact', {})
    target_file = payload.target
    direct_deps = impact_payload.get('directDependents', [])
    transitive_deps = impact_payload.get('transitiveDependents', [])
    risk_score = impact_payload.get('impactScore', 50)

    return ChangeSimulationResponse(
        source='mock',
        target=target_file,
        directFiles=[target_file],
        directFunctions=direct_deps[:3],
        indirectFunctions=transitive_deps[:3],
        affectedClasses=[f.split('/')[-1].replace('.ts', 'Class').replace('.tsx', 'Class') for f in direct_deps[:2]],
        blastRadius=len(set(direct_deps + transitive_deps + [target_file])),
        riskScore=risk_score,
        explanation=(
            f"If this function changes, these modules may be impacted: "
            f"{', '.join(direct_deps[:5] + transitive_deps[:5])}"
        ),
    )


@router.get('/repository-summary-real/{analysis_id}', response_model=RepositorySummaryReal)
def repository_summary_real(analysis_id: str) -> RepositorySummaryReal:
    """Return comprehensive repository architecture analysis using Neo4j.

    Falls back to realistic mock summary when Neo4j is unavailable.
    """
    try:
        client = Neo4jClient()
        if not client.test_connection():
            raise RuntimeError('Neo4j unreachable')

        svc = RepositoryArchitectService(client=client)
        result = svc.analyze_repository(analysis_id)
        client.close()

        if result:
            return RepositorySummaryReal(**result)
    except Exception as exc:
        logger.warning('repository summary real failed: %s', exc)
        logger.warning('fallback reason=%s analysis_id=%s', str(exc), analysis_id)

    # Fallback to mock data
    return RepositorySummaryReal(**build_repository_summary_payload())


@router.post('/change-simulation-real/{analysis_id}', response_model=ChangeSimulationRealResponse)
def change_simulation_real(analysis_id: str, payload: ChangeSimulationRequest) -> ChangeSimulationRealResponse:
    """POST /change-simulation-real/{analysis_id}

    Runs a Neo4j graph traversal (up to 2 hops) to estimate the blast radius
    when the given target node changes.  Falls back to mock data only when
    Neo4j is unreachable or the target cannot be located.

    Input:  { "target": "<node id | function name | class name | file path>" }
    Output: ChangeSimulationRealResponse with structured blastRadius dict.
    """
    target = payload.target.strip()
    logger.info('[change-sim-real] analysis_id=%s target=%s', analysis_id, target)

    try:
        client = Neo4jClient()
        if not client.test_connection():
            raise RuntimeError('Neo4j unreachable')

        svc = GraphService(client=client)
        result = svc.simulate_change_real(analysis_id, target)
        client.close()

        if result:
            logger.info(
                '[change-sim-real] source=neo4j target=%s direct=%d indirect=%d total=%d risk=%d',
                target,
                result['blastRadius']['direct'],
                result['blastRadius']['indirect'],
                result['blastRadius']['total'],
                result['riskScore'],
            )
            return ChangeSimulationRealResponse(**result)

        logger.info('[change-sim-real] target=%s not found — using mock fallback', target)
    except Exception as exc:
        logger.warning('[change-sim-real] neo4j failed: %s — using mock fallback', exc)

    # ── Mock fallback ──────────────────────────────────────────────────────
    item = get_analysis_result(analysis_id)
    impact = item.get('impact', {}) if item else {}
    direct_deps = impact.get('directDependents', [])
    transitive_deps = impact.get('transitiveDependents', [])
    risk_score = impact.get('impactScore', 50)
    direct_count = len(direct_deps)
    indirect_count = len(transitive_deps)
    total_count = len(set(direct_deps + transitive_deps + [target]))

    mock_target = {
        'id': f'mock:{target}',
        'type': 'function',
        'label': target,
        'metadata': {},
    }
    return ChangeSimulationRealResponse(
        source='mock',
        target=mock_target,
        directlyAffectedFiles=[target],
        directlyAffectedFunctions=direct_deps[:3],
        indirectlyAffectedFunctions=transitive_deps[:3],
        affectedClasses=[
            f.split('/')[-1].replace('.ts', 'Class').replace('.tsx', 'Class')
            for f in direct_deps[:2]
        ],
        blastRadius={'direct': direct_count, 'indirect': indirect_count, 'total': total_count},
        riskScore=risk_score,
        explanation=(
            f'If this node changes, these modules may be impacted: '
            f'{", ".join((direct_deps + transitive_deps)[:5])}'
        ),
    )


@router.get('/repository-activity/{analysis_id}', response_model=RepositoryActivityResponse)
def repository_activity(analysis_id: str) -> RepositoryActivityResponse:
    """
    Return Git metadata (commits, contributors, file ownership) for a given analysis.

    Data is populated when the repo is analysed via POST /analyze-repo.
    Returns source='unavailable' if no git metadata was captured (e.g. shallow clone
    or the analysisId pre-dates this feature).
    """
    from app.services.git_metadata_service import get_git_metadata_debug_info
    debug_info = get_git_metadata_debug_info(analysis_id)
    
    meta = get_git_metadata(analysis_id)
    source = meta.get('source') if meta else 'unavailable'
    
    logger.info(
        "[DEBUG-ACTIVITY] requested_id=%s, in_memory=%s, on_disk=%s, path_checked=%s, source_returned=%s",
        analysis_id, debug_info["in_memory"], debug_info["on_disk"], debug_info["file_path"], source
    )

    if not meta or meta.get('source') == 'unavailable':
        return RepositoryActivityResponse(
            source='unavailable',
            overview=None,
            recentCommits=[],
            contributors=[],
        )

    try:
        overview_raw = meta.get('overview', {})
        overview = None
        if overview_raw:
            from app.models.schemas import RepositoryOverview
            overview = RepositoryOverview(**overview_raw)

        from app.models.schemas import RecentCommit, Contributor, FileTouched
        recent_commits = [
            RecentCommit(**c) for c in meta.get('recentCommits', [])
        ]
        contributors = []
        for c in meta.get('contributors', []):
            files_touched = [
                FileTouched(**f) for f in c.get('filesTouched', [])
            ]
            contributors.append(
                Contributor(
                    name=c['name'],
                    email=c['email'],
                    commitCount=c['commitCount'],
                    lastActiveDate=c['lastActiveDate'],
                    filesTouched=files_touched,
                    primaryAreas=c.get('primaryAreas', []),
                )
            )

        return RepositoryActivityResponse(
            source='git',
            overview=overview,
            recentCommits=recent_commits,
            contributors=contributors,
        )
    except Exception as exc:
        logger.error('[repository-activity] serialisation error: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))
