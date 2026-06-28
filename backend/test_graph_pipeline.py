#!/usr/bin/env python3
"""
test_graph_pipeline.py
----------------------
Small integration test / demo script that:

1. Parses a sample Python file with the existing Tree-sitter parser.
2. Stores the parsed output into Neo4j via GraphService.
3. Retrieves the graph nodes and edges and prints them.

Usage
-----
    # From the backend directory:
    python test_graph_pipeline.py

Environment variables required (or set in .env):
    NEO4J_URI       (default: bolt://localhost:7687)
    NEO4J_USERNAME  (default: neo4j)
    NEO4J_PASSWORD  (default: password)
"""

import json
import os
import sys
import tempfile
import uuid

# ---------------------------------------------------------------------------
# Allow running from the backend directory without pip install
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env if python-dotenv is available
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass  # dotenv not installed – use exported env vars

from app.parsers.python_parser import PythonParser
from app.services.parser_service import ParserService
from app.graph.neo4j_client import Neo4jClient
from app.services.graph_service import GraphService

# ---------------------------------------------------------------------------
# Sample Python source to parse
# ---------------------------------------------------------------------------
SAMPLE_CODE = '''
"""Sample module used to test the graph pipeline."""

from typing import List, Dict
import os
from pathlib import Path


class BaseAnalyzer:
    """Base analyzer class."""

    def __init__(self, name: str):
        self.name = name

    def analyze(self, data: List[str]) -> Dict:
        """Analyze data."""
        results = {}
        for item in data:
            results[item] = self._process(item)
        return results

    def _process(self, item: str) -> str:
        """Process a single item."""
        return item.upper()


class AdvancedAnalyzer(BaseAnalyzer):
    """Advanced analyzer that extends BaseAnalyzer."""

    def analyze_advanced(self, data: List[str]) -> Dict:
        """Advanced analysis."""
        base_results = self.analyze(data)
        advanced = {}
        for key, value in base_results.items():
            advanced[key] = len(value)
        return advanced


def main():
    """Entry point."""
    analyzer = AdvancedAnalyzer("test")
    result = analyzer.analyze(["hello", "world"])
    print(result)
    return result


if __name__ == "__main__":
    main()
'''


def run_test():
    print("=" * 60)
    print("RepoMind – Graph Pipeline Test")
    print("=" * 60)

    # ------------------------------------------------------------------ #
    # 1. Parse sample code
    # ------------------------------------------------------------------ #
    print("\n[1/4] Parsing sample Python code with Tree-sitter …")

    parser = PythonParser()
    analysis_id = f"test-{uuid.uuid4().hex[:8]}"

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        f.write(SAMPLE_CODE)
        temp_path = f.name

    try:
        file_result = parser.parse_file(temp_path)
    finally:
        os.unlink(temp_path)

    if "error" in file_result:
        print(f"  ERROR: {file_result['error']}")
        sys.exit(1)

    print(f"  ✓  Found {len(file_result.get('functions', []))} functions")
    print(f"  ✓  Found {len(file_result.get('classes', []))} classes")
    print(f"  ✓  Found {len(file_result.get('imports', []))} imports")
    print(f"  ✓  Found {len(file_result.get('inheritance', []))} inheritance links")

    # Wrap in the shape that ParserService.scan_repository() produces
    repo_path = "/tmp/sample_repo"
    parsed_output = {
        "repository": repo_path,
        "files": [
            {
                "path": file_result["file"],
                "rel_path": "sample.py",
                "functions_count": len(file_result.get("functions", [])),
                "classes_count": len(file_result.get("classes", [])),
                "imports_count": len(file_result.get("imports", [])),
            }
        ],
        "functions": [
            {**fn, "file": file_result["file"], "rel_file": "sample.py"}
            for fn in file_result.get("functions", [])
        ],
        "classes": [
            {**cls, "file": file_result["file"], "rel_file": "sample.py"}
            for cls in file_result.get("classes", [])
        ],
        "imports": [
            {**imp, "file": file_result["file"], "rel_file": "sample.py"}
            for imp in file_result.get("imports", [])
        ],
        "calls": [
            {**call, "file": file_result["file"], "rel_file": "sample.py"}
            for call in file_result.get("calls", [])
        ],
        "inheritance": [
            {**inh, "file": file_result["file"], "rel_file": "sample.py"}
            for inh in file_result.get("inheritance", [])
        ],
        "errors": [],
        "file_count": 1,
        "parsed_count": 1,
        "summary": {
            "total_files": 1,
            "parsed_files": 1,
            "failed_files": 0,
            "total_functions": len(file_result.get("functions", [])),
            "total_classes": len(file_result.get("classes", [])),
            "total_imports": len(file_result.get("imports", [])),
            "total_calls": len(file_result.get("calls", [])),
            "inheritance_relationships": len(file_result.get("inheritance", [])),
        },
    }

    # ------------------------------------------------------------------ #
    # 2. Connect to Neo4j
    # ------------------------------------------------------------------ #
    print("\n[2/4] Connecting to Neo4j …")
    try:
        client = Neo4jClient()
        reachable = client.test_connection()
    except Exception as exc:
        print(f"  ERROR: Could not create Neo4j client: {exc}")
        sys.exit(1)

    if not reachable:
        print(
            "  ERROR: Neo4j is not reachable. "
            "Make sure it is running and NEO4J_* env vars are set correctly."
        )
        sys.exit(1)

    print("  ✓  Connected to Neo4j")

    # ------------------------------------------------------------------ #
    # 3. Store parsed data
    # ------------------------------------------------------------------ #
    print(f"\n[3/4] Storing graph for analysis_id={analysis_id} …")
    svc = GraphService(client=client)
    svc.store_graph(
        analysis_id=analysis_id,
        repo_name="sample_repo",
        parsed_output=parsed_output,
    )
    print("  ✓  Graph stored")

    # ------------------------------------------------------------------ #
    # 4. Retrieve and display
    # ------------------------------------------------------------------ #
    print("\n[4/4] Retrieving graph …")
    graph = svc.get_graph_for_analysis(analysis_id)
    nodes = graph["nodes"]
    edges = graph["edges"]

    print(f"  ✓  Retrieved {len(nodes)} nodes and {len(edges)} edges")

    print("\n--- Nodes (first 10) ---")
    for node in nodes[:10]:
        print(
            f"  [{node['type']:12s}] {node['label']:30s}  id={node['id']}"
        )
    if len(nodes) > 10:
        print(f"  … and {len(nodes) - 10} more")

    print("\n--- Edges (first 10) ---")
    for edge in edges[:10]:
        print(
            f"  {edge['source']!r:40s} --[{edge['type']}]--> {edge['target']!r}"
        )
    if len(edges) > 10:
        print(f"  … and {len(edges) - 10} more")

    # ------------------------------------------------------------------ #
    # Cleanup – remove test data
    # ------------------------------------------------------------------ #
    print(f"\n[Cleanup] Removing test nodes for analysis_id={analysis_id} …")
    svc.clear_graph_for_analysis(analysis_id)
    print("  ✓  Cleaned up")

    client.close()

    print("\n" + "=" * 60)
    print("All steps completed successfully ✓")
    print("=" * 60)

    # Return the full graph payload so callers can inspect it
    return graph


if __name__ == "__main__":
    run_test()
