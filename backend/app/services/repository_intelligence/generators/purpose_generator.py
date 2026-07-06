import re
from typing import Dict, Any
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

class PurposeGenerator(BaseGenerator):
    """Generates the primary briefing text explaining what the repository is, its goals, and architecture."""

    output_key = "projectPurpose"
    requires = ["domain"]

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        readme = facts.get("readme") or ""
        
        # Pull domain archetype from context
        domain_info = (context or {}).get("domain") or {}
        domain = domain_info.get("domain", "cli_tool")

        # Extract 2-3 sentences of introduction from README
        clean_lines = []
        for line in readme.split("\n"):
            line = line.strip()
            if not line or line.startswith(("#", "!", "[", "<")):
                continue
            line_clean = re.sub(r'\[.*?\]\(.*?\)', '', line)
            line_clean = re.sub(r'`', '', line_clean)
            clean_lines.append(line_clean)
            if len(clean_lines) >= 3:
                break
        
        intro_text = " ".join(clean_lines) if clean_lines else "This repository coordinates software engineering orchestration and logic layers."

        if domain == "data_processing":
            summary = f"This framework implements advanced model pipelines and data processing workloads. {intro_text}"
        elif domain == "web_service":
            summary = f"This application implements a high-performance web endpoint and service routing structure. {intro_text}"
        else:
            summary = f"This program provides standard command-line routines and utility executors. {intro_text}"

        summary = re.sub(r'\s+', ' ', summary).strip()

        return {
            "title": "Project Purpose & Core Goals",
            "description": summary,
            "confidence": 90,
            "evidence": ["Readme introduction segment extracted and parsed"]
        }
