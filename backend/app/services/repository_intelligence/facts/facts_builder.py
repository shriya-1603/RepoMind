import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.facts.graph_analyzer import GraphAnalyzer
from app.services.repository_intelligence.facts.graph_repository import GraphRepositoryProtocol

logger = logging.getLogger(__name__)

class FactsBuilder:
    """Builds a canonical, unified JSON containing all raw facts about the repository using a repository interface."""

    @staticmethod
    def build_facts(
        graph_repo: GraphRepositoryProtocol,
        analysis_id: str,
        overview: Dict[str, Any],
        entry_points: List[Dict[str, Any]],
        hotspots: Dict[str, Any],
        risk_areas: List[Dict[str, Any]],
        risk_score: int
    ) -> Dict[str, Any]:
        """Queries the GraphRepositoryProtocol and compiles all deterministic attributes into a facts dictionary."""
        
        # 1. Fetch raw records from graph repository
        all_imports = graph_repo.get_all_imports(analysis_id)
        all_files = graph_repo.get_all_files(analysis_id)
        all_functions = graph_repo.get_all_functions(analysis_id)
        readme_content = graph_repo.get_readme(analysis_id)

        # 2. Extract call chains
        call_chains = {}
        for f in all_files:
            path_abs = f.get("path") or ""
            if path_abs:
                call_chains[path_abs] = graph_repo.get_call_chain_for_file(analysis_id, path_abs)

        # 3. Calculate graph metrics and communities
        graph_metrics = GraphAnalyzer.calculate_metrics(all_files, all_imports, risk_areas)
        communities = GraphAnalyzer.detect_communities(all_files, all_imports)

        facts = {
            "stats": {
                "files": overview.get("files", 0),
                "classes": overview.get("classes", 0),
                "functions": overview.get("functions", 0),
                "imports": overview.get("imports", 0),
                "risk_score": risk_score
            },
            "files": all_files,
            "imports": all_imports,
            "functions": all_functions,
            "readme": readme_content or "",
            "entrypoints": entry_points,
            "hotspots": hotspots,
            "risk_areas": risk_areas,
            "graph_metrics": graph_metrics,
            "communities": communities,
            "call_chains": call_chains
        }
        return facts
