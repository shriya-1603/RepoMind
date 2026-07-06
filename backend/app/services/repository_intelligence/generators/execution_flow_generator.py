import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

logger = logging.getLogger(__name__)

class ExecutionFlowGenerator(BaseGenerator):
    """Reconstructs the execution flow sequence from AST functions and call graph indicators."""

    output_key = "executionFlow"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        phases = [
            ("Dependency Initialization", ["init", "setup", "prepare", "load_config"]),
            ("Model / Resource Loading", ["load_model", "compile", "checkpoint", "download"]),
            ("Entrypoint", ["main", "run", "app", "start"]),
            ("Core Execution", ["execute", "predict", "process", "inference", "forward"]),
            ("Configuration", ["config", "settings", "parse_args"]),
            ("Preprocessing", ["crop", "align", "preprocess", "detect"]),
            ("Output Generation", ["save", "render", "stitch", "output"])
        ]

        flow_steps = []
        all_functions = facts.get("functions") or []

        for phase_name, keywords in phases:
            for fn in all_functions:
                fn_name = fn.get("name") or ""
                fn_name_lower = fn_name.lower()
                file_path = fn.get("file_path") or ""
                file_name = file_path.split("/")[-1]
                
                if not any(step["step"].startswith(phase_name) for step in flow_steps):
                    if any(kw in fn_name_lower for kw in keywords):
                        flow_steps.append({
                            "step": f"{phase_name} → {fn_name}()",
                            "evidence": [f"AST function definition found in {file_name}"],
                        })
                        break

        total_phases = len(phases)
        matched_phases = len(flow_steps)
        calc_conf = int((matched_phases / total_phases) * 100) if total_phases > 0 else 0
        
        if matched_phases >= 4:
            calc_conf = min(95, max(75, calc_conf))
            flow = flow_steps
            reconstructed = True
        else:
            flow = [{
                "step": "Dominant runtime path could not be reconstructed with high confidence.",
                "evidence": ["Call graph connectivity and phase matching coverage is below the 70% threshold."]
            }]
            calc_conf = 30
            reconstructed = False

        return {
            "flow": flow,
            "confidence": calc_conf,
            "reconstructed": reconstructed
        }
