# RepoMind Backend Architecture & API Specifications

This document provides a detailed breakdown of the FastAPI-based backend architecture for RepoMind, detailing components, routing logic, services, and schema specifications.

---

## 🏗 Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   └── routes.py                 # REST Endpoints mapping web clients to controllers
│   ├── models/
│   │   └── schemas.py                # Pydantic Schemas validating requests/responses
│   ├── services/
│   │   ├── git_metadata_service.py   # Subprocess-based Git extraction & stats engine
│   │   ├── parser_service.py         # Tree-Sitter AST parsing engine for code symbols
│   │   ├── graph_service.py          # Neo4j query builder & relationship manager
│   │   ├── repo_service.py           # Local/Cloned repository registration/lookup
│   │   └── mock_data.py              # Fallback generators for initial testing
│   ├── graph/
│   │   └── neo4j_client.py           # Base connector and raw Cypher executors
│   └── main.py                       # FastAPI Application entry point & CORS configuration
├── requirements.txt
└── test_graph_pipeline.py            # Local orchestration validation script
```

---

## ⚡ Main App Entry Point (`main.py`)
Configures the FastAPI application instance. Sets up **CORS Middlewares** to permit communication from the frontend host (`http://localhost:5173`) and binds the primary router under the global namespace.

---

## 🌐 API Routes & Schema Mappings (`routes.py`)

### 📦 1. Repository Management
* **`POST /repositories/import`**
  * **Payload**: `{ "url": string, "branch": Optional[string] }`
  * **Output**: `RepositoryMetadata` containing generated `id`, `name`, `status`, and `clone_path`.
* **`GET /repositories`**
  * **Output**: List of all repositories currently cached or registered in the environment.
* **`GET /repositories/{repo_id}`**
  * **Output**: Specific metadata configuration for the given analysis ID.

### 📊 2. Repository Activity & Metrics
* **`GET /repository-summary-real/{analysisId}`**
  * **Output**: Counts of total files, functions, classes, imports, and high-level architectural metrics.
* **`GET /repository-activity/{analysisId}`**
  * **Output**: Full Git intelligence object containing:
    * `overview`: Default branch, commit count, last active date, and number of active authors.
    * `recentCommits`: Array of the latest 50 commits with message, SHA, date, author, and files modified.
    * `contributors`: List of active developers, their commit stats, primary folders worked on, and ownership bars.

### 🔗 3. Code Graph Explorer
* **`GET /graph-real/{analysisId}`**
  * **Output**: Structure containing nodes (type, name, path) and edges (source, target, relationship type) representing the parsed AST.

### ⚠️ 4. Impact Analysis & Change Simulation
* **`GET /impact-analysis-real/{analysisId}?target=<symbol_name>`**
  * **Output**: Traced dependency footprint with lists of directly and transitively affected files/functions/classes, calculated risk score (0-100), and dynamic explanation.
* **`POST /simulate-change-real/{analysisId}`**
  * **Payload**: `{ "filePath": string, "changeType": "modify" | "delete" }`
  * **Output**: Simulated cascading failure vectors across the graph schema.

---

## 🔄 Core Ingestion Flow
1. User enters GitHub URL on UI.
2. Frontend triggers `POST /repositories/import`.
3. Backend clones the public repository into a temporary system directory.
4. AST Parser parses source files inside the clone directory.
5. Code structure (classes, functions, calls) is written into Neo4j using the Graph Service.
6. Git Metadata Service executes Git CLI queries inside the cloned directory to extract commits, authors, and files touched.
7. Statistics are saved into the backend memory store.
8. Frontend transitions to the Dashboard, pulling summary data, activity lists, and graph visualizations dynamically.
