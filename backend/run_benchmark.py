#!/usr/bin/env python3
import os
import sys
import json
from typing import Dict, List, Any, Set, Tuple
from unittest.mock import MagicMock

# Set up python path to import backend app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.parser_service import ParserService
from app.services.graph_service import GraphService


def get_benchmark_folders() -> List[str]:
    base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "repo-benchmark", "python")
    folders = []
    if os.path.exists(base_dir):
        for name in os.listdir(base_dir):
            path = os.path.join(base_dir, name)
            if os.path.isdir(path):
                folders.append(path)
    return sorted(folders)


def calculate_metrics(tp: int, fp: int, fn: int) -> Tuple[float, float, float]:
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    return precision, recall, f1


def run_benchmark():
    print("=" * 70)
    print("RepoMind – Deterministic Import & Call Benchmark")
    print("=" * 70)

    folders = get_benchmark_folders()
    if not folders:
        print("Error: No benchmark folders found in repo-benchmark/python/")
        sys.exit(1)

    parser_svc = ParserService()

    # Instantiate GraphService and mock Neo4j writing methods
    graph_svc = GraphService()
    graph_svc._client = MagicMock()
    graph_svc._create_constraints_and_indexes = MagicMock()
    graph_svc._merge_repository = MagicMock()
    graph_svc._batch_merge_nodes = MagicMock()
    graph_svc._batch_merge_relationships = MagicMock()

    # Metrics accumulators
    stats: Dict[str, Dict[str, int]] = {
        "containment": {"tp": 0, "fp": 0, "fn": 0},
        "imports": {"tp": 0, "fp": 0, "fn": 0},
        "resolved_calls": {"tp": 0, "fp": 0, "fn": 0},
        "inheritance": {"tp": 0, "fp": 0, "fn": 0},
    }
    
    unresolved_call_detections = 0
    false_resolutions = 0

    false_positives = []
    false_negatives = []

    for folder in folders:
        folder_name = os.path.basename(folder)
        expected_json_path = os.path.join(folder, "expected.json")
        if not os.path.exists(expected_json_path):
            print(f"Skipping {folder_name} (no expected.json)")
            continue

        with open(expected_json_path, "r") as f:
            expected = json.load(f)

        print(f"\nAnalyzing benchmark case: [ {folder_name} ] ...")
        result = parser_svc.scan_repository(folder)

        # Run GraphService in-memory resolution to map call classifications and explicit file imports
        graph_svc.store_graph("test", folder, result)

        # Retrieve resolved FILE_IMPORTS_FILE and resolved_calls_diagnostics from parsed output
        actual_file_imports = []
        for call_arg in graph_svc._batch_merge_relationships.call_args_list:
            args = call_arg[0]
            if len(args) >= 4 and args[3] == "FILE_IMPORTS_FILE":
                actual_file_imports.extend(args[4])
        # Clear mock history for next folder
        graph_svc._batch_merge_relationships.reset_mock()

        # ----------------------------------------------------
        # 1. EVALUATE CONTAINMENT
        # ----------------------------------------------------
        expected_contains = expected.get("contains", [])
        actual_functions = result.get("functions", [])
        actual_classes = result.get("classes", [])

        matched_contains = set()
        for exp in expected_contains:
            exp_src = exp["source"].replace("\\", "/").lower()
            exp_tgt = exp["target"]
            exp_type = exp["type"]

            found = False
            if exp_type == "function":
                for fn in actual_functions:
                    fn_file = fn.get("rel_file", "").replace("\\", "/").lower()
                    if fn_file == exp_src and fn.get("name") == exp_tgt:
                        found = True
                        break
            elif exp_type == "class":
                for cls in actual_classes:
                    cls_file = cls.get("rel_file", "").replace("\\", "/").lower()
                    if cls_file == exp_src and cls.get("name") == exp_tgt:
                        found = True
                        break

            if found:
                stats["containment"]["tp"] += 1
                matched_contains.add((exp_src, exp_tgt, exp_type))
            else:
                stats["containment"]["fn"] += 1
                false_negatives.append(f"[Containment] Missing {exp_type} '{exp_tgt}' in file '{exp_src}'")

        # Find False Positives for containment
        for fn in actual_functions:
            fn_file = fn.get("rel_file", "").replace("\\", "/").lower()
            fn_name = fn.get("name")
            if (fn_file, fn_name, "function") not in matched_contains:
                stats["containment"]["fp"] += 1
                false_positives.append(f"[Containment] Extra function '{fn_name}' in '{fn_file}'")

        for cls in actual_classes:
            cls_file = cls.get("rel_file", "").replace("\\", "/").lower()
            cls_name = cls.get("name")
            if (cls_file, cls_name, "class") not in matched_contains:
                stats["containment"]["fp"] += 1
                false_positives.append(f"[Containment] Extra class '{cls_name}' in '{cls_file}'")


        # ----------------------------------------------------
        # 2. EVALUATE RESOLVED FILE IMPORTS (FILE_IMPORTS_FILE)
        # ----------------------------------------------------
        expected_imports = expected.get("imports", [])
        matched_imports = set()
        for exp in expected_imports:
            exp_src = exp["source"].replace("\\", "/").lower()
            exp_tgt = exp["target"].replace("\\", "/").lower()

            found = False
            for imp in actual_file_imports:
                # Resolve absolute paths relative to the folder
                imp_src = os.path.relpath(imp["source"].split(":")[-1], folder).replace("\\", "/").lower()
                imp_tgt = os.path.relpath(imp["target"].split(":")[-1], folder).replace("\\", "/").lower()
                if imp_src == exp_src and imp_tgt == exp_tgt:
                    found = True
                    break

            if found:
                stats["imports"]["tp"] += 1
                matched_imports.add((exp_src, exp_tgt))
            else:
                stats["imports"]["fn"] += 1
                false_negatives.append(f"[Imports] Missing Resolved Import Edge: '{exp_src}' -> '{exp_tgt}'")

        for imp in actual_file_imports:
            imp_src = os.path.relpath(imp["source"].split(":")[-1], folder).replace("\\", "/").lower()
            imp_tgt = os.path.relpath(imp["target"].split(":")[-1], folder).replace("\\", "/").lower()
            if (imp_src, imp_tgt) not in matched_imports:
                stats["imports"]["fp"] += 1
                false_positives.append(f"[Imports] Extra Resolved Import Edge: '{imp_src}' -> '{imp_tgt}'")


        # ----------------------------------------------------
        # 3. EVALUATE RESOLVED CALLS (FUNCTION_CALLS_FUNCTION)
        # ----------------------------------------------------
        expected_calls = expected.get("calls", [])
        actual_diagnostics = result.get("resolved_calls_diagnostics", [])

        actual_resolved_calls = [c for c in actual_diagnostics if c.get("resolved") and c.get("classification") in ("USER_DEFINED", "IMPORTED_SYMBOL")]

        matched_calls = set()
        for exp in expected_calls:
            exp_src = exp["source"]
            exp_tgt = exp["target"]

            found = False
            for c in actual_resolved_calls:
                c_target_file = c.get("target_file", "")
                c_name = c.get("name", "")
                if ":" in exp_tgt:
                    exp_file, exp_name = exp_tgt.split(":")
                    if c_target_file.lower().endswith(exp_file.lower()) and c_name == exp_name:
                        found = True
                        break
                else:
                    if c_name == exp_tgt:
                        found = True
                        break

            if found:
                stats["resolved_calls"]["tp"] += 1
                matched_calls.add((exp_src, exp_tgt))
            else:
                stats["resolved_calls"]["fn"] += 1
                false_negatives.append(f"[Calls] Missing resolved call link: '{exp_src}' -> '{exp_tgt}'")

        # Find False Positives for calls
        for c in actual_resolved_calls:
            c_name = c.get("name")
            c_target_file = c.get("target_file", "")
            is_expected = False
            for exp in expected_calls:
                exp_tgt = exp["target"]
                if ":" in exp_tgt:
                    exp_file, exp_name = exp_tgt.split(":")
                    if c_target_file.lower().endswith(exp_file.lower()) and c_name == exp_name:
                        is_expected = True
                        break
                else:
                    if exp_tgt == c_name:
                        is_expected = True
                        break
            if not is_expected:
                stats["resolved_calls"]["fp"] += 1
                false_positives.append(f"[Calls] Extra call resolved: '{c_name}' in '{c.get('source_file')}' (Target: {c_target_file})")
                false_resolutions += 1


        # ----------------------------------------------------
        # 4. EVALUATE UNRESOLVED CALL DETECTION
        # ----------------------------------------------------
        expected_unresolved = expected.get("unresolved_calls", [])
        for exp in expected_unresolved:
            exp_name = exp["name"]
            
            found = False
            for c in actual_diagnostics:
                if not c.get("resolved") and c.get("name") == exp_name:
                    found = True
                    break
            if found:
                unresolved_call_detections += 1
            else:
                false_negatives.append(f"[Unresolved Detection] Failed to flag ambiguous call '{exp_name}'")


        # ----------------------------------------------------
        # 5. EVALUATE INHERITANCE
        # ----------------------------------------------------
        expected_inherits = expected.get("inherits", [])
        actual_inherits = result.get("inheritance", [])

        matched_inherits = set()
        for exp in expected_inherits:
            exp_src = exp["source"]
            exp_tgt = exp["target"]

            found = False
            for inh in actual_inherits:
                if inh.get("class") == exp_src and exp_tgt in inh.get("inherits_from", []):
                    found = True
                    break

            if found:
                stats["inheritance"]["tp"] += 1
                matched_inherits.add((exp_src, exp_tgt))
            else:
                stats["inheritance"]["fn"] += 1
                false_negatives.append(f"[Inheritance] Missing inheritance: '{exp_src}' inherits from '{exp_tgt}'")

        for inh in actual_inherits:
            inh_cls = inh.get("class")
            for base in inh.get("inherits_from", []):
                is_expected = False
                for exp in expected_inherits:
                    if exp["source"] == inh_cls and exp["target"] == base:
                        is_expected = True
                        break
                if not is_expected:
                    stats["inheritance"]["fp"] += 1
                    false_positives.append(f"[Inheritance] Extra inheritance: '{inh_cls}' -> '{base}'")

        # ----------------------------------------------------
        # 6. EVALUATE PROVENANCE SPECIFIC ASSERTIONS (PHASE 6)
        # ----------------------------------------------------
        if folder_name == "provenance_test":
            for c in actual_diagnostics:
                if c.get("name") == "save" and c.get("resolved"):
                    if c.get("evidence_variable") == "user":
                        assert c.get("evidence_type") == "User", f"Expected type: User, got: {c.get('evidence_type')}"
                        assert c.get("evidence_assignment") is None, f"Expected assignment to be absent, got: {c.get('evidence_assignment')}"
                        assert c.get("evidence_lookup") == "User.save", f"Expected lookup: User.save, got: {c.get('evidence_lookup')}"
                    elif c.get("evidence_variable") == "item":
                        assert c.get("evidence_type") == "User", f"Expected type: User, got: {c.get('evidence_type')}"
                        assert c.get("evidence_assignment") == "item = User()", f"Expected assignment: item = User(), got: {c.get('evidence_assignment')}"
                        assert c.get("evidence_lookup") == "User.save", f"Expected lookup: User.save, got: {c.get('evidence_lookup')}"

    # Calculate Tiered Correctness metrics
    containment_tp = stats["containment"]["tp"]
    containment_fp = stats["containment"]["fp"]
    containment_fn = stats["containment"]["fn"]
    containment_p, containment_r, containment_f1 = calculate_metrics(containment_tp, containment_fp, containment_fn)

    imports_tp = stats["imports"]["tp"]
    imports_fp = stats["imports"]["fp"]
    imports_fn = stats["imports"]["fn"]
    imports_p, imports_r, imports_f1 = calculate_metrics(imports_tp, imports_fp, imports_fn)

    calls_tp = stats["resolved_calls"]["tp"]
    calls_fp = stats["resolved_calls"]["fp"]
    calls_fn = stats["resolved_calls"]["fn"]
    calls_p, calls_r, calls_f1 = calculate_metrics(calls_tp, calls_fp, calls_fn)

    inheritance_tp = stats["inheritance"]["tp"]
    inheritance_fp = stats["inheritance"]["fp"]
    inheritance_fn = stats["inheritance"]["fn"]
    inheritance_p, inheritance_r, inheritance_f1 = calculate_metrics(inheritance_tp, inheritance_fp, inheritance_fn)

    # False Resolution Rate
    total_resolved = calls_tp + calls_fp
    false_resolution_rate = (false_resolutions / total_resolved) if total_resolved > 0 else 0.0

    print("\n" + "=" * 70)
    print("BENCHMARK PHASE 4 VALIDATION RESULTS")
    print("=" * 70)

    print(f"{'Category':25s} | {'Actual F1':10s} | {'Target':8s} | {'Status':8s}")
    print("-" * 70)
    print(f"{'Containment':25s} | {containment_f1:9.2%} | {'>=99.0%':8s} | {'PASSED' if containment_f1 >= 0.99 else 'FAILED':8s}")
    print(f"{'Explicit Local Imports':25s} | {imports_f1:9.2%} | {'>=95.0%':8s} | {'PASSED' if imports_f1 >= 0.95 else 'FAILED':8s}")
    print(f"{'Resolved Direct Calls':25s} | {calls_f1:9.2%} | {'>=95.0%':8s} | {'PASSED' if calls_f1 >= 0.95 else 'FAILED':8s}")
    print(f"{'Inheritance':25s} | {inheritance_f1:9.2%} | {'>=95.0%':8s} | {'PASSED' if inheritance_f1 >= 0.95 else 'FAILED':8s}")
    print(f"{'False-Resolution Rate':25s} | {false_resolution_rate:9.2%} | {'<1.0%':8s} | {'PASSED' if false_resolution_rate < 0.01 else 'FAILED':8s}")
    print("=" * 70)

    print(f"\nUnresolved-Call Detections Flagged : {unresolved_call_detections}")
    print(f"False-Resolution Count (Conf wrong): {false_resolutions}")

    # Generate markdown report artifact
    report_content = f"""# RepoMind Phase 5 Validation Report: Tiered Correctness Model

## Correctness Matrix

| Category | Actual F1 | Target | Status |
| :--- | :---: | :---: | :---: |
| **Containment** | {containment_f1:.2%} | \u2265 99.0% | {'PASSED' if containment_f1 >= 0.99 else 'FAILED'} |
| **Explicit Local Imports** | {imports_f1:.2%} | \u2265 95.0% | {'PASSED' if imports_f1 >= 0.95 else 'FAILED'} |
| **Resolved Direct Calls** | {calls_f1:.2%} | \u2265 95.0% | {'PASSED' if calls_f1 >= 0.95 else 'FAILED'} |
| **Inheritance** | {inheritance_f1:.2%} | \u2265 95.0% | {'PASSED' if inheritance_f1 >= 0.95 else 'FAILED'} |
| **False-Resolution Rate** | {false_resolution_rate:.2%} | < 1.0% | {'PASSED' if false_resolution_rate < 0.01 else 'FAILED'} |

---

## Additional Runtime Diagnostics

* **Unresolved-Call Detections Flagged**: {unresolved_call_detections}
* **False-Resolution Count (Confidently wrong edges)**: {false_resolutions}

---

## Detailed Observations

### False Positives (FP): {len(false_positives)}
"""
    for fp in false_positives:
        report_content += f"* {fp}\n"
    report_content += f"\n### False Negatives (FN): {len(false_negatives)}\n"
    for fn in false_negatives:
        report_content += f"* {fn}\n"

    artifact_dir = "/Users/shriyakotala/.gemini/antigravity-ide/brain/98e55482-dac0-4f79-97b9-731514276b3a"
    os.makedirs(artifact_dir, exist_ok=True)
    report_path = os.path.join(artifact_dir, "phase_5_benchmark_report.md")
    with open(report_path, "w", encoding="utf-8") as rf:
        rf.write(report_content)

    print(f"\nReport artifact saved to: {report_path}")
    print("=" * 70)

if __name__ == "__main__":
    run_benchmark()
