import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Cache directory located in app temporary path
CACHE_DIR = "/Users/shriyakotala/.gemini/antigravity-ide/brain/ea762503-c2d3-4444-bac1-ed7f45dbe2e7/scratch/facts_cache"

class FactsCache:
    """Manages local JSON caching for extracted repository facts per analysis_id."""

    @staticmethod
    def get(analysis_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached facts JSON if it exists."""
        if not analysis_id:
            return None
        os.makedirs(CACHE_DIR, exist_ok=True)
        path = os.path.join(CACHE_DIR, f"{analysis_id}.json")
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    logger.info("Loading cached repository facts for %s", analysis_id)
                    return json.load(f)
            except Exception as e:
                logger.warning("Failed to load cached facts: %s", e)
        return None

    @staticmethod
    def set(analysis_id: str, facts: Dict[str, Any]) -> None:
        """Saves facts JSON to cache."""
        if not analysis_id or not facts:
            return
        os.makedirs(CACHE_DIR, exist_ok=True)
        path = os.path.join(CACHE_DIR, f"{analysis_id}.json")
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(facts, f, indent=2, ensure_ascii=False)
                logger.info("Saved repository facts to cache for %s", analysis_id)
        except Exception as e:
            logger.warning("Failed to cache facts: %s", e)
