"""Parser service for scanning multi-language repositories.

Supports: Python (.py), JavaScript (.js, .jsx), TypeScript (.ts, .tsx), Java (.java).
All parsers share the same output schema so the rest of the stack (graph_service,
neo4j, semantic search, impact analysis, change simulation) requires zero modification.
"""

import logging
import os
from pathlib import Path
from typing import Dict, List, Any, Optional

from app.parsers.python_parser import PythonParser
from app.parsers.java_parser import JavaParser
from app.parsers.jsts_parser import JSTSParser

logger = logging.getLogger(__name__)

# ── Language detection ────────────────────────────────────────────────────────

# Map file extension → (language tag, parser key)
_EXT_MAP: Dict[str, str] = {
    ".py":   "python",
    ".java": "java",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "tsx",
}

# Directories to always skip
_SKIP_DIRS = {
    # Python
    "__pycache__", ".pytest_cache", ".tox", ".mypy_cache",
    # JS/TS
    "node_modules", "dist", "build", ".next", ".nuxt", "coverage",
    # Java
    "target", ".gradle", ".mvn",
    # VCS / IDE
    ".git", ".idea", ".vscode",
    # Venvs
    ".venv", "venv", "env",
    # Large or temporary directories
    "vendor", "tmp",
}

# File name patterns to skip (exact match)
_SKIP_FILES = {
    # Minified
    ".min.js", ".min.ts",
    # Auto-generated TS
    ".d.ts",
}


class ParserService:
    """Service for parsing multi-language repositories into a unified schema."""

    def __init__(self):
        # Lazily initialized parsers
        self._parsers: Dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Parser factory (lazy init)
    # ------------------------------------------------------------------

    def _get_parser(self, lang: str):
        if lang not in self._parsers:
            if lang == "python":
                self._parsers["python"] = PythonParser()
            elif lang == "java":
                self._parsers["java"] = JavaParser()
            elif lang == "javascript":
                self._parsers["javascript"] = JSTSParser(language="javascript")
            elif lang == "typescript":
                self._parsers["typescript"] = JSTSParser(language="typescript")
            elif lang == "tsx":
                self._parsers["tsx"] = JSTSParser(language="tsx")
            else:
                return None
        return self._parsers[lang]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def scan_repository(self, repo_path: str) -> Dict[str, Any]:
        """
        Scan a repository and extract code structure across all supported languages.

        Output schema is identical to the original Python-only version so
        graph_service, neo4j, semantic search, impact analysis, change simulation,
        and repository architect all continue to work without modification.

        Returns:
            {
              "repository": str,
              "files": [...],
              "functions": [...],
              "classes": [...],
              "imports": [...],
              "calls": [...],
              "inheritance": [...],
              "errors": [...],
              "file_count": int,
              "parsed_count": int,
              "summary": {...},
              "languages": {...},   # language → file count (bonus info)
            }
        """
        if not os.path.isdir(repo_path):
            return {"error": f"Repository path not found: {repo_path}"}

        result: Dict[str, Any] = {
            "repository": repo_path,
            "files": [],
            "functions": [],
            "classes": [],
            "imports": [],
            "calls": [],
            "inheritance": [],
            "errors": [],
            "file_count": 0,
            "parsed_count": 0,
            "languages": {},
        }

        parsed_paths: set = set()
        max_parsed_limit = 1000
        files_scanned = 0
        files_parsed = 0
        files_skipped = 0

        for root, dirs, files in os.walk(repo_path):
            # Filter directories in-place to prune the walk
            dirs[:] = [
                d for d in dirs
                if not d.startswith(".")
                and d not in _SKIP_DIRS
                and not d.endswith("egg-info")
            ]

            for filename in files:
                files_scanned += 1
                ext = Path(filename).suffix.lower()
                lang = _EXT_MAP.get(ext)
                if not lang:
                    continue  # unsupported extension

                # Skip patterns like *.min.js, *.d.ts
                if any(filename.endswith(skip) for skip in _SKIP_FILES):
                    continue

                file_path = os.path.join(root, filename)
                if file_path in parsed_paths:
                    continue
                parsed_paths.add(file_path)

                if files_parsed < max_parsed_limit:
                    result["file_count"] += 1
                    result["languages"][lang] = result["languages"].get(lang, 0) + 1

                    parser = self._get_parser(lang)
                    if parser is None:
                        result["errors"].append({"file": file_path, "error": f"No parser for lang={lang}"})
                        continue

                    self._parse_and_merge(parser, file_path, repo_path, result)
                    files_parsed += 1
                else:
                    files_skipped += 1

        # Deduplicate imports by (type, module) per file
        seen_imports: set = set()
        unique_imports = []
        for imp in result["imports"]:
            key = (imp.get("type"), imp.get("module"), imp.get("file"))
            if key not in seen_imports:
                seen_imports.add(key)
                unique_imports.append(imp)
        result["imports"] = unique_imports

        result["summary"] = {
            "total_files": result["file_count"],
            "parsed_files": result["parsed_count"],
            "failed_files": len(result["errors"]),
            "total_functions": len(result["functions"]),
            "total_classes": len(result["classes"]),
            "total_imports": len(result["imports"]),
            "total_calls": len(result["calls"]),
            "inheritance_relationships": len(result["inheritance"]),
            "languages": result["languages"],
            "files_scanned": files_scanned,
            "files_parsed": files_parsed,
            "files_skipped": files_skipped,
        }

        lang_str = ", ".join(f"{k}={v}" for k, v in result["languages"].items())
        logger.info(
            "ParserService.scan_repository: %d files parsed (%s), %d functions, "
            "%d classes, %d imports, %d errors",
            result["parsed_count"],
            lang_str,
            len(result["functions"]),
            len(result["classes"]),
            len(result["imports"]),
            len(result["errors"]),
        )

        return result

    # ------------------------------------------------------------------
    # Internal merge helper
    # ------------------------------------------------------------------

    def _parse_and_merge(
        self,
        parser,
        file_path: str,
        repo_path: str,
        result: Dict[str, Any],
    ) -> None:
        """Parse one file and merge its output into the aggregated result."""
        try:
            file_result = parser.parse_file(file_path)
        except Exception as exc:
            result["errors"].append({"file": file_path, "error": str(exc)})
            return

        if "error" in file_result:
            result["errors"].append({"file": file_path, "error": file_result["error"]})
            return

        result["parsed_count"] += 1
        rel = os.path.relpath(file_path, repo_path)

        result["files"].append({
            "path": file_path,
            "rel_path": rel,
            "functions_count": len(file_result.get("functions", [])),
            "classes_count": len(file_result.get("classes", [])),
            "imports_count": len(file_result.get("imports", [])),
        })

        for func in file_result.get("functions", []):
            result["functions"].append({**func, "file": file_path, "rel_file": rel})

        for cls in file_result.get("classes", []):
            result["classes"].append({**cls, "file": file_path, "rel_file": rel})

        for imp in file_result.get("imports", []):
            result["imports"].append({**imp, "file": file_path, "rel_file": rel})

        for call in file_result.get("calls", []):
            result["calls"].append({**call, "file": file_path, "rel_file": rel})

        for inh in file_result.get("inheritance", []):
            result["inheritance"].append({**inh, "file": file_path, "rel_file": rel})
