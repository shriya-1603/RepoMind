#!/usr/bin/env python3
import os
import sys
import time
import resource
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.parser_service import ParserService
from app.services.graph_service import GraphService

def get_peak_memory_mb() -> float:
    # ru_maxrss is in bytes on macOS and kilobytes on Linux
    usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform == "darwin":
        return usage / (1024 * 1024)
    else:
        return usage / 1024

def run_performance_benchmarks():
    print("=" * 80)
    print("RepoMind Performance Benchmarking Tool")
    print("=" * 80)

    # 1. Target Repositories to Benchmark
    # We will measure on:
    # A. RepoMind own backend/app directory
    # B. A small synthetic case (e.g. narrowing_test)
    # C. Another external folder if available (e.g. repo-benchmark/python/factory_test)
    
    target_folders = [
        ("narrowing_test (Synthetic Small)", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "repo-benchmark", "python", "narrowing_test"))),
        ("RepoMind Backend (Production Code)", os.path.abspath(os.path.join(os.path.dirname(__file__), "app")))
    ]

    parser_svc = ParserService()
    
    # Mock Neo4j client to measure resolution processing logic time separate from database network writes
    graph_svc = GraphService()
    graph_svc._client = MagicMock()
    graph_svc._create_constraints_and_indexes = MagicMock()
    graph_svc._merge_repository = MagicMock()
    graph_svc._batch_merge_nodes = MagicMock()
    graph_svc._batch_merge_relationships = MagicMock()

    externals = {"logger", "os", "json", "sys", "pathlib", "pytest", "jwt", "uvicorn", "redis", "neo4j", "requests", "datetime", "logging", "FastAPI", "re", "builtins", "client"}

    results = []

    for name, path in target_folders:
        if not os.path.exists(path):
            print(f"Skipping {name} (path not found: {path})")
            continue

        print(f"\nBenchmarking: {name} ...")
        
        # Measure Parsing Time
        t_parse_start = time.perf_counter()
        scan_res = parser_svc.scan_repository(path)
        t_parse_end = time.perf_counter()
        parse_time = t_parse_end - t_parse_start

        # Measure Resolution Process & Ingestion Mock Time
        t_res_start = time.perf_counter()
        graph_svc.store_graph("perf_test", path, scan_res)
        t_res_end = time.perf_counter()
        resolution_time = t_res_end - t_res_start

        # Extract counts
        files_count = len(scan_res.get("files", []))
        funcs_count = len(scan_res.get("functions", []))
        classes_count = len(scan_res.get("classes", []))
        imports_count = len(scan_res.get("imports", []))

        diagnostics = scan_res.get("resolved_calls_diagnostics", [])
        resolved_calls = len([c for c in diagnostics if c.get("resolved")])
        total_member_calls = len([c for c in scan_res.get("calls", []) if c.get("receiver")])
        external_builtin_calls = len([c for c in scan_res.get("calls", []) if c.get("receiver") and any(c.get("receiver").lower().startswith(ext) for ext in externals)])
        candidate_calls = total_member_calls - external_builtin_calls
        resolved_local_calls = len([c for c in diagnostics if c.get("resolved") and c.get("classification") not in ("BUILTIN", "EXTERNAL")])
        
        coverage = (resolved_local_calls / candidate_calls) if candidate_calls > 0 else 0.0
        peak_mem = get_peak_memory_mb()

        # Ingestion Mock Timing vs DB write estimation
        # We estimate ingestion based on node + relationship write calls
        ingestion_calls = graph_svc._batch_merge_nodes.call_count + graph_svc._batch_merge_relationships.call_count
        graph_svc._batch_merge_nodes.reset_mock()
        graph_svc._batch_merge_relationships.reset_mock()

        results.append({
            "repository": name,
            "files": files_count,
            "functions": funcs_count,
            "classes": classes_count,
            "imports": imports_count,
            "candidate_calls": candidate_calls,
            "resolved_calls": resolved_local_calls,
            "coverage": f"{coverage:.2%}",
            "parse_time": f"{parse_time:.4f}s",
            "resolution_time": f"{resolution_time:.4f}s",
            "ingestion_calls": ingestion_calls,
            "peak_rss": f"{peak_mem:.2f} MB"
        })

    # Print Table
    print("\n" + "=" * 80)
    print("PERFORMANCE RESULTS MATRIX")
    print("=" * 80)
    template = "{:<35} | {:<5} | {:<5} | {:<5} | {:<12} | {:<10} | {:<10} | {:<8}"
    print(template.format("Repository", "Files", "Funcs", "Cls", "Cand Calls", "Parse Time", "Res Time", "Peak RSS"))
    print("-" * 80)
    for r in results:
        print(template.format(
            r["repository"], 
            r["files"], 
            r["functions"], 
            r["classes"], 
            r["candidate_calls"], 
            r["parse_time"], 
            r["resolution_time"], 
            r["peak_rss"]
        ))
    print("=" * 80)

    # Save to report artifact
    report_content = "# RepoMind Performance Benchmark Report\n\n"
    report_content += "| Repository | Files | Functions | Classes | Imports | Local Candidates | Resolved Calls | Coverage | Parse Time | Resolution Time | Ingestion DB Calls | Peak Memory |\n"
    report_content += "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n"
    for r in results:
        report_content += f"| {r['repository']} | {r['files']} | {r['functions']} | {r['classes']} | {r['imports']} | {r['candidate_calls']} | {r['resolved_calls']} | {r['coverage']} | {r['parse_time']} | {r['resolution_time']} | {r['ingestion_calls']} | {r['peak_rss']} |\n"

    artifact_dir = "/Users/shriyakotala/.gemini/antigravity-ide/brain/98e55482-dac0-4f79-97b9-731514276b3a"
    os.makedirs(artifact_dir, exist_ok=True)
    report_path = os.path.join(artifact_dir, "performance_benchmark_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"Performance report saved to: {report_path}\n")

if __name__ == "__main__":
    run_performance_benchmarks()
