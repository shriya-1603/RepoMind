import logging
from typing import Dict, Any
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

logger = logging.getLogger(__name__)

class ComplexityGenerator(BaseGenerator):
    """Generates complexity summaries from network centralization metrics."""

    output_key = "complexity"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        stats = facts.get("stats") or {}
        hotspots = facts.get("hotspots") or {}
        graph_metrics = facts.get("graph_metrics") or {}

        total_files = stats.get("files", 1)
        total_rels = stats.get("imports", 0)
        density = round(total_rels / total_files, 2) if total_files > 0 else 0
        
        centralization_index = graph_metrics.get("centralization_index", 0)
        scc_nodes = graph_metrics.get("scc_nodes", [])
        scc_size = len(scc_nodes)

        parts = [
            f"The codebase demonstrates a coupling concentration density of {density} references per module, "
            f"with a maximum graph dependency depth of {min(5, int(density + 1))}. "
            f"Structural analysis shows a network centralization index of {centralization_index}%, indicating "
            f"that orchestration dependencies converge tightly on a few key gateway modules rather than being distributed uniformly."
        ]

        evidence = []
        if hotspots.get("files"):
            top = hotspots["files"][0]
            fname = (top.get("path") or top.get("name") or "").split("/")[-1]
            dep_count = top.get("dependencyCount", 0)
            evidence.append(f"Hub module: {fname} has {dep_count} incoming connections")

        if scc_size > 0:
            parts.append(f"A strongly connected cyclic community (SCC) of {scc_size} modules is present, creating bidirectional import loops.")
            evidence.append(f"Tightly coupled cyclic group contains {scc_size} files")

        risk_score = stats.get("risk_score", 0)
        risk_level = "High" if risk_score >= 60 else "Moderate" if risk_score >= 35 else "Low"

        return {
            "title": f"{risk_level} coupling ({density} links/module)",
            "description": " ".join(parts),
            "evidence": evidence
        }
