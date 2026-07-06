RepoMind Backend Architecture & Pipeline Specifications
This document provides a detailed breakdown of the FastAPI-based backend architecture for RepoMind, detailing components, routing logic, services, and schema specifications.
--------------------------------------------------------------------------------
🏗 Directory Structure
backend/
├── app/
│   ├── api/
│   │   └── routes.py                 # REST Endpoints mapping web clients to controllers
│   ├── models/
│   │   └── schemas.py                # Pydantic Schemas validating requests/responses
│   ├── services/
│   │   ├── repository_architect.py   # Main orchestrator service layer
│   │   └── repository_intelligence/  # Decoupled intelligence pipeline folder
│   │       ├── engine/
│   │       │   ├── pipeline.py       # Dependency resolution, sorting, and cycle checks
│   │       │   ├── context.py        # execution state maps
│   │       │   └── models.py         # Response schemas
│   │       ├── facts/
│   │       │   ├── facts_builder.py  # Compiles all AST and graph parameters into facts dict
│   │       │   ├── graph_repository.py # Interface protocols and concrete Neo4j operations
│   │       │   ├── cache_provider.py # Cache resolution provider proxy
│   │       │   ├── cache.py          # Local facts cache manager
│   │       │   └── graph_analyzer.py # Graph metric calculations (centrality, PageRank)
│   │       └── generators/           # Decoupled pipeline steps
│   │           ├── base_generator.py # Base step class with output_key & requires fields
│   │           ├── domain_generator.py
│   │           ├── technology_generator.py
│   │           ├── purpose_generator.py
│   │           ├── execution_flow_generator.py
│   │           ├── reading_guide_generator.py
│   │           ├── layers_generator.py
│   │           ├── architecture_generator.py
│   │           ├── critical_files_generator.py
│   │           ├── complexity_generator.py
│   │           ├── health_generator.py
│   │           └── observations_generator.py
│   └── main.py                       # FastAPI application entry point
└── requirements.txt
--------------------------------------------------------------------------------
⚡ Main App Entry Point (main.py)
Configures the FastAPI application instance. Sets up CORS Middlewares to permit communication from the frontend host (http://localhost:5173), configures JSON routers, and binds the primary routes.
--------------------------------------------------------------------------------
🌐 API Routes & Schema Mappings (routes.py)
📊 1. Repository Activity & Metrics
GET /repository-summary-real/{analysisId}
Output: Detailed repository summary payload containing:
  - projectPurpose: High-level overview card
  - executionFlow: Reconstructed execution steps
  - startHere: Onboarding guide file sequence
  - repositoryLayers: Clustered directory modules
  - integrations: Detected technologies list
  - criticalFiles: High fan-in file blast-radiuses
  - complexity: Centralization coupling details
  - healthScore: Deducted code health scores
  - observations: Bottlenecks and circular loops
  - architecture: Persistence and web-design tradeoffs
--------------------------------------------------------------------------------
🔄 Core Ingestion & Analysis Flow
1. User enters GitHub URL on UI.
2. Frontend triggers POST /repositories/import to clone repository.
3. AST Parser runs and loads symbols.
4. Neo4j client imports code relationships (FILE_CONTAINS_FUNCTION, FUNCTION_CALLS_FUNCTION).
5. User navigates to Dashboard, triggering GET /repository-summary-real/{analysisId}.
6. RepositoryArchitectService calls CachedFactsProvider to check cached facts.
   - If Cache Miss: GraphRepository queries database records and compiles facts via FactsBuilder. Saves facts.json.
   - If Cache Hit: Loads facts.json directly.
7. Pipeline engine resolves execution order of all 11 generators dynamically via a topological sort.
8. Pipeline resolves step execution sequentially, profiling execution times.
9. Final assembler maps outputs to schemas.py response model and returns payload.
