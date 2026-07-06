import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.llm.llm_client import LLMClient

logger = logging.getLogger(__name__)

class BaseGenerator:
    """Base class for all repository intelligence pipeline generators."""
    
    # Key name under which the result is mapped in the assembler/engine context
    output_key: str = ""
    
    # List of generator output_key names that must be executed prior to this generator
    requires: List[str] = []

    def __init__(self, client: LLMClient):
        self.client = client

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> Any:
        """Executes generator analysis and returns structured result payload."""
        raise NotImplementedError("Subclasses must implement generate().")
