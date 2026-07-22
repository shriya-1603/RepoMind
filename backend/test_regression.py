#!/usr/bin/env python3
import os
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from run_benchmark import get_benchmark_folders, calculate_metrics
from app.services.parser_service import ParserService
from app.services.graph_service import GraphService

class RepoMindRegressionTestSuite(unittest.TestCase):
    def test_all_benchmarks_correctness(self):
        """Run all 19 benchmark cases and assert F1 targets and 0 false resolutions."""
        folders = get_benchmark_folders()
        self.assertTrue(len(folders) > 0, "No benchmark cases found")

        parser_svc = ParserService()
        graph_svc = GraphService()
        graph_svc._client = MagicMock()
        graph_svc._create_constraints_and_indexes = MagicMock()
        graph_svc._merge_repository = MagicMock()
        graph_svc._batch_merge_nodes = MagicMock()
        graph_svc._batch_merge_relationships = MagicMock()

        stats = {
            "containment": {"tp": 0, "fp": 0, "fn": 0},
            "imports": {"tp": 0, "fp": 0, "fn": 0},
            "resolved_calls": {"tp": 0, "fp": 0, "fn": 0},
            "inheritance": {"tp": 0, "fp": 0, "fn": 0},
        }
        false_resolutions = 0

        for folder in folders:
            folder_name = os.path.basename(folder)
            expected_json_path = os.path.join(folder, "expected.json")
            if not os.path.exists(expected_json_path):
                continue

            import json
            with open(expected_json_path, "r") as f:
                expected = json.load(f)

            result = parser_svc.scan_repository(folder)
            graph_svc.store_graph("test", folder, result)

            actual_file_imports = []
            for call_arg in graph_svc._batch_merge_relationships.call_args_list:
                args = call_arg[0]
                if len(args) >= 4 and args[3] == "FILE_IMPORTS_FILE":
                    actual_file_imports.extend(args[4])
            graph_svc._batch_merge_relationships.reset_mock()

            # 1. EVALUATE CONTAINMENT
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

            for fn in actual_functions:
                fn_file = fn.get("rel_file", "").replace("\\", "/").lower()
                fn_name = fn.get("name")
                if (fn_file, fn_name, "function") not in matched_contains:
                    is_expected = False
                    for exp in expected_contains:
                        if exp["type"] == "function" and exp["target"] == fn_name and exp["source"].replace("\\", "/").lower() == fn_file:
                            is_expected = True
                            break
                    if not is_expected:
                        stats["containment"]["fp"] += 1

            for cls in actual_classes:
                cls_file = cls.get("rel_file", "").replace("\\", "/").lower()
                cls_name = cls.get("name")
                if (cls_file, cls_name, "class") not in matched_contains:
                    is_expected = False
                    for exp in expected_contains:
                        if exp["type"] == "class" and exp["target"] == cls_name and exp["source"].replace("\\", "/").lower() == cls_file:
                            is_expected = True
                            break
                    if not is_expected:
                        stats["containment"]["fp"] += 1

            # 2. EVALUATE RESOLVED FILE IMPORTS
            expected_imports = expected.get("imports", [])
            matched_imports = set()
            for exp in expected_imports:
                exp_src = exp["source"].replace("\\", "/").lower()
                exp_tgt = exp["target"].replace("\\", "/").lower()

                found = False
                for edge in actual_file_imports:
                    from_file = edge.get("source", "").replace("\\", "/").lower()
                    to_file = edge.get("target", "").replace("\\", "/").lower()
                    if from_file.endswith(exp_src) and to_file.endswith(exp_tgt):
                        found = True
                        break

                if found:
                    stats["imports"]["tp"] += 1
                    matched_imports.add((exp_src, exp_tgt))
                else:
                    stats["imports"]["fn"] += 1

            for edge in actual_file_imports:
                from_file = edge.get("source", "").replace("\\", "/").lower()
                to_file = edge.get("target", "").replace("\\", "/").lower()
                is_expected = False
                for exp in expected_imports:
                    exp_src = exp["source"].replace("\\", "/").lower()
                    exp_tgt = exp["target"].replace("\\", "/").lower()
                    if from_file.endswith(exp_src) and to_file.endswith(exp_tgt):
                        is_expected = True
                        break
                if not is_expected:
                    stats["imports"]["fp"] += 1

            # 3. EVALUATE RESOLVED DIRECT CALLS
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
                        if exp_tgt == c_name:
                            found = True
                            break

                if found:
                    stats["resolved_calls"]["tp"] += 1
                    matched_calls.add((exp_src, exp_tgt))
                else:
                    stats["resolved_calls"]["fn"] += 1

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
                    false_resolutions += 1
                    stats["resolved_calls"]["fp"] += 1

            # 4. EVALUATE INHERITANCE
            expected_inherits = expected.get("inherits", [])
            actual_inherits = result.get("inheritance", [])

            matched_inherits = set()
            for exp in expected_inherits:
                exp_src = exp["source"]
                exp_tgt = exp["target"]

                found = False
                for inh in actual_inherits:
                    c_name = inh.get("class", "")
                    if c_name == exp_src and exp_tgt in inh.get("inherits_from", []):
                        found = True
                        break

                if found:
                    stats["inheritance"]["tp"] += 1
                    matched_inherits.add((exp_src, exp_tgt))
                else:
                    stats["inheritance"]["fn"] += 1

            for inh in actual_inherits:
                c_name = inh.get("class", "")
                for base in inh.get("inherits_from", []):
                    is_expected = False
                    for exp in expected_inherits:
                        if exp["source"] == c_name and exp["target"] == base:
                            is_expected = True
                            break
                    if not is_expected:
                        stats["inheritance"]["fp"] += 1

        # Calculate F1 metrics
        _, _, containment_f1 = calculate_metrics(stats["containment"]["tp"], stats["containment"]["fp"], stats["containment"]["fn"])
        _, _, imports_f1 = calculate_metrics(stats["imports"]["tp"], stats["imports"]["fp"], stats["imports"]["fn"])
        _, _, calls_f1 = calculate_metrics(stats["resolved_calls"]["tp"], stats["resolved_calls"]["fp"], stats["resolved_calls"]["fn"])
        _, _, inheritance_f1 = calculate_metrics(stats["inheritance"]["tp"], stats["inheritance"]["fp"], stats["inheritance"]["fn"])

        # Assert F1 metrics match target limits
        self.assertEqual(false_resolutions, 0, f"False-resolution count must be strictly 0, got {false_resolutions}")
        self.assertTrue(containment_f1 >= 0.99, f"Containment F1 must be >= 99%, got {containment_f1:.2%}")
        self.assertTrue(imports_f1 >= 0.95, f"Imports F1 must be >= 95%, got {imports_f1:.2%}")
        self.assertTrue(calls_f1 >= 0.95, f"Calls F1 must be >= 95%, got {calls_f1:.2%}")
        self.assertTrue(inheritance_f1 >= 0.95, f"Inheritance F1 must be >= 95%, got {inheritance_f1:.2%}")

if __name__ == "__main__":
    unittest.main()
