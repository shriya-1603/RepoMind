# 🧠 RepoMind — Interactive Repository Intelligence & Impact Analysis

RepoMind is a premium code analysis and intelligence platform that parses source code repositories into an interactive **AST dependency graph**, stores it in **Neo4j**, and integrates **Git commit metadata**. It helps engineers onboard to unfamiliar codebases in minutes, inspect visual dependencies, simulate refactoring risk (blast radius), and query structural data using natural language.

---

## 🚀 Key Features Implemented

### 1. Senior-Engineer Onboarding Briefing (Repository Intelligence v3)
* **What is this Project**: Answers "What problem does this repository solve?" by generating high-quality codebase descriptions based on imported libraries, module types, and structural components.
* **Grounded Domain Scoring**: Uses a weighted scoring engine to classify codebases into 6 categories: `Computer Vision`, `Backend API`, `Machine Learning`, `Frontend`, `CLI Tool`, and `Infrastructure`. Automatically flags a low-confidence or `"Unknown"` fallback when confidence is under 50%.
* **Reconstructed AST Execution Flow**: Dynamically traces function call chains in Neo4j (via `FILE_CONTAINS_FUNCTION` and `FUNCTION_CALLS_FUNCTION` relationships) to map true runtime paths (e.g. `app.py -> run_server() -> configure_routes()`).
* **Start Here Reading Guide**: Displays key entry-point files with customized engineering descriptions explaining their exact codebase responsibilities, including a target onboarding understanding percentage.
* **Unique Central Hotspots**: Computes graph centrality metrics to list the top 5 unique files along with their fan-in count, affected function/module volume, and engineering responsibility annotations.
* **Qualitative Confidence Metrics**: Replaced raw, noisy percentages with qualitative tags: **High Confidence**, **Medium Confidence**, and **Low Confidence**.
* **Collapsible Evidence Toggles**: Collapses specific evidence chains behind tidy `▸ Evidence` / `▾ Evidence` details toggles to keep the layout compact and dashboard-sized.

### 2. Interactive Graph Explorer
* Renders a custom force-directed dependency graph displaying `File`, `Class`, `Function`, `Import`, and `Author` nodes.
* Implements direct syntax highlighting, edge-path tracing, and real-time filtering queries.
* Normalizes all file paths to repository-relative paths, stripping host-specific `/var/folders/` or `/tmp/` paths.

### 3. Change Blast Radius & Risk Simulator
* Simulates refactoring blast radius by executing multi-hop database queries (`[:DEPENDS_ON*1..2]`).
* Generates a structural risk score (0-100) and displays detailed side-panel call flows showing downstream endpoints and files affected by a change.

### 4. Git Metadata & Author Activity Dashboard
* Displays default branch status, contributor counts, total commit logs, and a recent commit stream.
* Aggregates active contributor cards and provides a slide-out panel outlining specific contributor file ownership percentages:
  $$\text{Ownership Score} = \frac{\text{Commits by Contributor to File}}{\text{Total Commits to File}}$$

---

## 🛠 Tech Stack

* **Backend**: Python 3.9+, FastAPI, Tree-Sitter Parsers (Python, TypeScript, JS, Java), Git CLI bindings.
* **Frontend**: React, TypeScript, Vite, Tailwind CSS, Framer Motion, D3/SVG.
* **Database**: Neo4j Graph DB, Cypher query language.

---

## 📦 Setup & Installation

### 1. Setup Neo4j Database
Ensure a local Neo4j instance is running on port `7687` (Bolt) and `7474` (HTTP):
```bash
docker run \
    -d \
    --name repomind-neo4j \
    -p 7474:7474 -p 7687:7687 \
    -e NEO4J_AUTH=neo4j/password \
    neo4j:latest
```

### 2. Start Python FastAPI Server
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```
Interactive docs will be exposed at `http://localhost:8000/docs`.

### 3. Start Frontend Dev Server
In the root directory:
```bash
npm install
npm run dev -- --port 5174
```
Access the dashboard at `http://localhost:5174`.
