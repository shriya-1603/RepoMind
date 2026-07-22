# RepoMind — Repository Intelligence Platform

RepoMind is a static analysis and codebase intelligence engine. It builds a semantic representation of a repository by parsing abstract syntax trees (ASTs), importing code relationships into a Neo4j graph database, and running a decoupled, dependency-sorted pipeline of specialized intelligence generators.

---




## 🖥️ Screen Previews
<table width="100%">
  <tr>
    <td width="50%" align="center">
      <b>Landing Page</b><br/>
      <img src="docs/screenshots/landing.png" alt="Landing Page Preview" width="100%"/>
    </td>
    <td width="50%" align="center">
      <b>Dashboard</b><br/>
      

  https://github.com/user-attachments/assets/101bdd83-19ce-45e3-9e4a-1e63d9489b2c


      <img src="docs/screenshots/dashboard.png" alt="Dashboard Preview" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="100%" align="center" colspan="2">
      <b>System Explorer (Interactive Code Graph)</b><br/>
      <img src="docs/screenshots/system_explorer.png" alt="System Explorer Preview" width="100%"/>
    </td>
  </tr>
</table>

---

## 🏗 System Architecture Flowchart

The following diagram illustrates the complete runtime request-response lifecycle. It details how the frontend React client communicates with the FastAPI routes, how the service layer resolves facts caching, and how the pipeline engine uses topological sorting to execute single-purpose reasoning generators.

```mermaid
flowchart TD
    %% Styling Classes
    classDef startEnd fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#155724;
    classDef decision fill:#fff3cd,stroke:#ffc107,stroke-width:2px,color:#856404;
    classDef step fill:#e8f4fd,stroke:#2b8a3e,stroke-width:1px,color:#0b7285;
    classDef database fill:#f8f9fa,stroke:#6c757d,stroke-width:2px,color:#343a40;

    subgraph ClientLayer ["1. Frontend React Dashboard"]
        UI[User visits Dashboard page] -->|Request summary metrics| Axios[Axios API Client makes REST call]
    end

    subgraph APIOrchestration ["2. FastAPI API Router"]
        Axios -->|Ingest GET Request| Router[routes.py Endpoint Router]
        Router -->|Delegate orchestration| Service[RepositoryArchitectService Controller]
    end

    subgraph FactsLayer ["3. Facts Compiler & Caching Layer"]
        Service -->|Check cache registry| CacheProxy[CachedFactsProvider Proxy]
        
        CacheProxy -->|Cache Hit| CacheHit{Is analysis cached?}:::decision
        CacheHit -->|Yes| ReadCache[Read compiled facts.json from disk]:::step
        CacheHit -->|No / Cache Miss| BuildFacts[Invoke FactsBuilder Compiler]:::step
        
        BuildFacts -->|DIP Protocol| GraphRepo[GraphRepositoryProtocol Interface]
        GraphRepo -->|Cypher Queries| Neo4jRepo[Neo4jGraphRepository concrete implementation]
        Neo4jRepo -->|Fetch AST nodes| Neo4j[(Neo4j Graph Database)]:::database
        
        Neo4j -->|Return raw nodes & edges| Neo4jRepo
        Neo4jRepo -->|Translate Cypher records| GraphRepo
        GraphRepo -->|Compile facts model| BuildFacts
        BuildFacts -->|Save to disk cache| SaveCache[Write facts.json cache file]:::step
        SaveCache --> ReadCache
    end

    subgraph PipelineLayer ["4. Dependency Intelligence Pipeline"]
        ReadCache --> PipelineEngine[Instantiate RepositoryIntelligencePipeline]
        PipelineEngine -->|Order steps| Resolver[Topological Sort Step Resolver]
        Resolver -->|Execute sequential queue| PipelineRegistry[Generator Sequence Queue]
        
        PipelineRegistry -->|1. Detect Archetype| Dom[DomainGenerator]:::step
        PipelineRegistry -->|2. Detect Frameworks| Tech[TechnologyGenerator]:::step
        PipelineRegistry -->|3. Onboarding Guide| RG[ReadingGuideGenerator]:::step
        PipelineRegistry -->|4. Code Health| Heal[HealthGenerator]:::step
        PipelineRegistry -->|5. Observations| Obs[ObservationsGenerator]:::step
        
        Dom -.->|Update context| Purpose[PurposeGenerator]:::step
    end

    PipelineRegistry -->|Collect all outputs| Collate[Collate context variables]:::step
    Collate -->|Return JSON| Router
    Router -->|200 OK REST JSON Payload| UI

    %% Assign classes
    class UI,Axios step;
    class Router,Service step;
    class CacheProxy,ReadCache,BuildFacts,GraphRepo,Neo4jRepo,SaveCache step;
    class Resolver,PipelineRegistry,Dom,Tech,RG,Heal,Obs,Purpose,Collate step;
    class Neo4j database;
    class CacheHit decision;
```

---

## ⚙️ Topological Sort & Cycle Detection Flowchart

The following flowchart outlines the recursive DFS three-state (`0 = unvisited`, `1 = visiting`, `2 = visited`) topological sort algorithm used by the pipeline engine to dynamically resolve execution orders and prevent circular dependencies:

```mermaid
flowchart TD
    %% Styling Classes
    classDef startEnd fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#155724;
    classDef decision fill:#fff3cd,stroke:#ffc107,stroke-width:2px,color:#856404;
    classDef step fill:#e8f4fd,stroke:#2b8a3e,stroke-width:1px,color:#0b7285;
    classDef error fill:#f8d7da,stroke:#dc3545,stroke-width:2px,color:#721c24;

    Start([1. Begin resolve_order]):::startEnd --> InitStates[Set all generator states to 0 / unvisited]:::step
    InitStates --> CheckLoop{More generators in registry?}:::decision
    
    CheckLoop -->|Yes| SelectGen[Select next generator class]:::step
    SelectGen --> CallVisit[Call visit generator]:::step
    CheckLoop -->|No| End([Return resolved order list]):::startEnd
    
    CallVisit --> GetState{Check state of current generator}:::decision
    GetState -->|State = 2 / visited| ReturnVisit[Return to caller]:::step
    GetState -->|State = 1 / visiting| RaiseCycle[Raise PipelineDependencyError Circular Loop!]:::error
    GetState -->|State = 0 / unvisited| TransitionVisiting[Set state to 1 / visiting]:::step
    
    TransitionVisiting --> PushStack[Push key to path stack]:::step
    PushStack --> CheckDeps{Has required dependencies?}:::decision
    
    CheckDeps -->|Yes| LoopDeps[For each required key in requires list]:::step
    LoopDeps --> FindDepCls[Look up dependency generator class]:::step
    FindDepCls --> CallVisitRecurse[Recursively call visit]:::step
    CallVisitRecurse --> LoopDeps
    
    CheckDeps -->|No| PopStack[Pop key from path stack]:::step
    LoopDeps -->|Finished all deps| PopStack
    
    PopStack --> TransitionVisited[Set state to 2 / visited]:::step
    TransitionVisited --> AppendOrder[Append generator to order list]:::step
    AppendOrder --> ReturnVisit
```

---

## 🏗 Directory Structure

```text
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
```

---

## ⚡ Key Core Implementations

### 1. Dynamic Dependency-Driven Pipeline Engine
Generators do not execute in a static list. Each generator declares its prerequisite context requirements via `requires: List[str]`. The execution engine resolves these dependencies at runtime using a three-state Depth-First Search (DFS) topological sort:
* **Cycle Detection**: The resolver tracks states (`0 = unvisited`, `1 = visiting`, `2 = visited`). If a cycle is detected (e.g. `A -> B -> C -> A`), the engine throws a `PipelineDependencyError` to prevent runtime locks.
* **Latency Observability**: Measures step execution times in milliseconds, reporting profiling durations directly to logs.

### 2. Isolated Facts Abstraction Layer
Cypher query definitions and database queries are abstracted into `GraphRepositoryProtocol` (implemented by `Neo4jGraphRepository`). The `FactsBuilder` consumes this repository interface, compiling data symbols (files, functions, imports) into a single, canonical JSON facts dictionary. Caching is handled at the proxy layer by `CachedFactsProvider`, ensuring generators run completely database-free.

---

## ⚙️ Setup and Installation

### Backend Setup
1. Clone the repository and configure a Python virtual environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. Set up environment configurations matching your local Neo4j database instance:
   ```bash
   export NEO4J_URI="bolt://localhost:7687"
   export NEO4J_USER="neo4j"
   export NEO4J_PASSWORD="password"
   ```
3. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup
1. Install node dependencies:
   ```bash
   npm install
   ```
2. Start the local Vite development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser to access the dashboard.
