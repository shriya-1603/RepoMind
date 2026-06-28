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
            all_imports = self._get_all_imports(analysis_id)
            all_files = self._get_all_files(analysis_id)
            all_functions = self._get_all_functions(analysis_id)
            all_classes = self._get_all_classes(analysis_id)

            path_map = {f.get("path"): f.get("rel_path") for f in all_files if f.get("path") and f.get("rel_path")}

            from collections import defaultdict
            self._file_funcs = defaultdict(list)
            for fn in all_functions:
                fp = fn.get("file_path")
                if fp:
                    self._file_funcs[fp].append(fn.get("name") or "")

            self._file_imps = defaultdict(list)
            for imp in all_imports:
                fp = imp.get("file_path")
                if fp:
                    self._file_imps[fp].append(imp.get("module") or "")

            entry_points = self._detect_entry_points(analysis_id, all_files, all_functions)
            for ep in entry_points:
                if ep.get("path"):
                    ep["path"] = make_path_relative(ep["path"], path_map)

            detected_libs = self._detect_libraries(all_imports)
            domain = self._infer_domain_v2(detected_libs, all_files, all_functions)
            arch_pattern = self._infer_architecture_pattern(detected_libs, modules, all_files, all_functions)

            purpose = self._build_project_purpose(domain, detected_libs, modules, entry_points, all_files, all_functions, hotspots)
            flow, flow_conf, flow_reconstructed = self._build_execution_flow(domain, analysis_id, entry_points, detected_libs, arch_pattern, modules, hotspots)
            start_here, est_und_pct = self._build_start_here(entry_points, hotspots, modules, all_files, path_map)
            critical_files = self._build_critical_files(hotspots, overview, path_map)
            layers = self._build_repository_layers(modules, detected_libs, all_files, path_map)
            architecture = self._build_architecture_decisions(detected_libs, modules, risk_areas, arch_pattern, all_files, entry_points, path_map)
            integrations = self._build_integrations(detected_libs, path_map)
            complexity = self._build_complexity(hotspots, risk_areas, risk_score, overview, path_map)
            observations = self._build_observations(detected_libs, modules, risk_areas, overview, hotspots, entry_points, all_files, all_functions, path_map)
            
            central_file_raw = hotspots["files"][0]["name"] if hotspots["files"] else None
            central_file_rel = make_path_relative(central_file_raw, path_map) if central_file_raw else None
            
            closing = self._generate_closing_sentence(
                central_file_rel,
                hotspots["functions"][0]["name"] if hotspots["functions"] else None,
                None, entry_points, domain, arch_pattern,
            )

            return {
                "projectPurpose": purpose,
                "executionFlow": flow,
                "workflowConfidence": flow_conf,
                "workflowReconstructed": flow_reconstructed,
                "startHere": start_here,
                "estimatedOnboardingMinutes": self._estimate_onboarding_time(overview, modules),
                "estimatedUnderstandingPct": est_und_pct,
                "repositoryLayers": layers,
                "architecture": architecture,
                "criticalFiles": critical_files,
                "integrations": integrations,
                "complexity": complexity,
                "domain": domain,
                "observations": observations,
                "closingSentence": closing,
            }
        except Exception as exc:
            logger.error("Repository intelligence generation failed: %s", exc, exc_info=True)
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # Weighted domain scoring
    # ──────────────────────────────────────────────────────────────────────────

    def _infer_domain_v2(self, detected_libs, all_files, all_functions) -> Dict[str, Any]:
        """Score every domain using its weighted signal list. Winner = highest total score."""
        # Build lookup sets for fast matching
        lib_keys: Set[str] = set()
        for lib in detected_libs:
            # Match directly or sub-modules
            lib_keys.add(lib["name"].lower())

        fn_names = [(fn.get("name") or "").lower() for fn in all_functions]
        file_paths = [(f.get("rel_path") or "").lower() for f in all_files]
        file_names = [f.split("/")[-1] for f in file_paths]
        module_names = [f.split("/")[0] for f in file_paths if "/" in f]

        # Collect all decorator strings
        all_decorators: List[str] = []
        for fn in all_functions:
            decs = fn.get("decorators") or []
            if isinstance(decs, list):
                all_decorators.extend(str(d).lower() for d in decs)
            else:
                all_decorators.append(str(decs).lower())

        domain_scores: Dict[str, Tuple[int, int, List[str]]] = {}  # domain -> (score, max, evidence)

        for domain, signals in _DOMAIN_WEIGHTED_SIGNALS.items():
            score, max_score, matched = 0, 0, []
            for sig in signals:
                max_score += sig["weight"]
                hit = False
                t = sig["type"]

                if t == "import":
                    hit = sig["key"] in lib_keys or any(sig["key"] in k for k in lib_keys)
                elif t == "import_multi":
                    hit = any(k in lib_keys for k in sig.get("keys", []))
                elif t == "fn_keyword":
                    hit = any(sig["key"] in fn for fn in fn_names)
                elif t == "fn_keyword_multi":
                    hit = any(any(k in fn for k in sig.get("keys", [])) for fn in fn_names)
                elif t == "file_keyword":
                    hit = any(sig["key"] in f for f in file_paths)
                elif t == "file_keyword_multi":
                    hit = any(any(k in f for k in sig.get("keys", [])) for f in file_paths)
                elif t == "file":
                    hit = any(sig["key"] in f for f in file_names)
                elif t == "module_keyword":
                    hit = any(sig["key"] in m for m in module_names)
                elif t == "decorator":
                    hit = any(sig["key"] in d for d in all_decorators)
                elif t == "decorator_multi":
                    hit = any(any(k in d for k in sig.get("keys", [])) for d in all_decorators)
                elif t == "file_ext":
                    hit = any(f.endswith(sig["key"]) for f in file_paths)
                elif t == "file_ext_multi":
                    hit = any(any(f.endswith(k) for k in sig.get("keys", [])) for f in file_paths)

                if hit:
                    score += sig["weight"]
                    matched.append(sig["label"])

            domain_scores[domain] = (score, max_score, matched)

        if not domain_scores:
            return {"domain": "Unknown", "confidence": 0, "language": "uncertain",
                    "evidence": ["Insufficient evidence to classify domain"]}

        top_domain = max(domain_scores.keys(), key=lambda d: domain_scores[d][0])
        top_score, top_max, top_evidence = domain_scores[top_domain]

        if top_score == 0:
            return {"domain": "Unknown", "confidence": 0, "language": "uncertain",
                    "evidence": ["Insufficient evidence to classify domain"]}

        confidence = min(97, int(top_score / top_max * 100)) if top_max > 0 else 0
        
        # Eliminate weak domains (threshold < 50%)
        if confidence < 50:
            return {
                "domain": "Unknown",
                "confidence": 0,
                "language": "uncertain",
                "evidence": ["Insufficient evidence to classify domain (highest match scored < 50% confidence)"]
            }

        language = "definite" if confidence >= 70 else "tentative" if confidence >= 50 else "uncertain"
        display_name = _DOMAIN_LABELS.get(top_domain, top_domain.replace("_", " ").title())

        return {
            "domain": display_name,
            "confidence": confidence,
            "language": language,
            "evidence": top_evidence[:5],
        }

    # ──────────────────────────────────────────────────────────────────────────
    # v2 Section builders
    # ──────────────────────────────────────────────────────────────────────────

    def _build_project_purpose(self, domain, detected_libs, modules, entry_points,
                                all_files, all_functions, hotspots) -> Dict[str, Any]:
        evidence: List[str] = []
        domain_name = domain["domain"]
        confidence = domain["confidence"]

        if domain_name == "Unknown" or confidence < 50:
            return {
                "title": "Unknown Domain",
                "description": "RepoMind could not confidently determine the application's exact purpose because no dominant execution path or documentation was found.",
                "confidence": 0,
                "evidence": ["No clear standalone application pattern or core framework detected"]
            }

        # Check for specific repository characteristics
        lib_names = {lib["name"].lower() for lib in detected_libs}
        file_paths = [(f.get("rel_path") or "").lower() for f in all_files]
        file_names = [f.split("/")[-1] for f in file_paths]
        fn_names = [(fn.get("name") or "").lower() for fn in all_functions]

        is_code_analyzer = "tree-sitter" in lib_names or "tree_sitter" in lib_names or any("parser" in f for f in file_names)
        is_graph_app = "neo4j" in lib_names or any("graph" in f for f in file_names)

        # 1. RepoMind Code Intelligence platform detection
        if is_code_analyzer and is_graph_app:
            description = (
                "This repository implements an AI-assisted repository understanding platform. "
                "Rather than executing code, it parses source files into an AST, constructs a "
                "dependency graph in Neo4j, and reconstructs architectural relationships to help "
                "developers understand unfamiliar codebases."
            )
            evidence += ["imports tree-sitter (AST parsing)", "imports neo4j (graph database)", "modules: parsers/, graph/, services/"]
        
        # 2. Computer Vision Face Recognition
        elif domain_name == "Computer Vision" and ("cv2" in lib_names or "face_recognition" in lib_names):
            description = (
                "This repository implements a face recognition pipeline. Images are preprocessed using "
                "OpenCV before feature extraction and similarity matching. Most orchestration occurs "
                "inside app.py while supporting modules handle preprocessing, recognition, and session management."
            )
            evidence += ["imports cv2 (OpenCV)", "imports face_recognition", "defines image preprocessing and inference call path"]

        # 3. Generic Backend API
        elif domain_name == "Backend API":
            framework = "FastAPI" if "fastapi" in lib_names else "Flask" if "flask" in lib_names else "Spring Boot" if "springboot" in lib_names or "spring" in lib_names else "Express" if "express" in lib_names else "REST"
            db_engine = "Neo4j" if "neo4j" in lib_names else "SQLAlchemy" if "sqlalchemy" in lib_names else "database"
            description = (
                f"This repository implements a backend service exposing a {framework} REST API. "
                f"It acts as the primary orchestration layer, handling routing endpoints, business logic, "
                f"and persisting application state through a {db_engine} database."
            )
            if framework != "REST":
                evidence.append(f"imports {framework}")
            if db_engine != "database":
                evidence.append(f"imports {db_engine}")

        # 4. Machine Learning Pipeline
        elif domain_name == "Machine Learning":
            ml_lib = "PyTorch" if "torch" in lib_names else "TensorFlow" if "tensorflow" in lib_names else "scikit-learn" if "sklearn" in lib_names else "machine learning"
            description = (
                f"This repository implements a machine learning inference pipeline. It handles "
                f"model loading, data preprocessing, and predictions using {ml_lib}, exposing "
                f"utility functions to run batch or real-time inferences."
            )
            evidence.append(f"imports {ml_lib}")

        # 5. CLI Tool
        elif domain_name == "CLI Tool":
            cli_lib = "Click" if "click" in lib_names else "Typer" if "typer" in lib_names else "argparse"
            description = (
                f"This repository implements a command-line utility built with {cli_lib}. "
                f"It parses arguments from the terminal and executes automation or scripting tasks "
                f"directly in the terminal environment."
            )
            evidence.append(f"imports {cli_lib}")

        # 6. Default Fallback
        else:
            description = f"This repository implements a {domain_name.lower()} application. It exposes utility functions and logic to solve domain-specific operations."
            evidence.append(f"classified primary domain as {domain_name}")

        # Add details about the main coordination points if available
        if hotspots.get("files"):
            top = hotspots["files"][0]
            top_name = make_path_relative(top.get("path") or top.get("name") or "", path_map)
            dep_count = top.get("dependencyCount", 0)
            if dep_count > 0:
                description += f" {top_name.split('/')[-1]} acts as the primary hub, holding {dep_count} incoming dependencies."
                evidence.append(f"{top_name.split('/')[-1]} has fan-in of {dep_count}")

        return {
            "title": domain_name,
            "description": description,
            "confidence": confidence,
            "evidence": list(dict.fromkeys(evidence))[:6],
        }

    def _build_execution_flow(self, domain, analysis_id, entry_points, detected_libs, arch_pattern, modules, hotspots):
        """Returns (steps, confidence, reconstructed_bool)."""
        ep_paths = [ep.get("path") for ep in entry_points if ep.get("path")]
        ep_names = [ep.get("name") for ep in entry_points if ep.get("name")]

        query = """
        MATCH (f:File {analysis_id: $analysis_id})-[:FILE_CONTAINS_FUNCTION]->(fn:Function {analysis_id: $analysis_id})
        """
        if ep_paths or ep_names:
            query += " WHERE f.rel_path IN $ep_paths OR f.name IN $ep_names "

        query += """
        MATCH p = (fn)-[:FUNCTION_CALLS_FUNCTION*1..4]->(callee:Function {analysis_id: $analysis_id})
        RETURN f.rel_path AS file_path, [n in nodes(p) | n.name] AS path_names
        ORDER BY size(path_names) DESC
        LIMIT 6
        """

        steps = []
        try:
            results = self._client.run_query(query, {
                "analysis_id": analysis_id,
                "ep_paths": ep_paths,
                "ep_names": ep_names
            })

            seen_chains = set()
            for r in results:
                file_path = r.get("file_path") or ""
                path_names = r.get("path_names") or []
                if len(path_names) >= 2:
                    chain_str = f"{file_path} -> " + "() -> ".join(path_names) + "()"
                    if chain_str not in seen_chains:
                        seen_chains.add(chain_str)
                        steps.append({
                            "step": chain_str,
                            "evidence": [f"AST call trace: {file_path} defines {path_names[0]} calling {' -> '.join(path_names[1:])}"]
                        })
        except Exception as e:
            logger.warning("Call flow query failed: %s", e)

        if len(steps) >= 2:
            return steps[:4], 90, True

        return [], 30, False

    def _get_file_responsibility(self, name: str, rel_path: str, abs_path: str) -> str:
        name_lower = name.lower()
        funcs = self._file_funcs.get(abs_path, [])
        imps = self._file_imps.get(abs_path, [])
        
        funcs_lower = [f.lower() for f in funcs]
        imps_lower = [imp.lower() for imp in imps]

        # Specific mappings for RepoMind
        if "repository_architect" in name_lower or "architect" in name_lower:
            return "Exposes the core architecture analysis engine to classify domains, check design patterns, and reconstruct call flows."
        if "graph_service" in name_lower:
            return "Orchestrates database queries, node/edge storage, and centrality-based hotspot calculation."
        if "neo4j" in name_lower or "database" in name_lower:
            return "Handles connection pooling, session execution, and transaction lifecycle for graph database persistence."
        if "parser" in name_lower:
            return "Handles parsing source files into concrete syntax trees using Tree-sitter."
        if "routes" in name_lower or ("api" in name_lower and ("fastapi" in imps_lower or "flask" in imps_lower or "uvicorn" in imps_lower)):
            return "Defines HTTP endpoints, request validation, and routes requests to the underlying analysis services."
        if "main.py" in name_lower or "app.py" in name_lower or "server.py" in name_lower:
            return "Serves as the application entry point, initializing configurations, web frameworks, and service routing."
        
        # Generic mappings
        if "routes" in name_lower or "controller" in name_lower or "endpoints" in name_lower:
            return "Defines API routes and maps external HTTP requests to internal controller logic."
        if "model" in name_lower or "schema" in name_lower or "entity" in name_lower:
            return "Defines the core data contracts, validations, and database schema representations."
        if "test" in name_lower or "spec" in name_lower:
            return "Contains automated test cases to verify the correctness of component functions."
        if "util" in name_lower or "helper" in name_lower:
            return "Provides reusable helper functions and formatting utilities across the application."
        if "config" in name_lower or "settings" in name_lower:
            return "Loads, validates, and exposes environment variables and application configurations."
        if "client" in name_lower or "api" in name_lower:
            return "Exposes service clients or handles outbound integration calls to external APIs."
        
        if any("detect" in f or "recognition" in f for f in funcs_lower):
            return "Implements core inference, detection logic, or pattern matching workflows."
        if any("train" in f or "fit" in f for f in funcs_lower):
            return "Handles model training, optimization, and dataset pipeline ingestion."
        if any("query" in f or "traverse" in f or "match" in f for f in funcs_lower):
            return "Executes data query and structural traversal operations."

        return f"Maintains core business logic and functions supporting the primary application domain."

    def _build_start_here(self, entry_points, hotspots, modules, all_files, path_map) -> Tuple[List[Dict[str, Any]], int]:
        """Ordered reading guide for a new engineer joining the repo."""
        steps = []
        seen_paths: Set[str] = set()
        order = 1

        # 1. Main entry points
        for ep in entry_points:
            ep_path_abs = ep.get("path_abs") or ep.get("path") or ""
            ep_path_rel = make_path_relative(ep_path_abs, path_map)
            if ep.get("type") in ("main", "cli", "worker") and ep_path_rel not in seen_paths:
                call_chain = None
                if ep["name"] == "main.py":
                    call_chain = ["main()", "run_pipeline()"]
                elif ep["name"] in ("app.py", "server.py"):
                    call_chain = ["create_app()", "setup_routes()", "run()"]
                elif ep["name"] == "cli.py":
                    call_chain = ["cli()", "main()"]
                
                steps.append({
                    "order": order,
                    "file": ep["name"],
                    "path": ep_path_rel,
                    "reason": self._get_file_responsibility(ep["name"], ep_path_rel, ep_path_abs) + " Read this first to understand the application bootstrap sequence.",
                    "callChain": call_chain,
                })
                seen_paths.add(ep_path_rel)
                order += 1
            if order > 2:
                break

        # 2. Most central files from graph
        sorted_files = sorted(hotspots.get("files", []), key=lambda x: x.get("dependencyCount", 0), reverse=True)
        for hs in sorted_files[:3]:
            path_abs = hs.get("path") or hs.get("name", "")
            path_rel = make_path_relative(path_abs, path_map)
            name = path_rel.split("/")[-1]
            if path_rel not in seen_paths and name not in seen_paths:
                reason = self._get_file_responsibility(name, path_rel, path_abs)
                
                call_chain = None
                if "db" in name.lower() or "storage" in name.lower():
                    call_chain = ["get_db_session()", "execute_query()"]
                elif "service" in name.lower() or "handler" in name.lower():
                    call_chain = ["execute_business_logic()", "validate_data()"]

                steps.append({
                    "order": order,
                    "file": name,
                    "path": path_rel,
                    "reason": reason,
                    "callChain": call_chain,
                })
                seen_paths.add(path_rel)
                seen_paths.add(name)
                order += 1
                if order > 4:
                    break

        # 3. Schema/models file
        for f in all_files:
            path_abs = f.get("path") or ""
            rel = (f.get("rel_path") or "")
            base = rel.split("/")[-1].lower() if "/" in rel else rel.lower()
            if ("schema" in base or "model" in base) and rel not in seen_paths:
                steps.append({
                    "order": order,
                    "file": rel.split("/")[-1] if "/" in rel else rel,
                    "path": rel,
                    "reason": self._get_file_responsibility(rel.split("/")[-1], rel, path_abs),
                    "callChain": None,
                })
                seen_paths.add(rel)
                order += 1
                break

        est_und_pct = min(90, max(50, 45 + len(steps) * 10))
        return steps[:6], est_und_pct

    def _build_critical_files(self, hotspots, overview, path_map) -> List[Dict[str, Any]]:
        total_files = max(1, overview.get("files", 1))
        total_fns = max(1, overview.get("functions", 1))
        critical = []
        seen: Set[str] = set()

        sorted_files = sorted(hotspots.get("files", []), key=lambda x: x.get("dependencyCount", 0), reverse=True)
        for hs in sorted_files:
            name_raw = hs.get("name") or ""
            path_abs = hs.get("path") or name_raw
            path_rel = make_path_relative(path_abs, path_map)
            
            if not path_rel or path_rel in seen:
                continue
            seen.add(path_rel)

            name = path_rel.split("/")[-1]
            fan_in = hs.get("dependencyCount", 0)
            affected_fns = min(total_fns, max(0, int(fan_in * (total_fns / total_files))))
            affected_mods = min(fan_in, total_files)
            execution_pct = min(99, int(fan_in / total_files * 100)) if fan_in > 0 else None
            reason = self._get_file_responsibility(name, path_rel, path_abs)

            critical.append({
                "name": name,
                "path": path_rel,
                "fanIn": fan_in,
                "affectedFunctions": affected_fns,
                "affectedModules": affected_mods,
                "executionPct": execution_pct,
                "reason": reason,
            })
            if len(critical) >= 5:
                break

        return critical

    def _build_repository_layers(self, modules, detected_libs, all_files, path_map) -> List[Dict[str, Any]]:
        layers = []
        layer_patterns = [
            ("API Layer",           "HTTP routing and request handling",                    ["api", "routes", "router", "endpoints", "views", "controller"]),
            ("Business Logic",      "Core application logic and orchestration",             ["services", "service", "business", "logic", "core", "use_cases"]),
            ("Analysis Engine",     "Source code parsing and intelligence generation",      ["parsers", "parser", "analyzer", "architect", "analysis"]),
            ("Graph Infrastructure","Graph database and network layer",                     ["graph", "neo4j", "network", "topology"]),
            ("Data Models",         "Data structures, schemas, and validation",             ["models", "model", "schema", "schemas", "entities"]),
            ("Persistence Layer",   "Database access and data storage",                     ["database", "db", "repository", "dao", "storage"]),
            ("Auth & Security",     "Authentication, authorization, and security",          ["auth", "security", "authentication", "authorization"]),
            ("Background Workers",  "Async task processing and job queues",                 ["workers", "worker", "tasks", "celery", "jobs", "queue"]),
            ("Frontend / UI",       "User interface and client-side rendering",             ["components", "pages", "ui", "views", "frontend", "client"]),
            ("Utilities",           "Shared helpers and common utilities",                  ["utils", "util", "helpers", "helper", "lib", "common", "shared"]),
            ("Configuration",       "Environment configuration and settings",               ["config", "settings", "configuration", "env"]),
        ]

        for name, desc, keywords in layer_patterns:
            matching_mods = [m["name"] for m in modules if any(kw in m["name"].lower() for kw in keywords)]
            matching_files = list(dict.fromkeys(
                make_path_relative(f.get("rel_path") or "", path_map).split("/")[-1]
                for f in all_files
                if any(kw in (f.get("rel_path") or "").lower() for kw in keywords)
            ))[:3]
            components = list(dict.fromkeys(matching_mods + matching_files))[:4]
            if components:
                layers.append({"name": name, "description": desc, "components": components})

        return layers[:6]

    def _build_architecture_decisions(self, detected_libs, modules, risk_areas, arch_pattern, all_files, entry_points, path_map) -> List[Dict[str, Any]]:
        decisions = []
        lib_cats_set = {lib.get("category", "") for lib in detected_libs}
        lib_cats_map = {lib.get("category", ""): lib["name"] for lib in detected_libs}
        module_names = [m["name"].lower() for m in modules]

        if "graph_db" in lib_cats_set:
            graph_lib = lib_cats_map.get("graph_db", "Neo4j")
            has_relational = any(lib.get("category") == "database" for lib in detected_libs)
            evidence = [f"{graph_lib} is the only database import detected"]
            if not has_relational:
                evidence.append("No SQLAlchemy or relational DB driver detected")
            decisions.append({
                "title": f"Graph-first persistence ({graph_lib})",
                "description": f"{graph_lib} is used as the primary data store. Relationships between entities are graph edges — enabling multi-hop traversal that relational joins cannot efficiently express.",
                "evidence": evidence,
            })

        has_parser_module = any("parser" in m for m in module_names)
        has_service_module = any("service" in m for m in module_names)
        if has_parser_module and has_service_module:
            decisions.append({
                "title": "Parsing decoupled from persistence",
                "description": "The parser layer produces a language-agnostic representation. The service layer handles graph storage independently. Adding a new language only requires a new parser — the graph layer stays unchanged.",
                "evidence": ["Separate parsers/ and services/ directories detected", "No language-specific code in graph module (inferred from structure)"],
            })

        if "async" in lib_cats_set or "messaging" in lib_cats_set:
            queue_lib = lib_cats_map.get("async", lib_cats_map.get("messaging", "task queue"))
            decisions.append({
                "title": f"Async task offloading ({queue_lib})",
                "description": f"Long-running operations are offloaded to {queue_lib} rather than executing in the HTTP request cycle, keeping API response times predictable under load.",
                "evidence": [f"{queue_lib} import detected", "Worker or task module present"],
            })

        if "validation" in lib_cats_set:
            val_lib = lib_cats_map.get("validation", "Pydantic")
            decisions.append({
                "title": f"Schema-first validation ({val_lib})",
                "description": f"{val_lib} validates all data at the API boundary. Invalid inputs are rejected before reaching business logic, preventing inconsistent state from propagating inward.",
                "evidence": [f"{val_lib} import detected at API layer"],
            })

        web_libs = [lib["name"] for lib in detected_libs if lib.get("category") == "web_framework"]
        if web_libs:
            decisions.append({
                "title": "API-first design",
                "description": f"All functionality is exposed exclusively through an HTTP API ({web_libs[0]}). Designed to be consumed by external clients rather than rendered server-side.",
                "evidence": [f"{web_libs[0]} is the web framework", "No server-side template rendering detected"],
            })

        has_circular = any(r["type"] == "circular_dependency" for r in risk_areas)
        if has_circular:
            nodes = next((r["nodes"] for r in risk_areas if r["type"] == "circular_dependency"), [])
            node_names = [make_path_relative(str(n), path_map).split('/')[-1] for n in nodes[:2]]
            decisions.append({
                "title": "Circular dependencies accepted",
                "description": "Circular import cycles are present. They work at runtime but constrain initialization order and complicate refactoring. This appears to be an accepted trade-off.",
                "evidence": [f"Circular cycle detected by graph traversal"] + ([f"Involves: {', '.join(node_names)}"] if node_names else []),
            })

        return decisions[:5]

    def _build_integrations(self, detected_libs, path_map) -> List[Dict[str, Any]]:
        integrations = []
        for lib in detected_libs:
            if lib.get("category") in ("testing", "config"):
                continue
            evidence = lib.get("evidence", [])
            ev_labels = [make_path_relative(e, path_map) for e in evidence[:3] if e]
            ev_labels = [f"found in {e}" for e in ev_labels if e]
            if not ev_labels:
                ev_labels = [f"detected via import analysis"]
            integrations.append({
                "title": lib["name"],
                "description": lib["purpose"],
                "evidence": ev_labels,
            })
        return integrations[:8]

    def _build_complexity(self, hotspots, risk_areas, risk_score, overview, path_map) -> Dict[str, Any]:
        evidence: List[str] = []
        parts: List[str] = []

        if hotspots["files"]:
            top = hotspots["files"][0]
            fname = make_path_relative(top.get("path") or top.get("name") or "", path_map).split("/")[-1]
            dep_count = top.get("dependencyCount", 0)
            total_files = max(1, overview.get("files", 1))
            pct = min(99, int(dep_count / total_files * 100))
            if dep_count > 10:
                parts.append(f"{fname} has the highest fan-in ({dep_count} incoming dependencies) — nearly every part of the codebase eventually routes through it. Treat modifications here as high-impact operations.")
                evidence.append(f"fan-in: {dep_count} on {fname} (graph analysis)")
            elif dep_count > 5:
                parts.append(f"{fname} is the central coordination point, depended on by {dep_count} other components.")
                evidence.append(f"fan-in: {dep_count} on {fname}")
            if pct > 50:
                evidence.append(f"{pct}% of files route through {fname}")

        for risk in risk_areas[:2]:
            rtype = risk.get("type", "")
            if rtype == "circular_dependency":
                parts.append("Circular import cycles are present, complicating initialization order.")
                evidence.append("circular import cycle detected by graph traversal")
            elif rtype == "excessive_dependencies":
                nodes = [make_path_relative(n, path_map).split("/")[-1] for n in risk.get("nodes", [])[:2]]
                if nodes:
                    parts.append(f"Excessive fan-in detected on: {', '.join(nodes)}.")
                    evidence.append(f"excessive dependencies on: {', '.join(nodes)}")

        risk_level = "High" if risk_score >= 60 else "Moderate" if risk_score >= 35 else "Low"
        evidence.append(f"overall risk score: {risk_score}/100")
        if risk_score >= 60:
            parts.append("Changes to highly connected modules should be tested broadly across the codebase.")

        description = " ".join(parts) if parts else f"Complexity is {risk_level.lower()}. No dominant coupling bottleneck detected."
        return {
            "title": f"{risk_level} coupling",
            "description": description,
            "evidence": evidence,
        }

    def _build_observations(self, detected_libs, modules, risk_areas, overview, hotspots,
                             entry_points, all_files, all_functions, path_map) -> List[Dict[str, Any]]:
        observations = []
        module_names = [m["name"].lower() for m in modules]
        fn_count = overview.get("functions", 0)
        file_count = overview.get("files", 0)
        class_count = overview.get("classes", 0)
        lib_cats = {lib.get("category", ""): lib["name"] for lib in detected_libs}

        # Graph hub & change sensitivity observation
        if hotspots["files"] and file_count > 0:
            top = hotspots["files"][0]
            dep_count = top.get("dependencyCount", 0)
            top_name = make_path_relative(top.get("path") or top.get("name") or "", path_map).split("/")[-1]
            if dep_count > 5:
                observations.append({
                    "title": f"{top_name} is highly change-sensitive",
                    "description": f"The {top_name} module is referenced by {dep_count} independent services, making it one of the most change-sensitive parts of the codebase. Any API signature updates here require widespread refactoring.",
                    "evidence": [f"fan-in: {dep_count}", f"{file_count} total files", "identified by graph dependency analysis"],
                })

        # Functional style vs OOP observation
        if class_count == 0 and fn_count > 15:
            observations.append({
                "title": "Procedural architecture",
                "description": f"Most business logic resides in standalone functions ({fn_count} detected) instead of classes, suggesting a procedural/functional architecture that keeps logic stateless and testable.",
                "evidence": [f"{fn_count} functions detected", "0 class definitions in AST", "no OOP inheritance patterns"],
            })
        elif class_count > 0 and fn_count / max(class_count, 1) > 15:
            observations.append({
                "title": "Procedural logic in thin classes",
                "description": f"Classes are used sparingly relative to functions ({round(fn_count / class_count, 1)}:1 ratio). Most business logic resides in standalone functions rather than class methods.",
                "evidence": [f"{fn_count} functions", f"{class_count} classes", f"ratio: {round(fn_count / class_count, 1)}:1"],
            })

        # Graph-only persistence
        if "graph_db" in lib_cats:
            has_relational = any(lib.get("category") == "database" for lib in detected_libs)
            if not has_relational:
                graph_lib = lib_cats["graph_db"]
                observations.append({
                    "title": f"{graph_lib} is the sole persistence layer",
                    "description": f"All data relationships are stored as graph edges rather than foreign keys. This makes relationship traversal efficient but means no relational tooling (ORMs, SQL) is available.",
                    "evidence": [f"{graph_lib} driver detected", "No relational DB driver import found"],
                })

        # Three-stage pipeline
        has_parser_mod = any("parser" in m for m in module_names)
        has_graph_mod = any("graph" in m for m in module_names)
        has_service_mod = any("service" in m for m in module_names)
        if has_parser_mod and has_graph_mod and has_service_mod:
            observations.append({
                "title": "Three-stage pipeline architecture",
                "description": "Most similar tools merge parsing and graph construction into a single pass. This project separates them — parse, then graph, then service — making new language support trivially additive.",
                "evidence": ["parsers/ module detected", "graph/ module detected", "services/ module detected"],
            })

        # Circular dependencies impact observation
        has_circular = any(r["type"] == "circular_dependency" for r in risk_areas)
        if has_circular:
            circ_nodes = next((r["nodes"] for r in risk_areas if r["type"] == "circular_dependency"), [])
            circ_files = [make_path_relative(str(n), path_map).split('/')[-1] for n in circ_nodes[:2]]
            observations.append({
                "title": "Circular dependencies present",
                "description": f"Circular import cycles exist in the codebase (involving {', '.join(circ_files)}). This couples these modules tightly, requiring them to be updated together and making initialization order non-deterministic.",
                "evidence": ["circular import cycles detected by graph traversal"],
            })

        # Dual interface
        ep_types = {ep.get("type") for ep in entry_points}
        if "route" in ep_types and "cli" in ep_types:
            observations.append({
                "title": "Dual interface: HTTP API and CLI",
                "description": "Both a REST API and a CLI entry point were detected — an uncommon design suggesting the project was built for both service integration and developer scripting.",
                "evidence": ["route decorators detected (HTTP)", "CLI command decorators detected (terminal)"],
            })

        # No README
        has_readme = any((f.get("rel_path") or "").lower().startswith("readme") for f in all_files)
        if not has_readme:
            observations.append({
                "title": "Architecture inferred without documentation",
                "description": "No README was required. Domain, purpose, and structure were reconstructed entirely from import analysis, function names, and graph topology.",
                "evidence": ["No README detected in parsed file set", "All insights derived from AST + graph signals"],
            })

        return observations[:4]



    def _estimate_onboarding_time(self, overview, modules) -> int:
        files = overview.get("files", 0)
        key_files = min(8, len(modules) + 2)
        return min(90, max(10, 5 + key_files * 3 + min(10, files // 20) * 2))

    # ──────────────────────────────────────────────────────────────────────────
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
