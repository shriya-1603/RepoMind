from uuid import uuid4
from typing import Dict, Any

ANALYSIS_STORE: Dict[str, Dict[str, Any]] = {}


def _seed_demo() -> None:
    """Pre-populate a well-known 'demo' analysis so /graph-real/demo always works."""
    ANALYSIS_STORE['demo'] = {
        'repo_url': 'https://github.com/demo/repomind',
        'status': 'complete',
        'progress': 100,
        'summary': build_repo_summary('RepoMind'),
        'graph': build_graph_payload(),
        'impact': build_impact_payload(),
        'semantic': build_semantic_payload('What is the architecture?'),
    }



def build_repo_summary(repo_name: str) -> Dict[str, Any]:
    return {
        'repo_name': repo_name,
        'files': 123,
        'functions': 524,
        'classes': 87,
        'dependencies': 431,
        'risk_score': 72,
    }


def build_graph_payload() -> Dict[str, Any]:
    nodes = [
        {
            'id': 'node-1',
            'path': 'src/App.tsx',
            'name': 'App.tsx',
            'type': 'component',
            'linesOfCode': 124,
            'exports': ['App'],
            'importCount': 8,
            'exportCount': 2,
            'complexity': 6,
            'lastModified': '3 hours ago',
            'description': 'Root application component. Sets up routing and page layout.',
            'sourcePreview': "import React from 'react';\nimport { BrowserRouter, Routes, Route } from 'react-router-dom';\n// ...",
            'blastRadius': ['node-2', 'node-3', 'node-5'],
        },
        {
            'id': 'node-2',
            'path': 'src/hooks/useGraphData.ts',
            'name': 'useGraphData.ts',
            'type': 'hook',
            'linesOfCode': 198,
            'exports': ['useGraphData'],
            'importCount': 6,
            'exportCount': 2,
            'complexity': 11,
            'lastModified': '6 hours ago',
            'description': 'Custom hook for fetching and transforming dependency graph data.',
            'sourcePreview': "import { useState, useEffect } from 'react';\n// ...",
            'blastRadius': ['node-1', 'node-4'],
        },
        {
            'id': 'node-3',
            'path': 'src/pages/GraphExplorer.tsx',
            'name': 'GraphExplorer.tsx',
            'type': 'page',
            'linesOfCode': 650,
            'exports': ['GraphExplorer'],
            'importCount': 12,
            'exportCount': 1,
            'complexity': 24,
            'lastModified': '2 days ago',
            'description': 'UI page for exploring the code dependency graph and node details.',
            'sourcePreview': "import React from 'react';\n// ...",
            'blastRadius': ['node-2', 'node-4'],
        },
    ]
    edges = [
        {
            'id': 'e-1-2',
            'source': 'node-1',
            'target': 'node-2',
            'importType': 'named',
            'symbols': ['useGraphData'],
        },
        {
            'id': 'e-1-3',
            'source': 'node-1',
            'target': 'node-3',
            'importType': 'default',
            'symbols': ['GraphExplorer'],
        },
        {
            'id': 'e-2-3',
            'source': 'node-2',
            'target': 'node-3',
            'importType': 'named',
            'symbols': ['buildFlowNodes'],
        },
    ]
    return {'nodes': nodes, 'edges': edges}


def build_impact_payload() -> Dict[str, Any]:
    return {
        'id': 'impact-1',
        'targetFile': 'src/App.tsx',
        'riskLevel': 'medium',
        'directDependents': ['src/hooks/useGraphData.ts', 'src/pages/GraphExplorer.tsx'],
        'transitiveDependents': ['src/pages/SemanticSearch.tsx', 'src/pages/ImpactAnalysis.tsx'],
        'impactScore': 68,
        'recommendations': [
            'Refactor shared hook imports to reduce coupling.',
            'Introduce a stable API layer for cross-page graph access.',
        ],
        'scenarios': [
            {
                'id': 'sc-1',
                'title': 'Extract Graph Provider',
                'summary': 'Move shared graph logic into a reusable provider and reduce duplicated imports.',
                'affectedFiles': ['src/App.tsx', 'src/pages/GraphExplorer.tsx', 'src/hooks/useGraphData.ts'],
                'outcome': 'Reduced blast radius and improved tree-shakeability.',
            },
            {
                'id': 'sc-2',
                'title': 'Split AST parsing into worker',
                'summary': 'Use a background worker to precompute AST metadata, reducing frontend blocking.',
                'affectedFiles': ['src/pages/GraphExplorer.tsx', 'src/components/CustomNode.tsx'],
                'outcome': 'Faster page load and smoother interactive graph updates.',
            },
        ],
    }


def build_semantic_payload(query: str) -> Dict[str, Any]:
    answer = (
        'The current repo is modeled after a frontend-first analysis flow. The backend can index the codebase, build a dependency graph, '
        'and return semantic answers for natural language queries.'
    )
    return {
        'query': query,
        'answer': answer,
        'confidence': 0.92,
        'sources': ['src/pages/GraphExplorer.tsx', 'src/hooks/useGraphData.ts'],
        'results': [
            {
                'file': 'useGraphData.ts',
                'path': 'src/hooks/useGraphData.ts',
                'relevance': 97,
                'snippet': 'const { nodes, edges, loading } = useGraphData(repoId);',
                'type': 'hook',
                'explanation': 'Core hook used by graph explorer to fetch and transform repo dependency data.',
            },
            {
                'file': 'GraphExplorer.tsx',
                'path': 'src/pages/GraphExplorer.tsx',
                'relevance': 88,
                'snippet': 'const buildFlowNodes = (): Node[] => {...}',
                'type': 'page',
                'explanation': 'Visualizer page that renders graph nodes and edges and exposes file metadata.',
            },
        ],
    }


def build_impact_real_payload(impact_data: Dict[str, Any], target: str) -> Dict[str, Any]:
    """Build realistic mock impact analysis response when Neo4j unavailable."""
    target_file = impact_data.get('targetFile', target)
    risk_level = impact_data.get('riskLevel', 'medium')
    
    risk_score_map = {'low': 25, 'medium': 55, 'high': 75, 'critical': 90}
    risk_score = risk_score_map.get(risk_level, 55)
    
    direct_deps = impact_data.get('directDependents', [])
    transitive_deps = impact_data.get('transitiveDependents', [])
    
    upstream_nodes = [
        {
            'id': f'file:upstream-{i}',
            'type': 'file',
            'label': dep,
            'metadata': {'path': dep, 'rel_path': dep}
        }
        for i, dep in enumerate(direct_deps[:3])
    ]
    
    downstream_nodes = [
        {
            'id': f'file:downstream-{i}',
            'type': 'file',
            'label': dep,
            'metadata': {'path': dep, 'rel_path': dep}
        }
        for i, dep in enumerate(transitive_deps[:4])
    ]
    
    affected_files = list(set(direct_deps + transitive_deps))
    affected_functions = [f.replace('.ts', '').replace('.tsx', '') for f in affected_files[:3]]
    affected_classes = [f.split('/')[-1].replace('.ts', 'Class') for f in affected_files[:2]]
    
    explanation = (
        f"**{risk_level.upper()} IMPACT** — Modifying `{target_file}` affects {len(downstream_nodes)} downstream dependents. "
        f"{len(upstream_nodes)} direct dependencies provide essential services. "
        f"Risk score: {risk_score}/100. " + 
        ("Deploy behind feature flag and run full test suite." if risk_score >= 70 else "Standard testing recommended.")
    )
    
    return {
        'source': 'mock',
        'targetNode': {
            'id': f'file:target',
            'type': 'file',
            'label': target_file,
            'metadata': {'path': target_file, 'rel_path': target_file}
        },
        'upstreamDependencies': upstream_nodes,
        'downstreamDependencies': downstream_nodes,
        'affectedFiles': affected_files,
        'affectedFunctions': affected_functions,
        'affectedClasses': affected_classes,
        'dependencyCounts': {
            'upstream': len(upstream_nodes),
            'downstream': len(downstream_nodes),
            'total': len(set([n['id'] for n in upstream_nodes + downstream_nodes]))
        },
        'riskScore': risk_score,
        'explanation': explanation,
    }


def enqueue_analysis(repo_url: str) -> str:
    analysis_id = f'analysis-{uuid4().hex[:8]}'
    ANALYSIS_STORE[analysis_id] = {
        'repo_url': repo_url,
        'status': 'queued',
        'progress': 0,
        'summary': build_repo_summary('RepoMind'),
        'graph': build_graph_payload(),
        'impact': build_impact_payload(),
        'semantic': build_semantic_payload('What is the architecture?'),
    }
    return analysis_id


def get_status(analysis_id: str) -> Dict[str, Any]:
    item = ANALYSIS_STORE.get(analysis_id)
    if not item:
        return {}
    if item['status'] == 'queued':
        item['status'] = 'complete'
        item['progress'] = 100
    return item


def get_analysis_result(analysis_id: str) -> Dict[str, Any]:
    return ANALYSIS_STORE.get(analysis_id, {})



def build_repository_summary_payload() -> Dict[str, Any]:
    """Build realistic mock repository architect summary when Neo4j unavailable."""
    return {
        'source': 'mock',
        'totalFiles': 87,
        'totalClasses': 34,
        'totalFunctions': 156,
        'totalImports': 203,
        'majorModules': [
            {
                'name': 'src',
                'path': 'src',
                'fileCount': 42,
                'functionCount': 78,
                'classCount': 12,
                'importCount': 89,
                'description': 'Source code containing core application logic'
            },
            {
                'name': 'pages',
                'path': 'src/pages',
                'fileCount': 18,
                'functionCount': 34,
                'classCount': 5,
                'importCount': 45,
                'description': 'Full-page components and layouts'
            },
            {
                'name': 'components',
                'path': 'src/components',
                'fileCount': 15,
                'functionCount': 28,
                'classCount': 8,
                'importCount': 38,
                'description': 'Reusable React/UI components'
            },
            {
                'name': 'hooks',
                'path': 'src/hooks',
                'fileCount': 8,
                'functionCount': 12,
                'classCount': 2,
                'importCount': 18,
                'description': 'Custom React hooks and state management'
            },
        ],
        'highlyCoupled': ['src/App.tsx', 'src/services/api.ts', 'src/pages/Dashboard.tsx'],
        'mostDependedOnFiles': [
            {'name': 'api.ts', 'type': 'file', 'path': 'src/services/api.ts', 'dependencyCount': 18, 'complexity': 6, 'criticality': 1.0},
            {'name': 'App.tsx', 'type': 'file', 'path': 'src/App.tsx', 'dependencyCount': 14, 'complexity': 5, 'criticality': 0.78},
            {'name': 'useGraphData.ts', 'type': 'file', 'path': 'src/hooks/useGraphData.ts', 'dependencyCount': 11, 'complexity': 4, 'criticality': 0.61},
        ],
        'mostDependedOnFunctions': [
            {'name': 'apiFetch', 'type': 'function', 'path': 'src/services/api.ts', 'dependencyCount': 12, 'complexity': 0, 'criticality': 1.0},
            {'name': 'useGraphData', 'type': 'function', 'path': 'src/hooks/useGraphData.ts', 'dependencyCount': 9, 'complexity': 0, 'criticality': 0.75},
        ],
        'mostDependedOnClasses': [
            {'name': 'GraphService', 'type': 'class', 'path': 'backend/app/services/graph_service.py', 'dependencyCount': 7, 'complexity': 5, 'criticality': 1.0},
        ],
        'onboardingPath': [
            {'step': 1, 'title': 'Understand the Architecture', 'description': 'Start with the structure overview to understand how components are organized.', 'keyFiles': ['src', 'backend/app', 'src/pages'], 'rationale': 'Understanding the modular structure helps orient new developers.'},
            {'step': 2, 'title': 'Core Files & Entry Points', 'description': 'These files are central and depended on by many others.', 'keyFiles': ['src/services/api.ts', 'src/App.tsx', 'src/hooks/useGraphData.ts'], 'rationale': 'Central files form the backbone of the system.'},
            {'step': 3, 'title': 'Critical Functions & APIs', 'description': 'These 2 functions are heavily used across the codebase.', 'keyFiles': ['apiFetch', 'useGraphData'], 'rationale': 'Knowing critical functions helps avoid duplicating work.'},
            {'step': 4, 'title': 'Class Designs & Patterns', 'description': 'These classes define key abstractions.', 'keyFiles': ['GraphService'], 'rationale': 'Class hierarchies represent core domain models.'},
            {'step': 5, 'title': 'Integration & Testing', 'description': 'Practice integrating with and testing the system.', 'keyFiles': ['tests/', 'integration/'], 'rationale': 'Hands-on practice solidifies understanding.'},
        ],
        'riskAreas': [
            {'type': 'excessive_dependencies', 'severity': 'high', 'nodes': ['src/services/api.ts', 'src/App.tsx'], 'description': 'These files are heavily depended on (18 max incoming dependencies), creating potential bottlenecks.', 'recommendation': 'Consider refactoring into smaller, more focused modules to reduce coupling.'},
            {'type': 'coupling', 'severity': 'medium', 'nodes': ['src/pages/Dashboard.tsx', 'src/pages/GraphExplorer.tsx'], 'description': 'High coupling detected between page components.', 'recommendation': 'Extract shared logic into custom hooks or services.'},
        ],
        'overallRiskScore': 58,
        'aiSummary': 'The codebase is organized into **4 main modules**, with `src` as the largest. **api.ts** is the most central module — depended on by the majority of the codebase. Overall architectural risk: **moderate** (58/100). Key concerns: excessive dependencies, coupling.',
        'repositoryIntelligence': {
            'projectPurpose': {
                'title': 'Developer Tooling / Code Intelligence',
                'description': (
                    'A developer tooling platform that parses Git repositories into a queryable knowledge graph, '
                    'enabling architecture understanding without documentation. Core operations include parsing source files, '
                    'storing dependency relationships, and analyzing graph topology to generate architectural intelligence. '
                    'Data is persisted with Neo4j. graph_service.py is the central coordination point (18 incoming dependencies).'
                ),
                'confidence': 91,
                'evidence': [
                    'imports tree-sitter (AST parsing)',
                    'imports neo4j driver (graph persistence)',
                    'module names: parsers/, graph/, services/',
                    'function names suggest: parsing source files, analyzing content',
                    'graph_service.py: fan-in 18 (graph topology)',
                ],
            },
            'executionFlow': [
                {
                    'step': 'backend/app/api/routes.py -> repository_summary_real() -> RepositoryArchitectService.analyze_repository()',
                    'evidence': ['FastAPI router routes request to analysis orchestration engine']
                },
                {
                    'step': 'backend/app/services/repository_architect.py -> analyze_repository() -> _generate_repository_intelligence() -> _build_execution_flow()',
                    'evidence': ['Orchestrator generates technical briefing including AST call trace reconstruction']
                },
                {
                    'step': 'backend/app/services/repository_architect.py -> _build_execution_flow() -> Neo4jClient.run_query()',
                    'evidence': ['Cypher query matches FILE_CONTAINS_FUNCTION and FUNCTION_CALLS_FUNCTION edges']
                },
                {
                    'step': 'backend/app/services/graph_service.py -> GraphService.query_centrality() -> Neo4jClient.run_query()',
                    'evidence': ['Graph service executes centrality query to calculate file hotspots']
                }
            ],
            'workflowConfidence': 94,
            'workflowReconstructed': True,
            'startHere': [
                {
                    'order': 1,
                    'file': 'routes.py',
                    'path': 'backend/app/api/routes.py',
                    'reason': 'Defines the full API surface. Reading this first reveals what the system can do and how analysis is triggered end-to-end.',
                    'callChain': None,
                },
                {
                    'order': 2,
                    'file': 'parser_service.py',
                    'path': 'backend/app/services/parser_service.py',
                    'reason': 'Orchestrates multi-language parsing. The entry point for understanding how raw files become structured graph data.',
                    'callChain': ['scan_files()', 'dispatch_parser()', 'extract_ast_nodes()'],
                },
                {
                    'order': 3,
                    'file': 'graph_service.py',
                    'path': 'backend/app/services/graph_service.py',
                    'reason': '18 other components depend on this file. The most depended-on file in the graph — understanding this unlocks most of the codebase.',
                    'callChain': None,
                },
                {
                    'order': 4,
                    'file': 'repository_architect.py',
                    'path': 'backend/app/services/repository_architect.py',
                    'reason': 'Converts raw graph topology into architecture intelligence. This is where RepoMind\'s core value is generated.',
                    'callChain': ['analyze_repository()', '_infer_domain_v2()', '_build_start_here()'],
                },
                {
                    'order': 5,
                    'file': 'Dashboard.tsx',
                    'path': 'src/pages/Dashboard.tsx',
                    'reason': 'The primary React page. Shows how the frontend consumes and renders the intelligence data from the backend.',
                    'callChain': None,
                },
                {
                    'order': 6,
                    'file': 'schemas.py',
                    'path': 'backend/app/models/schemas.py',
                    'reason': 'Defines the data contracts used throughout the application. Read this to understand what flows between components.',
                    'callChain': None,
                },
            ],
            'estimatedOnboardingMinutes': 30,
            'estimatedUnderstandingPct': 80,
            'repositoryLayers': [
                {
                    'name': 'API Layer',
                    'description': 'HTTP routing and request handling',
                    'components': ['routes.py', 'main.py'],
                },
                {
                    'name': 'Analysis Engine',
                    'description': 'Repository parsing, graph construction, and intelligence generation',
                    'components': ['parser_service.py', 'repository_architect.py', 'graph_service.py'],
                },
                {
                    'name': 'Language Parsers',
                    'description': 'Language-specific AST extraction',
                    'components': ['python_parser.py', 'jsts_parser.py', 'java_parser.py'],
                },
                {
                    'name': 'Graph Infrastructure',
                    'description': 'Neo4j driver, query execution, and connection management',
                    'components': ['neo4j_client.py', 'graph_service.py'],
                },
                {
                    'name': 'Data Models',
                    'description': 'Pydantic schemas and data validation contracts',
                    'components': ['schemas.py', 'mock_data.py'],
                },
                {
                    'name': 'Frontend / UI',
                    'description': 'React dashboard with graph visualization and intelligence panels',
                    'components': ['Dashboard.tsx', 'GraphExplorer.tsx', 'ImpactAnalysis.tsx'],
                },
            ],
            'criticalFiles': [
                {
                    'name': 'graph_service.py',
                    'path': 'backend/app/services/graph_service.py',
                    'fanIn': 18,
                    'affectedFunctions': 47,
                    'affectedModules': 6,
                    'executionPct': 93,
                    'reason': 'Central database query execution and node/edge storage coordinator.',
                },
                {
                    'name': 'api.ts',
                    'path': 'src/services/api.ts',
                    'fanIn': 14,
                    'affectedFunctions': 32,
                    'affectedModules': 5,
                    'executionPct': 82,
                    'reason': 'Primary API client for frontend state management and fetch calls.',
                },
                {
                    'name': 'routes.py',
                    'path': 'backend/app/api/routes.py',
                    'fanIn': 11,
                    'affectedFunctions': 28,
                    'affectedModules': 4,
                    'executionPct': None,
                    'reason': 'FastAPI router mapping requests to system backend orchestration layers.',
                },
                {
                    'name': 'Dashboard.tsx',
                    'path': 'src/pages/Dashboard.tsx',
                    'fanIn': 9,
                    'affectedFunctions': 22,
                    'affectedModules': 4,
                    'executionPct': None,
                    'reason': 'Core user interface container exposing analytics metrics and intelligence briefs.',
                },
            ],
            'architecture': [
                {
                    'title': 'Graph-first persistence (Neo4j)',
                    'description': 'Neo4j is the sole data store. Relationships between code entities are graph edges — enabling multi-hop traversal that relational joins cannot efficiently express.',
                    'evidence': ['Neo4j is the only database import detected', 'No SQLAlchemy or relational DB driver detected'],
                },
                {
                    'title': 'Parsing decoupled from persistence',
                    'description': 'The parser layer produces a language-agnostic representation. The service layer handles graph storage independently. Adding a new language only requires a new parser — the graph layer stays unchanged.',
                    'evidence': ['Separate parsers/ and services/ directories detected', 'graph_service.py has no language-specific logic'],
                },
                {
                    'title': 'Mock-first resilience',
                    'description': 'Every real-data endpoint falls back to mock data when Neo4j is unreachable. The UI never crashes — but users may not know they are seeing demo data rather than their actual repository.',
                    'evidence': ['try/except blocks around Neo4j calls in all route handlers', 'mock_data.build_repository_summary_payload() called on connection error'],
                },
                {
                    'title': 'API-first design',
                    'description': 'All functionality is exposed through a REST API (FastAPI). Designed to be consumed by external clients — no server-side rendering.',
                    'evidence': ['FastAPI is the web framework', 'No server-side template rendering detected'],
                },
                {
                    'title': 'Schema-first validation (Pydantic)',
                    'description': 'Pydantic validates all data at the API boundary. Invalid inputs are rejected before reaching business logic — but TypeScript interfaces in the frontend are kept manually in sync.',
                    'evidence': ['Pydantic import detected at API layer', 'TypeScript interfaces manually maintained in repoApi.ts'],
                },
            ],
            'integrations': [
                {
                    'title': 'Neo4j',
                    'description': 'Graph database. Stores parsed code nodes and their relationships for traversal queries.',
                    'evidence': ['found in neo4j_client.py', 'found in graph_service.py'],
                },
                {
                    'title': 'Tree-sitter',
                    'description': 'AST parser. Extracts nodes from Python, JS/TS, and Java source files.',
                    'evidence': ['found in python_parser.py', 'found in jsts_parser.py'],
                },
                {
                    'title': 'FastAPI',
                    'description': 'REST API framework. Auto-generates OpenAPI docs and integrates with Pydantic.',
                    'evidence': ['found in main.py', 'found in routes.py'],
                },
                {
                    'title': 'React + React Flow',
                    'description': 'Frontend framework and graph visualization library for the interactive dependency explorer.',
                    'evidence': ['found in App.tsx', 'found in GraphExplorer.tsx'],
                },
                {
                    'title': 'Framer Motion',
                    'description': 'Animation library for UI transitions and micro-interactions in the dashboard.',
                    'evidence': ['found in Dashboard.tsx', 'found in GraphExplorer.tsx'],
                },
            ],
            'complexity': {
                'title': 'Moderate-high coupling',
                'description': (
                    'graph_service.py has 18 incoming dependencies — nearly every backend workflow eventually routes through it. '
                    'High fan-in is also detected around api.ts (14 incoming) on the frontend. '
                    'Modifications to these files cascade across a significant portion of the codebase.'
                ),
                'evidence': [
                    'fan-in: 18 on graph_service.py (graph analysis)',
                    'fan-in: 14 on api.ts (graph analysis)',
                    'overall risk score: 58/100',
                    '2 risk areas detected (excessive dependencies, coupling)',
                ],
            },
            'domain': {
                'domain': 'Developer Tooling / Code Intelligence',
                'confidence': 91,
                'language': 'definite',
                'evidence': [
                    'imports tree-sitter for AST parsing',
                    'imports neo4j driver (graph persistence)',
                    'parser/lexer module names',
                    'parse/tokenize function names',
                ],
            },
            'observations': [
                {
                    'title': 'graph_service.py is a coordination hub',
                    'description': '93% of the backend depends on graph_service.py. It\'s not technically a bottleneck now — but nearly any architectural change will affect it.',
                    'evidence': ['fan-in: 18', '87 total files', 'identified by graph fan-in analysis'],
                },
                {
                    'title': 'Three-stage pipeline architecture',
                    'description': 'Most code intelligence tools merge parsing and graph construction into a single pass. This project separates them — parse, then graph, then service — making new language support trivially additive.',
                    'evidence': ['parsers/ module detected', 'graph/ module detected', 'services/ module detected'],
                },
                {
                    'title': 'Mock fallback silently serves stale data',
                    'description': 'When Neo4j is unreachable, every endpoint serves realistic mock data with no UI warning. Users may not know they are seeing demo data rather than their actual repository.',
                    'evidence': ['try/except fallback in all /repo-summary/* handlers', 'build_repository_summary_payload() called on connection error'],
                },
                {
                    'title': 'Architecture inferred without documentation',
                    'description': 'No README was required. Domain, purpose, and structure were reconstructed entirely from import analysis, function names, and graph topology.',
                    'evidence': ['No README detected in parsed file set', 'All insights derived from AST + graph signals'],
                },
            ],
            'closingSentence': (
                'Start by understanding graph_service.py — everything else in the backend either feeds into it or depends on what it produces.'
            ),
        },
    }


# Seed the well-known demo entry at import time so /graph-real/demo always works.
_seed_demo()
