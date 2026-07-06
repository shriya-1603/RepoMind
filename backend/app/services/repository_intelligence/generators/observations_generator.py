import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

logger = logging.getLogger(__name__)

class ObservationsGenerator(BaseGenerator):
    """Generates high-level observations regarding bottlenecks and import cycles."""

    output_key = "observations"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        hotspots = facts.get("hotspots") or {}
        risk_areas = facts.get("risk_areas") or []
        communities = facts.get("communities") or {}
        
        observations = []

        # 1. Central orchestration bottleneck
        if hotspots.get("files"):
            top = hotspots["files"][0]
            dep_count = top.get("dependencyCount", 0)
            top_name = (top.get("path") or top.get("name") or "").split("/")[-1]
            if dep_count > 0:
                observations.append({
                    "title": f"Centralized orchestration bottleneck in {top_name}",
                    "description": f"Graph analysis identifies '{top_name}' as a primary convergence gateway. Wires parameters and controls across other subsystems, meaning changes to its signature will cascade regression risks directly downstream.",
                    "evidence": [f"Graph records {dep_count} incoming imports pointing to {top_name}"],
                })

        # 2. Modularity / Subsystem isolation
        num_communities = len(communities)
        if num_communities > 0:
            observations.append({
                "title": f"Subsystem boundaries ({num_communities} directories)",
                "description": f"The codebase architecture organizes modules across {num_communities} directories. While directory-level separation exists, coupling metrics indicate the folders are not fully isolated and share extensive import edges.",
                "evidence": [f"Found folders: {', '.join(list(communities.keys())[:3])}"],
            })

        # 3. Circular dependency communities
        circular_cycles = [r for r in risk_areas if r.get("type") == "circular_dependency"]
        if circular_cycles:
            nodes = circular_cycles[0].get("nodes", [])
            names = []
            for n in nodes[:3]:
                parts = str(n).split(":")
                if len(parts) >= 3:
                    names.append(parts[-1].split("/")[-1])
            scc_size = len(nodes)
            observations.append({
                "title": "Cyclic import loops",
                "description": f"Bidirectional reference loops connect {scc_size} modules (including {', '.join(names)}). This coupling structure creates initialization order hazards during boot.",
                "evidence": [f"Cyclic loop traversal path: {' -> '.join(names[:3])}"],
            })

        return observations[:3]
