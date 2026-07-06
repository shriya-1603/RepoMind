from typing import Dict, Any
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

class DomainGenerator(BaseGenerator):
    """Detects software engineering domain/archetype from repository facts."""
    
    output_key = "domain"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        imports = facts.get("imports") or []
        readme = (facts.get("readme") or "").lower()

        import_names = {imp.get("target_module") or imp.get("imported_module") or "" for imp in imports}
        import_names = {n for n in import_names if n}

        domain = "cli_tool"
        confidence = 50
        evidence = ["Default software engineering archetype assigned"]

        if any(lib in import_names for lib in ("torch", "tensorflow", "keras", "jax", "transformers", "diffusers")):
            domain = "data_processing"
            confidence = 90
            evidence = ["Deep learning package import detected in AST analysis"]
        elif any(lib in import_names for lib in ("django", "flask", "fastapi", "express", "next", "react", "vue", "angular")):
            domain = "web_service"
            confidence = 90
            evidence = ["Web framework import detected in dependency imports"]
        elif "click" in import_names or "argparse" in import_names or "typer" in import_names:
            domain = "cli_tool"
            confidence = 85
            evidence = ["Command-line parsing library referenced in imports"]

        if "neural" in readme or "deep learning" in readme or "inference" in readme or "weights" in readme:
            domain = "data_processing"
            confidence = max(confidence, 80)
            evidence.append("Machine learning keywords located in README introduction")

        return {
            "domain": domain,
            "confidence": confidence,
            "language": "definite" if confidence >= 80 else "tentative",
            "evidence": list(dict.fromkeys(evidence))
        }
