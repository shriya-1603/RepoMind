"""Repository Architect service – v2 evidence-driven architecture analysis.

Every claim produced by this service is traceable to one or more signals:
  - AST nodes (imports, function names, decorators, file names)
  - Neo4j graph metrics (fan-in, fan-out, criticality)
  - Module structure (directory names, file counts)

Confidence is only computed for:
  - projectPurpose  (how strongly domain signals match)
  - domain          (weighted signal score / max possible score)
  - workflowConfidence (count of graph signals available)
"""

import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict

from app.graph.neo4j_client import Neo4jClient, get_neo4j_client

logger = logging.getLogger(__name__)


# ── Library fingerprint database ─────────────────────────────────────────────

_LIBRARY_FINGERPRINTS: Dict[str, Dict[str, Any]] = {
    "flask":        {"name": "Flask",       "purpose": "HTTP routing layer and request/response lifecycle.", "domains": ["backend_api"], "category": "web_framework"},
    "fastapi":      {"name": "FastAPI",     "purpose": "REST API routing with automatic OpenAPI spec generation.", "domains": ["backend_api"], "category": "web_framework"},
    "django":       {"name": "Django",      "purpose": "Full-stack web framework providing ORM, routing, and templating.", "domains": ["backend_api", "mvc"], "category": "web_framework"},
    "starlette":    {"name": "Starlette",   "purpose": "ASGI toolkit underlying FastAPI routing.", "domains": ["backend_api"], "category": "web_framework"},
    "aiohttp":      {"name": "aiohttp",     "purpose": "Async HTTP client/server framework.", "domains": ["backend_api"], "category": "web_framework"},
    "numpy":        {"name": "NumPy",       "purpose": "Numerical array computation — core dependency for ML pipelines.", "domains": ["ml_pipeline", "data_engineering"], "category": "numeric"},
    "pandas":       {"name": "Pandas",      "purpose": "Tabular data manipulation and transformation.", "domains": ["data_engineering", "ml_pipeline"], "category": "data"},
    "sklearn":      {"name": "scikit-learn","purpose": "Classical ML algorithms (classification, regression, clustering).", "domains": ["ml_pipeline"], "category": "ml"},
    "torch":        {"name": "PyTorch",     "purpose": "Deep learning model training and inference.", "domains": ["ml_pipeline", "computer_vision", "llm_application"], "category": "deep_learning"},
    "tensorflow":   {"name": "TensorFlow",  "purpose": "Deep learning framework for model training and deployment.", "domains": ["ml_pipeline", "computer_vision"], "category": "deep_learning"},
    "keras":        {"name": "Keras",       "purpose": "High-level neural network API, typically running on TensorFlow.", "domains": ["ml_pipeline"], "category": "deep_learning"},
    "transformers": {"name": "HuggingFace Transformers", "purpose": "Pre-trained language model loading and inference.", "domains": ["llm_application", "ml_pipeline"], "category": "nlp"},
    "openai":       {"name": "OpenAI API",  "purpose": "LLM inference via GPT models (chat completions, embeddings).", "domains": ["llm_application"], "category": "llm"},
    "langchain":    {"name": "LangChain",   "purpose": "LLM orchestration — chains, agents, and retrieval-augmented generation.", "domains": ["llm_application"], "category": "llm"},
    "anthropic":    {"name": "Anthropic",   "purpose": "Claude LLM inference.", "domains": ["llm_application"], "category": "llm"},
    "cv2":          {"name": "OpenCV",      "purpose": "Real-time image/video processing and computer vision operations.", "domains": ["computer_vision"], "category": "vision"},
    "PIL":          {"name": "Pillow",      "purpose": "Image loading, manipulation, and format conversion.", "domains": ["computer_vision", "ml_pipeline"], "category": "vision"},
    "face_recognition": {"name": "face_recognition", "purpose": "Face detection and recognition using deep learned embeddings.", "domains": ["computer_vision"], "category": "vision"},
    "mediapipe":    {"name": "MediaPipe",   "purpose": "Real-time perception pipeline (face mesh, pose, hands).", "domains": ["computer_vision"], "category": "vision"},
    "ultralytics":  {"name": "YOLO (ultralytics)", "purpose": "Real-time object detection using YOLO architecture.", "domains": ["computer_vision"], "category": "vision"},
    "sqlalchemy":   {"name": "SQLAlchemy",  "purpose": "ORM and SQL query builder for relational database persistence.", "domains": ["backend_api"], "category": "database"},
    "pymongo":      {"name": "PyMongo",     "purpose": "MongoDB document database driver.", "domains": ["backend_api"], "category": "database"},
    "redis":        {"name": "Redis",       "purpose": "In-memory cache and message broker.", "domains": ["backend_api"], "category": "cache"},
    "neo4j":        {"name": "Neo4j",       "purpose": "Graph database driver — stores and queries relationship data.", "domains": ["backend_api", "data_engineering", "compiler"], "category": "graph_db"},
    "psycopg2":     {"name": "PostgreSQL (psycopg2)", "purpose": "Direct PostgreSQL database driver.", "domains": ["backend_api"], "category": "database"},
    "sqlite3":      {"name": "SQLite",      "purpose": "Embedded relational database for local persistence.", "domains": ["backend_api"], "category": "database"},
    "boto3":        {"name": "AWS SDK (boto3)", "purpose": "AWS service access (S3, Lambda, DynamoDB, etc.).", "domains": ["backend_api", "devops"], "category": "cloud"},
    "celery":       {"name": "Celery",      "purpose": "Distributed task queue for async/background job processing.", "domains": ["backend_api"], "category": "async"},
    "kafka":        {"name": "Kafka",       "purpose": "High-throughput event streaming and message bus.", "domains": ["data_engineering", "backend_api"], "category": "messaging"},
    "pika":         {"name": "RabbitMQ (Pika)", "purpose": "AMQP message broker integration.", "domains": ["backend_api"], "category": "messaging"},
    "jwt":          {"name": "JWT",         "purpose": "JSON Web Token generation and validation for auth.", "domains": ["backend_api"], "category": "auth"},
    "cryptography": {"name": "cryptography","purpose": "Encryption, signing, and secure key management.", "domains": ["backend_api"], "category": "security"},
    "bcrypt":       {"name": "bcrypt",      "purpose": "Password hashing.", "domains": ["backend_api"], "category": "auth"},
    "tree_sitter":  {"name": "Tree-sitter", "purpose": "Incremental parser generator for multi-language AST extraction.", "domains": ["compiler", "devops"], "category": "parsing"},
    "ast":          {"name": "Python AST",  "purpose": "Python's built-in abstract syntax tree parser.", "domains": ["compiler"], "category": "parsing"},
    "react":        {"name": "React",       "purpose": "Component-based UI rendering library.", "domains": ["frontend"], "category": "ui_framework"},
    "axios":        {"name": "Axios",       "purpose": "HTTP client for API communication.", "domains": ["frontend", "backend_api"], "category": "http"},
    "pytest":       {"name": "pytest",      "purpose": "Test runner and assertion framework.", "domains": [], "category": "testing"},
    "unittest":     {"name": "unittest",    "purpose": "Built-in Python test framework.", "domains": [], "category": "testing"},
    "pydantic":     {"name": "Pydantic",    "purpose": "Runtime data validation and settings management via Python type hints.", "domains": ["backend_api"], "category": "validation"},
    "airflow":      {"name": "Apache Airflow", "purpose": "Workflow orchestration for data pipelines.", "domains": ["data_engineering"], "category": "orchestration"},
    "dask":         {"name": "Dask",        "purpose": "Parallel computing and distributed dataframe processing.", "domains": ["data_engineering"], "category": "distributed"},
    "web3":         {"name": "Web3.py",     "purpose": "Ethereum blockchain interaction and smart contract calls.", "domains": ["blockchain"], "category": "blockchain"},
    "pygame":       {"name": "Pygame",      "purpose": "2D game engine and multimedia library.", "domains": ["game"], "category": "game"},
    "click":        {"name": "Click",       "purpose": "Command-line interface creation with argument parsing.", "domains": ["cli"], "category": "cli"},
    "typer":        {"name": "Typer",       "purpose": "Type-annotated CLI framework built on Click.", "domains": ["cli"], "category": "cli"},
    "argparse":     {"name": "argparse",    "purpose": "Standard library CLI argument parsing.", "domains": ["cli"], "category": "cli"},
    "rich":         {"name": "Rich",        "purpose": "Terminal output formatting with colors, tables, and progress bars.", "domains": ["cli"], "category": "cli"},
    "stripe":       {"name": "Stripe",      "purpose": "Payment processing and subscription billing.", "domains": ["backend_api"], "category": "payments"},
    "elasticsearch": {"name": "Elasticsearch", "purpose": "Full-text search and analytics engine.", "domains": ["backend_api", "data_engineering"], "category": "search"},
    "selenium":     {"name": "Selenium",    "purpose": "Browser automation for web scraping and end-to-end testing.", "domains": ["devops"], "category": "automation"},
    "scrapy":       {"name": "Scrapy",      "purpose": "Web crawling and scraping framework.", "domains": ["data_engineering"], "category": "scraping"},
    "bs4":          {"name": "BeautifulSoup", "purpose": "HTML/XML parsing for web scraping.", "domains": ["data_engineering"], "category": "scraping"},
    "yaml":         {"name": "YAML",        "purpose": "Human-readable config file parsing.", "domains": [], "category": "config"},
    "dotenv":       {"name": "dotenv",      "purpose": "Environment variable loading from .env files.", "domains": [], "category": "config"},
    "prometheus_client": {"name": "Prometheus", "purpose": "Metrics collection and exposure for infrastructure monitoring.", "domains": ["devops"], "category": "monitoring"},
    "sentry_sdk":   {"name": "Sentry",      "purpose": "Error tracking and performance monitoring.", "domains": ["devops"], "category": "monitoring"},
}

_DOMAIN_LABELS: Dict[str, str] = {
    "computer_vision":  "Computer Vision",
    "backend_api":      "Backend API",
    "ml":               "Machine Learning",
    "frontend":         "Frontend",
    "cli":              "CLI Tool",
    "infrastructure":   "Infrastructure",
    "unknown":          "Unknown",
}

_DOMAIN_WEIGHTED_SIGNALS: Dict[str, List[Dict[str, Any]]] = {
    "computer_vision": [
        {"label": "imports cv2 (OpenCV)",              "type": "import",           "key": "cv2",             "weight": 30},
        {"label": "imports PIL/Pillow",                 "type": "import",           "key": "PIL",             "weight": 15},
        {"label": "imports imageio",                    "type": "import",           "key": "imageio",         "weight": 15},
        {"label": "imports torchvision",                "type": "import",           "key": "torchvision",     "weight": 25},
        {"label": "imports YOLO / ultralytics",         "type": "import",           "key": "ultralytics",     "weight": 30},
        {"label": "imports segmentation_models",        "type": "import",           "key": "segmentation_models", "weight": 25},
        {"label": "image file extensions (.png, .jpg, .jpeg, .tiff, .bmp, .gif)", "type": "file_ext_multi", "keys": [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif"], "weight": 15},
        {"label": "camera/webcam API patterns (VideoCapture, camera, webcam)", "type": "fn_keyword_multi", "keys": ["videocapture", "camera", "webcam"], "weight": 20},
    ],
    "backend_api": [
        {"label": "imports Flask",                      "type": "import",           "key": "flask",           "weight": 35},
        {"label": "imports FastAPI",                    "type": "import",           "key": "fastapi",         "weight": 35},
        {"label": "imports Express",                    "type": "import",           "key": "express",         "weight": 35},
        {"label": "imports Spring / Spring Boot",       "type": "import_multi",     "keys": ["spring", "springboot"], "weight": 35},
        {"label": "imports Django",                     "type": "import",           "key": "django",          "weight": 35},
        {"label": "route decorator patterns",           "type": "decorator_multi",  "keys": ["route", "get", "post", "put", "delete"], "weight": 25},
        {"label": "controllers or middleware patterns",  "type": "file_keyword_multi", "keys": ["controller", "middleware"], "weight": 20},
    ],
    "ml": [
        {"label": "imports PyTorch",                    "type": "import",           "key": "torch",           "weight": 30},
        {"label": "imports TensorFlow",                 "type": "import",           "key": "tensorflow",      "weight": 30},
        {"label": "imports scikit-learn",               "type": "import",           "key": "sklearn",         "weight": 25},
        {"label": "imports xgboost",                    "type": "import",           "key": "xgboost",         "weight": 25},
    ],
    "frontend": [
        {"label": "imports React",                      "type": "import",           "key": "react",           "weight": 35},
        {"label": "imports Vue",                        "type": "import",           "key": "vue",             "weight": 35},
        {"label": "imports Angular",                    "type": "import_multi",     "keys": ["angular", "@angular"], "weight": 35},
        {"label": "frontend files (.jsx, .tsx, .vue)",  "type": "file_ext_multi",   "keys": [".jsx", ".tsx", ".vue"], "weight": 30},
    ],
    "cli": [
        {"label": "imports Click",                      "type": "import",           "key": "click",           "weight": 35},
        {"label": "imports Typer",                      "type": "import",           "key": "typer",           "weight": 35},
        {"label": "imports argparse",                   "type": "import",           "key": "argparse",        "weight": 25},
        {"label": "CLI command patterns (@command)",     "type": "decorator",        "key": "command",         "weight": 20},
    ],
    "infrastructure": [
        {"label": "Terraform files (.tf)",             "type": "file_ext",         "key": ".tf",             "weight": 35},
        {"label": "Docker configuration (Dockerfile)",   "type": "file_keyword",     "key": "dockerfile",      "weight": 35},
        {"label": "Docker Compose config",              "type": "file_keyword",     "key": "docker-compose",  "weight": 35},
        {"label": "Kubernetes configuration",           "type": "file_keyword_multi", "keys": ["k8s", "kubernetes", "pod.yaml", "deployment.yaml"], "weight": 35},
    ],
}


_ARCH_PATTERNS: List[Dict[str, Any]] = [
    {
        "pattern": "Microservice",
        "signals": ["docker", "kubernetes", "grpc", "protobuf"],
        "explanation": "Independent deployment boundaries suggested by containerization configuration.",
    },
    {
        "pattern": "Event-Driven",
        "signals": ["celery", "kafka", "pika", "rabbitmq", "eventbus", "dispatcher", "listener"],
        "explanation": "Message or event bus decouples producers from consumers.",
    },
    {
        "pattern": "API-First",
        "signals": ["fastapi", "flask", "router", "endpoint", "route", "rest", "openapi"],
        "explanation": "HTTP API layer is the primary entry point, delegating to service and persistence layers.",
    },
    {
        "pattern": "MVC",
        "signals": ["django", "models", "views", "templates", "controller"],
        "explanation": "Separates data models, presentation logic, and control flow into distinct layers.",
    },
    {
        "pattern": "Pipeline",
        "signals": ["pipeline", "transform", "stage", "step", "processor", "chain", "airflow", "dask"],
        "explanation": "Data flows through a sequence of transformation stages.",
    },
    {
        "pattern": "Layered",
        "signals": ["service", "repository", "dao", "entity", "model", "controller", "handler"],
        "explanation": "Organized into horizontal layers — API, business logic, and data access.",
    },
    {
        "pattern": "CLI",
        "signals": ["click", "typer", "argparse", "main", "cli", "command"],
        "explanation": "Primary interface is a command-line tool.",
    },
]


def make_path_relative(p: str, path_map: Dict[str, str]) -> str:
    if not p:
        return ""
    p_norm = p.replace("\\", "/")
    if p in path_map:
        return path_map[p]
    if p_norm in path_map:
        return path_map[p_norm]
    # Prefix or suffix replacement
    for abs_p, rel_p in path_map.items():
        abs_p_norm = abs_p.replace("\\", "/")
        if abs_p_norm in p_norm:
            return p_norm.replace(abs_p_norm, rel_p).lstrip("/")
    # Suffix extract from temporary directory structures
    for prefix in ["/var/folders/", "/tmp/", "/private/var/"]:
        if prefix in p_norm:
            if "/T/" in p_norm:
                try:
                    return p_norm.split("/T/", 1)[1].split("/", 1)[-1]
                except Exception:
                    pass
            return p_norm.split("/")[-1]
    return p_norm


class RepositoryArchitectService:
    """
    Analyzes Neo4j graph to generate a RepositoryIntelligence briefing.
    Every claim is backed by signals from AST, imports, or graph topology.
    """

    def __init__(self, client: Optional[Neo4jClient] = None) -> None:
        self._client = client or get_neo4j_client()

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    def analyze_repository(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        try:
            graph_summary = self._get_graph_summary(analysis_id)
            logger.info(
                "Repository architect: %s — nodes=%s rels=%s",
                analysis_id, graph_summary["node_count"], graph_summary["rel_count"],
            )
            overview = self._get_overview(analysis_id)
            if not overview or overview.get("files", 0) == 0:
                return None

            modules = self._get_major_modules(analysis_id)
            hotspots = self._get_hotspots(analysis_id)
            risk_areas = self._get_risk_areas(analysis_id)
            onboarding_path = self._generate_onboarding_path(analysis_id, modules, hotspots)
            risk_score = self._calculate_risk_score(overview, modules, hotspots, risk_areas)
            ai_summary = self._generate_ai_summary(overview, modules, hotspots, risk_areas, risk_score)
            repository_intelligence = self._generate_repository_intelligence(
                analysis_id, overview, modules, hotspots, risk_areas, risk_score
            )

            return {
                "source": "neo4j",
                "totalFiles": overview["files"],
                "totalClasses": overview["classes"],
                "totalFunctions": overview["functions"],
                "totalImports": overview["imports"],
                "majorModules": modules,
                "highlyCoupled": self._get_highly_coupled_files(analysis_id, modules),
                "mostDependedOnFiles": hotspots["files"],
                "mostDependedOnFunctions": hotspots["functions"],
                "mostDependedOnClasses": hotspots["classes"],
                "onboardingPath": onboarding_path,
                "riskAreas": risk_areas,
                "overallRiskScore": risk_score,
                "aiSummary": ai_summary,
                "repositoryIntelligence": repository_intelligence,
            }
        except Exception as exc:
            logger.error("Repository analysis failed: %s", exc, exc_info=True)
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # v2 Intelligence Generation
    # ──────────────────────────────────────────────────────────────────────────

    def _generate_repository_intelligence(
        self, analysis_id, overview, modules, hotspots, risk_areas, risk_score
    ) -> Optional[Dict[str, Any]]:
        try:
            # 1. Fetch files and build entry points
            all_files = self._get_all_files(analysis_id)
            all_functions = self._get_all_functions(analysis_id)
            entry_points = self._detect_entry_points(analysis_id, all_files, all_functions)

            # 2. Invoke the specialized repository intelligence pipeline engine
            from app.services.repository_intelligence.pipeline import RepositoryIntelligencePipeline
            from app.services.repository_intelligence.facts.graph_repository import Neo4jGraphRepository
            
            graph_repo = Neo4jGraphRepository(self._client)
            pipeline = RepositoryIntelligencePipeline()

            result = pipeline.assemble(
                analysis_id=analysis_id,
                graph_repo=graph_repo,
                overview=overview,
                entry_points=entry_points,
                hotspots=hotspots,
                risk_areas=risk_areas,
                risk_score=risk_score
            )
            return result
        except Exception as exc:
            logger.error("Repository intelligence generation failed: %s", exc, exc_info=True)
            return None

    # Raw signal collection
    # ──────────────────────────────────────────────────────────────────────────

    def _get_all_imports(self, analysis_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (i:Import {analysis_id: $analysis_id})
        RETURN i.module AS module, i.import_type AS import_type,
               i.names AS names, i.file_path AS file_path
        LIMIT 2000
        """
        return self._client.run_query(query, {"analysis_id": analysis_id}) or []

    def _get_all_files(self, analysis_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (f:File {analysis_id: $analysis_id})
        RETURN f.rel_path AS rel_path, f.path AS path,
               f.functions_count AS functions_count,
               f.classes_count AS classes_count,
               f.imports_count AS imports_count
        LIMIT 1000
        """
        return self._client.run_query(query, {"analysis_id": analysis_id}) or []

    def _get_all_functions(self, analysis_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (fn:Function {analysis_id: $analysis_id})
        RETURN fn.name AS name, fn.file_path AS file_path,
               fn.decorators AS decorators, fn.params AS params
        LIMIT 2000
        """
        return self._client.run_query(query, {"analysis_id": analysis_id}) or []

    def _get_all_classes(self, analysis_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (c:Class {analysis_id: $analysis_id})
        RETURN c.name AS name, c.file_path AS file_path,
               c.bases AS bases, c.methods AS methods
        LIMIT 1000
        """
        return self._client.run_query(query, {"analysis_id": analysis_id}) or []

    # ──────────────────────────────────────────────────────────────────────────
    # Signal analysis
    # ──────────────────────────────────────────────────────────────────────────

    def _detect_libraries(self, imports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        detected: Dict[str, Dict[str, Any]] = {}
        for imp in imports:
            module = (imp.get("module") or "").lower().strip()
            if not module:
                continue
            matched_key = None
            for key in _LIBRARY_FINGERPRINTS:
                if module == key or module.startswith(key + ".") or module.startswith(key + "_"):
                    if matched_key is None or len(key) > len(matched_key):
                        matched_key = key
            if matched_key and matched_key not in detected:
                info = _LIBRARY_FINGERPRINTS[matched_key].copy()
                info["evidence"] = [imp.get("file_path", "") or ""]
                info["key"] = matched_key
                detected[matched_key] = info
            elif matched_key and matched_key in detected:
                fp = imp.get("file_path", "") or ""
                if fp and fp not in detected[matched_key].get("evidence", []):
                    detected[matched_key]["evidence"].append(fp)
        return list(detected.values())

    def _detect_entry_points(self, analysis_id, all_files, all_functions) -> List[Dict[str, Any]]:
        entry_points = []
        main_patterns = [
            ("main.py",     "main",      "Application entry point — execution begins here."),
            ("app.py",      "main",      "Application setup — initializes frameworks and configuration."),
            ("manage.py",   "cli",       "Django management command entry point."),
            ("server.py",   "main",      "Server startup — binds to network interface and starts listening."),
            ("run.py",      "main",      "Runner script — starts the application process."),
            ("cli.py",      "cli",       "Command-line interface entry point."),
            ("index.js",    "main",      "JavaScript application entry point."),
            ("index.ts",    "main",      "TypeScript application entry point."),
            ("main.ts",     "main",      "TypeScript application entry point."),
            ("worker.py",   "worker",    "Background worker — processes jobs from a task queue."),
            ("tasks.py",    "worker",    "Task definitions — async or scheduled background jobs."),
            ("scheduler.py","scheduler", "Job scheduler — triggers periodic tasks."),
        ]
        seen_paths: Set[str] = set()
        for f in all_files:
            rel = (f.get("rel_path") or "").replace("\\", "/")
            base = rel.split("/")[-1].lower()
            for pattern, ep_type, desc in main_patterns:
                if base == pattern and rel not in seen_paths:
                    entry_points.append({"type": ep_type, "name": base, "path": rel, "description": desc})
                    seen_paths.add(rel)
                    break

        route_decorators = {"app.route", "router.get", "router.post", "router.put",
                            "router.delete", "router.patch", "bp.route", "app.get", "app.post"}
        seen_route_files: Set[str] = set()
        for fn in all_functions:
            decorators = fn.get("decorators") or []
            dec_strs = [str(d).lower() for d in decorators] if isinstance(decorators, list) else [str(decorators).lower()]
            is_route = any(any(rd in d for rd in route_decorators) for d in dec_strs)
            if is_route:
                fp = fn.get("file_path") or ""
                basename = fp.split("/")[-1] if "/" in fp else fp.split("\\")[-1]
                if basename not in seen_route_files:
                    entry_points.append({
                        "type": "route",
                        "name": fn.get("name", "route_handler"),
                        "path": basename,
                        "description": "HTTP route handler — exposed as an API endpoint.",
                    })
                    seen_route_files.add(basename)
                if len(seen_route_files) >= 3:
                    break

        return entry_points[:10]

    def _infer_architecture_pattern(self, detected_libs, modules, all_files, all_functions) -> Dict[str, Any]:
        lib_names_lower = {lib["name"].lower() for lib in detected_libs}
        lib_cats = {lib.get("category", "").lower() for lib in detected_libs}
        module_names = {m["name"].lower() for m in modules}
        file_names_lower = {(f.get("rel_path") or "").lower().split("/")[-1] for f in all_files}
        fn_names_lower = {(fn.get("name") or "").lower() for fn in all_functions}
        all_tokens = lib_names_lower | lib_cats | module_names | file_names_lower | fn_names_lower

        best_pattern, best_score = None, 0
        for arch in _ARCH_PATTERNS:
            score = sum(1 for s in arch["signals"] if any(s in tok for tok in all_tokens))
            if score > best_score:
                best_score = score
                best_pattern = arch

        if best_pattern is None or best_score == 0:
            return {"pattern": "Layered", "explanation": "Organized into distinct horizontal layers — API, business logic, and data access."}
        return {"pattern": best_pattern["pattern"], "explanation": best_pattern["explanation"]}

    # ──────────────────────────────────────────────────────────────────────────
    # Legacy section generators (unchanged, used for non-intelligence fields)
    # ──────────────────────────────────────────────────────────────────────────

    def _generate_closing_sentence(self, central_file, central_func, central_class,
                                    entry_points, domain_result, arch_pattern) -> str:
        if central_file:
            fname = central_file.split("/")[-1] if "/" in central_file else central_file
            return f"Start by understanding {fname} — everything else either feeds into it or depends on what it produces."
        if entry_points:
            ep = entry_points[0]
            return f"Start with {ep['name']} — it is the system's front door, and following its execution path will reveal how all other components fit together."
        return "Trace the primary execution path from the entry point — the dependency graph reveals a clear hierarchy from input to output."

    # ──────────────────────────────────────────────────────────────────────────
    # Graph queries (legacy, unchanged)
    # ──────────────────────────────────────────────────────────────────────────

    def _get_overview(self, analysis_id: str) -> Optional[Dict[str, int]]:
        query = """
        MATCH (n {analysis_id: $analysis_id})
        RETURN
            COUNT(DISTINCT n) AS total_nodes,
            SUM(CASE WHEN 'File' IN labels(n) THEN 1 ELSE 0 END) AS files,
            SUM(CASE WHEN 'Class' IN labels(n) THEN 1 ELSE 0 END) AS classes,
            SUM(CASE WHEN 'Function' IN labels(n) THEN 1 ELSE 0 END) AS functions,
            SUM(CASE WHEN 'Import' IN labels(n) THEN 1 ELSE 0 END) AS imports
        """
        results = self._client.run_query(query, {"analysis_id": analysis_id})
        if not results:
            return None
        row = results[0]
        return {"files": row.get("files", 0), "classes": row.get("classes", 0),
                "functions": row.get("functions", 0), "imports": row.get("imports", 0)}

    def _get_graph_summary(self, analysis_id: str) -> Dict[str, int]:
        query = """
        MATCH (n {analysis_id: $analysis_id})
        OPTIONAL MATCH (n)-[r]->(m {analysis_id: $analysis_id})
        RETURN COUNT(DISTINCT n) AS node_count, COUNT(DISTINCT r) AS rel_count
        """
        results = self._client.run_query(query, {"analysis_id": analysis_id})
        if not results:
            return {"node_count": 0, "rel_count": 0}
        row = results[0]
        return {"node_count": row.get("node_count", 0), "rel_count": row.get("rel_count", 0)}

    def _get_major_modules(self, analysis_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (f:File {analysis_id: $analysis_id})
        WHERE f.rel_path IS NOT NULL
        WITH
            CASE
                WHEN f.rel_path CONTAINS '/' THEN split(f.rel_path, '/')[0]
                ELSE 'root'
            END AS module_name,
            f
        WITH module_name, COUNT(DISTINCT f) as file_count,
            SUM(COALESCE(f.functions_count, 0)) as func_count,
            SUM(COALESCE(f.classes_count, 0)) as class_count,
            SUM(COALESCE(f.imports_count, 0)) as import_count
        RETURN module_name, file_count, func_count, class_count, import_count
        ORDER BY file_count DESC
        LIMIT 8
        """
        results = self._client.run_query(query, {"analysis_id": analysis_id})
        modules = []
        for row in results:
            module_name = row.get("module_name", "unknown")
            modules.append({
                "name": module_name,
                "path": module_name if module_name != "root" else ".",
                "fileCount": row.get("file_count", 0),
                "functionCount": row.get("func_count", 0),
                "classCount": row.get("class_count", 0),
                "importCount": row.get("import_count", 0),
                "description": self._describe_module(module_name),
            })
        return modules

    def _get_hotspots(self, analysis_id: str) -> Dict[str, List[Dict[str, Any]]]:
        hotspots: Dict[str, List[Dict[str, Any]]] = {"files": [], "functions": [], "classes": []}

        file_results = self._client.run_query("""
        MATCH (f:File {analysis_id: $analysis_id})
        MATCH (n {analysis_id: $analysis_id})-[*1..2]->(f)
        RETURN f.rel_path AS name, f.path AS path, COUNT(DISTINCT n) AS incoming_degree,
               COALESCE(f.functions_count, 0) + COALESCE(f.classes_count, 0) AS complexity
        ORDER BY incoming_degree DESC LIMIT 5
        """, {"analysis_id": analysis_id})
        for row in file_results:
            max_deg = max(1, file_results[0].get("incoming_degree", 1)) if file_results else 1
            hotspots["files"].append({
                "name": row.get("name", "unknown"), "type": "file",
                "path": row.get("path", ""), "dependencyCount": row.get("incoming_degree", 0),
                "complexity": row.get("complexity", 0),
                "criticality": min(1.0, row.get("incoming_degree", 0) / max_deg),
            })

        func_results = self._client.run_query("""
        MATCH (fn:Function {analysis_id: $analysis_id})
        MATCH (n {analysis_id: $analysis_id})-[*1..2]->(fn)
        RETURN fn.name AS name, fn.file_path AS path, COUNT(DISTINCT n) AS incoming_degree
        ORDER BY incoming_degree DESC LIMIT 5
        """, {"analysis_id": analysis_id})
        for row in func_results:
            max_deg = max(1, func_results[0].get("incoming_degree", 1)) if func_results else 1
            hotspots["functions"].append({
                "name": row.get("name", "unknown"), "type": "function",
                "path": row.get("path", ""), "dependencyCount": row.get("incoming_degree", 0),
                "complexity": 0, "criticality": min(1.0, row.get("incoming_degree", 0) / max_deg),
            })

        class_results = self._client.run_query("""
        MATCH (c:Class {analysis_id: $analysis_id})
        MATCH (n {analysis_id: $analysis_id})-[*1..2]->(c)
        RETURN c.name AS name, c.file_path AS path, COUNT(DISTINCT n) AS incoming_degree,
               SIZE(COALESCE(c.methods, [])) AS method_count
        ORDER BY incoming_degree DESC LIMIT 5
        """, {"analysis_id": analysis_id})
        for row in class_results:
            max_deg = max(1, class_results[0].get("incoming_degree", 1)) if class_results else 1
            hotspots["classes"].append({
                "name": row.get("name", "unknown"), "type": "class",
                "path": row.get("path", ""), "dependencyCount": row.get("incoming_degree", 0),
                "complexity": row.get("method_count", 0),
                "criticality": min(1.0, row.get("incoming_degree", 0) / max_deg),
            })
        return hotspots

    def _get_risk_areas(self, analysis_id: str) -> List[Dict[str, Any]]:
        risks: List[Dict[str, Any]] = []

        excess = self._client.run_query("""
        MATCH (f:File {analysis_id: $analysis_id})
        MATCH (n {analysis_id: $analysis_id})-[*1..2]->(f)
        WITH f, COUNT(DISTINCT n) AS incoming_degree WHERE incoming_degree > 8
        RETURN f.rel_path AS node, incoming_degree ORDER BY incoming_degree DESC LIMIT 5
        """, {"analysis_id": analysis_id})
        if excess:
            nodes = [row.get("node", "") for row in excess]
            max_deps = max(row.get("incoming_degree", 0) for row in excess)
            severity = "critical" if max_deps > 20 else "high" if max_deps > 12 else "medium"
            risks.append({"type": "excessive_dependencies", "severity": severity, "nodes": nodes,
                          "description": f"These files are heavily depended on ({max_deps} max incoming), creating potential bottlenecks.",
                          "recommendation": "Consider refactoring into smaller, more focused modules."})

        inheritance = self._client.run_query("""
        MATCH chain=(c:Class {analysis_id: $analysis_id})-[:CLASS_INHERITS_CLASS*3..]->(base:Class)
        WITH c, LENGTH(chain) as depth RETURN c.name AS node, depth ORDER BY depth DESC LIMIT 3
        """, {"analysis_id": analysis_id})
        if inheritance:
            nodes = [row.get("node", "") for row in inheritance]
            max_depth = max(row.get("depth", 0) for row in inheritance)
            risks.append({"type": "inheritance_chain", "severity": "high" if max_depth > 5 else "medium",
                          "nodes": nodes,
                          "description": f"Deep inheritance chains (depth: {max_depth}) reduce code clarity.",
                          "recommendation": "Prefer composition over deep inheritance."})

        circular = self._client.run_query("""
        MATCH p=(a {analysis_id: $analysis_id})-[*2..3]-(b {analysis_id: $analysis_id})
        WHERE id(a) = id(b) WITH DISTINCT a, LENGTH(p) AS cycle_length
        RETURN a.id AS node, cycle_length LIMIT 5
        """, {"analysis_id": analysis_id})
        if circular:
            nodes = [row.get("node", "") for row in circular]
            risks.append({"type": "circular_dependency", "severity": "critical", "nodes": nodes,
                          "description": "Circular dependencies detected, which can cause initialization issues.",
                          "recommendation": "Refactor to break cycles by introducing intermediary layers."})
        return risks

    def _generate_onboarding_path(self, analysis_id, modules, hotspots) -> List[Dict[str, Any]]:
        path: List[Dict[str, Any]] = []
        if modules:
            path.append({"step": 1, "title": "Understand the Architecture",
                         "description": f"This repository has {len(modules)} main modules. Start with the structure overview.",
                         "keyFiles": [m["path"] for m in modules[:3]], "rationale": "Understanding modular structure helps orient new developers."})
        if hotspots["files"]:
            path.append({"step": 2, "title": "Core Files & Entry Points",
                         "description": "These files are central and depended on by many others.",
                         "keyFiles": [h["path"] or h["name"] for h in hotspots["files"][:3]],
                         "rationale": "Central files form the backbone of the system."})
        if hotspots["functions"]:
            path.append({"step": 3, "title": "Critical Functions & APIs",
                         "description": f"These {len(hotspots['functions'][:3])} functions are heavily used across the codebase.",
                         "keyFiles": [h["name"] for h in hotspots["functions"][:3]],
                         "rationale": "Knowing critical functions helps avoid duplicating work."})
        path.append({"step": 4, "title": "Integration & Testing",
                     "description": "Practice integrating with and testing the system.",
                     "keyFiles": ["tests/", "integration/"], "rationale": "Hands-on practice solidifies understanding."})
        return path

    def _get_highly_coupled_files(self, analysis_id: str, modules) -> List[str]:
        results = self._client.run_query("""
        MATCH (f:File {analysis_id: $analysis_id}) WHERE f.rel_path IS NOT NULL
        WITH f, COALESCE(f.imports_count, 0) + COALESCE(f.exports_count, 0) as coupling_score
        WHERE coupling_score > 5 RETURN f.rel_path AS file ORDER BY coupling_score DESC LIMIT 5
        """, {"analysis_id": analysis_id})
        return [row.get("file", "") for row in results if row.get("file")]

    def _calculate_risk_score(self, overview, modules, hotspots, risk_areas) -> int:
        score = 30
        if modules:
            avg = overview["files"] / len(modules)
            score += 20 if avg > 20 else 10 if avg > 10 else 0
        if hotspots["files"]:
            c = hotspots["files"][0]["criticality"]
            score += 15 if c > 0.9 else 8 if c > 0.7 else 0
        for risk in risk_areas:
            score += {"low": 5, "medium": 10, "high": 15, "critical": 25}.get(risk["severity"], 10)
        return min(100, score)

    def _generate_ai_summary(self, overview, modules, hotspots, risk_areas, risk_score) -> str:
        parts = []
        if modules:
            parts.append(f"The codebase is organized into **{len(modules)} main modules**, with `{modules[0]['name']}` as the largest.")
        if hotspots["files"]:
            core = hotspots["files"][0]["name"].split("/")[-1]
            parts.append(f"**{core}** is the most central module — depended on by the majority of the codebase.")
        level = "critical" if risk_score >= 80 else "high" if risk_score >= 60 else "moderate" if risk_score >= 40 else "low"
        parts.append(f"Overall architectural risk: **{level}** ({risk_score}/100).")
        return " ".join(parts)

    @staticmethod
    def _describe_module(module_name: str) -> str:
        descriptions = {
            "src": "Source code containing core application logic",
            "api": "API routes and request handlers",
            "services": "Business logic and service layer",
            "components": "Reusable React/UI components",
            "hooks": "Custom React hooks and state management",
            "pages": "Full-page components and layouts",
            "utils": "Utility functions and helpers",
            "types": "TypeScript type definitions",
            "models": "Data models and schemas",
            "tests": "Test files and test utilities",
            "config": "Configuration files",
            "root": "Root configuration and entry point",
            "parsers": "Language parsers for AST extraction",
            "graph": "Graph database interaction layer",
            "workers": "Background task workers",
            "middleware": "Request/response middleware",
            "auth": "Authentication and authorization",
        }
        return descriptions.get(module_name, f"Module containing {module_name}-related code")
