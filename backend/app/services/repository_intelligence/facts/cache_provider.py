import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.facts.facts_builder import FactsBuilder
from app.services.repository_intelligence.facts.graph_repository import GraphRepositoryProtocol
from app.services.repository_intelligence.facts.cache import FactsCache

logger = logging.getLogger(__name__)

class CachedFactsProvider:
    """Manages acquisition of repository facts by proxying to FactsCache and orchestrating FactsBuilder."""

    def __init__(self, graph_repo: GraphRepositoryProtocol):
        self.graph_repo = graph_repo

    def get_facts(
        self,
        analysis_id: str,
        overview: Dict[str, Any],
        entry_points: List[Dict[str, Any]],
        hotspots: Dict[str, Any],
        risk_areas: List[Dict[str, Any]],
        risk_score: int
    ) -> Dict[str, Any]:
        """Returns cached facts if present, otherwise builds and stores facts using FactsBuilder."""
        facts = FactsCache.get(analysis_id)
        if not facts:
            logger.info("Cache miss for facts. Rebuilding for analysis: %s", analysis_id)
            facts = FactsBuilder.build_facts(
                self.graph_repo, analysis_id, overview, entry_points, hotspots, risk_areas, risk_score
            )
            FactsCache.set(analysis_id, facts)
        else:
            logger.info("Cache hit for facts. Returning cached payload for analysis: %s", analysis_id)
        return facts
