from typing import Dict, Any, List
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

class TechnologyGenerator(BaseGenerator):
    """Detects external frameworks, database integrations, and library dependencies."""

    output_key = "integrations"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        imports = facts.get("imports") or []
        import_names = {imp.get("target_module") or imp.get("imported_module") or "" for imp in imports}
        import_names = {n.split(".")[0].lower() for n in import_names if n}

        detected = []
        lib_registry = {
            "torch": ("PyTorch", "data_processing", "Deep learning framework for tensor calculations and neural networks"),
            "numpy": ("NumPy", "data_processing", "Scientific operations and multi-dimensional array processing"),
            "fastapi": ("FastAPI", "web_service", "Modern high-performance web framework for APIs"),
            "gradio": ("Gradio", "user_interface", "Rapid UI components for model visualization"),
            "neo4j": ("Neo4j Driver", "graph_db", "Native graph database connection and Cypher query driver"),
            "click": ("Click", "cli_tool", "Command-line interface construction toolset"),
            "rich": ("Rich", "cli_tool", "Rich text formatting engine for terminal logs"),
            "cv2": ("OpenCV", "data_processing", "Image processing algorithms and computer vision helper ops"),
            "ffmpeg": ("FFmpeg Wrapper", "data_processing", "Media conversion and video framing hooks")
        }

        for key, (name, cat, desc) in lib_registry.items():
            if key in import_names:
                detected.append({
                    "title": name,
                    "description": desc,
                    "evidence": [f"Import '{key}' detected in source imports"]
                })

        if not detected:
            detected.append({
                "title": "Standard Library",
                "description": "Core execution runtime and utilities",
                "evidence": ["No external library dependencies matched"]
            })

        return detected
