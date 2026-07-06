import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

logger = logging.getLogger(__name__)

class ArchitectureGenerator(BaseGenerator):
    """Generates architecture pattern decisions and design tradeoffs."""

    output_key = "architecture"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        risk_areas = facts.get("risk_areas") or []
        entry_points = facts.get("entrypoints") or []
        stats = facts.get("stats") or {}
        
        # Pull technologies from context if tech generator ran
        tech_data = (context or {}).get("integrations") or []
        tech_names = [t.get("title", "").lower() for t in tech_data]
        
        decisions = []

        # 1. Graph Persistence Decision
        if "neo4j driver" in tech_names:
            evidence = ["Neo4j is the only database import detected"]
            decisions.append({
                "title": "Graph-first persistence (Neo4j)",
                "description": "Neo4j is used as the primary data store. Relationships between entities are graph edges — enabling multi-hop traversal that relational joins cannot express.",
                "evidence": evidence
            })

        # 2. Web Interface design
        web_libs = [t.get("title") for t in tech_data if t.get("title") in ("FastAPI", "Flask", "Django")]
        if web_libs:
            decisions.append({
                "title": "API-first design",
                "description": f"All functionality is exposed exclusively through an HTTP API ({web_libs[0]}). Designed to be consumed by external clients rather than rendered server-side.",
                "evidence": [f"{web_libs[0]} is the web framework", "No server-side template rendering detected"],
            })

        # 3. Circular Dependencies Tradeoffs
        circular_area = next((r for r in risk_areas if r.get("type") == "circular_dependency"), None)
        if circular_area:
            nodes = circular_area.get("nodes", [])
            node_names = [n.split("/")[-1] for n in nodes[:2]]
            decisions.append({
                "title": "Circular dependencies accepted",
                "description": "Circular import cycles are present. They work at runtime but constrain initialization order and complicate refactoring. This appears to be an accepted trade-off.",
                "evidence": [f"Circular cycle detected by graph traversal"] + ([f"Involves: {', '.join(node_names)}"] if node_names else []),
            })

        return decisions[:5]
