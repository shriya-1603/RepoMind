# RepoMind Backend Phase 1

## Setup

### Prerequisites
- Python 3.12+
- Docker & Docker Compose (optional)

### Local Installation & Running

1. **Start Neo4j:**
   Ensure Neo4j is running locally (e.g. via Docker or local installation) with the default port `7687` and credentials configured in your `.env` (default: `neo4j` / `password`).
   ```bash
   # Example starting Neo4j with Docker:
   docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:latest
   ```

2. **Start Backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp ../.env.example ../.env
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API will be available at `http://localhost:8000`.

3. **Start Frontend:**
   ```bash
   cd .. # Root of the project
   npm install
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

4. **Analyze Sample Repo:**
   - Open the frontend UI at `http://localhost:5173`.
   - Enter a public GitHub repository URL (e.g., `https://github.com/tiangolo/fastapi`) into the analyze input and submit.

5. **Open Graph Explorer:**
   - Navigate to the Graph Explorer page in the UI to view the real graph data stored and fetched from Neo4j!

### Docker Setup

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

   This starts both FastAPI and Redis.

2. **Backend is at:** `http://localhost:8000`

## API Endpoints

### POST `/analyze-repo`
Enqueue a repository for analysis.

**Request:**
```json
{ "repo_url": "https://github.com/vercel/next.js" }
```

**Response:**
```json
{
  "id": "analysis-12ab34cd",
  "status": "queued",
  "message": "Repository analysis queued successfully."
}
```

### GET `/analysis-status/{analysis_id}`
Check the status of an analysis.

**Response:**
```json
{
  "id": "analysis-12ab34cd",
  "status": "processing",
  "progress": 45,
  "message": "Analysis processing."
}
```

### GET `/repo-summary/{analysis_id}`
Get a high-level summary of the analyzed repository.

**Response:**
```json
{
  "repo_name": "next.js",
  "files": 4218,
  "functions": 2847,
  "classes": 341,
  "dependencies": 431,
  "risk_score": 72
}
```

### GET `/graph/{analysis_id}`
Retrieve the dependency graph (nodes and edges).

**Response:**
```json
{
  "nodes": [{ "id": "node-1", "path": "src/App.tsx", ... }],
  "edges": [{ "id": "e-1-2", "source": "node-1", "target": "node-2", ... }]
}
```

### GET `/impact-analysis/{analysis_id}`
Fetch refactoring impact analysis for a target file.

**Response:**
```json
{
  "id": "impact-1",
  "targetFile": "src/App.tsx",
  "riskLevel": "medium",
  "directDependents": [...],
  "transitiveDependents": [...],
  "impactScore": 68,
  "recommendations": [...],
  "scenarios": [...]
}
```

### GET `/semantic-search/{analysis_id}?query=<query>`
Query the codebase using natural language.

**Response:**
```json
{
  "query": "How is auth handled?",
  "answer": "The backend uses JWT tokens...",
  "confidence": 0.92,
  "sources": ["src/auth.ts", "src/middleware.ts"],
  "results": [...]
}
```

## Project Structure

```
backend/
  app/
    api/
      routes.py           # API endpoints (POST, GET)
    services/
      mock_data.py        # Mock data generators
    models/
      schemas.py          # Pydantic request/response models
    core/
      config.py           # Configuration and environment
    parsers/
      tree_sitter.py      # TODO: AST parsing for multiple languages
    workers/
      celery_worker.py    # TODO: Background task processing
    main.py              # FastAPI app setup and middleware
  Dockerfile             # Container setup
  docker-compose.yml     # Multi-container orchestration
  requirements.txt       # Python dependencies
```

## TODO / Future Phases

### Phase 2: Core Parsing
- [ ] **Tree-sitter Integration**: Parse TypeScript, JavaScript, Python, and Go.
- [ ] **AST Extraction**: Extract imports, functions, classes, and export statements.
- [ ] **Dependency Resolution**: Build the full graph from parsed metadata.

### Phase 3: Graph Database & Storage
- [ ] **Neo4j Integration**: Store dependency graphs in a persistent graph database.
- [ ] **Redis Caching**: Cache frequently accessed graphs and analysis results.
- [ ] **Data Normalization**: Efficient schema for cross-repo imports and transitive deps.

### Phase 4: Async Workers & Indexing
- [ ] **Celery Setup**: Background job processing for large repositories.
- [ ] **Semantic Embeddings**: Compute vector embeddings for code chunks.
- [ ] **Progress Streaming**: WebSocket updates for long-running analyses.

### Phase 5: Advanced Features
- [ ] **Cross-Repo Analysis**: Track dependencies across multiple repositories.
- [ ] **Risk Scoring**: Sophisticated scoring for package vulnerabilities and debt.
- [ ] **Refactoring Simulation**: Predict impact of code changes.

## Current Mock Responses

All endpoints currently return realistic mock data. Replace `app/services/mock_data.py` with real implementations as you build out each module.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Frontend origin for CORS |
| `DEBUG` | `true` | Debug mode (FastAPI auto-reload) |

## Frontend Integration

The frontend connects via `http://localhost:8000` (or the `VITE_API_URL` env var). All requests include appropriate CORS headers. The frontend passes analysis IDs in URL params to fetch data as needed.

Example frontend hook usage:
```typescript
const { nodes, edges, loading } = useGraphData(analysisId);
const { data, loading } = useImpactAnalysis(analysisId);
const { search } = useSemanticSearch(analysisId);
```

## Development Notes

- **Mock data** is sufficient for UI/UX testing and frontend development.
- **Replace mock data** in `app/services/mock_data.py` with real API implementations as you complete parser modules.
- **Use Redis** to cache analysis results and store job state.
- **Add logging** for debugging long-running analyses.
