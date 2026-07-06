import logging
import time
from typing import Dict, Any, List
from app.services.repository_intelligence.facts.graph_repository import GraphRepositoryProtocol
from app.services.repository_intelligence.facts.cache_provider import CachedFactsProvider
from app.services.repository_intelligence.llm.llm_client import LLMClient

# Import generators
from app.services.repository_intelligence.generators.domain_generator import DomainGenerator
from app.services.repository_intelligence.generators.technology_generator import TechnologyGenerator
from app.services.repository_intelligence.generators.purpose_generator import PurposeGenerator
from app.services.repository_intelligence.generators.execution_flow_generator import ExecutionFlowGenerator
from app.services.repository_intelligence.generators.reading_guide_generator import ReadingGuideGenerator
from app.services.repository_intelligence.generators.layers_generator import LayersGenerator
from app.services.repository_intelligence.generators.critical_files_generator import CriticalFilesGenerator
from app.services.repository_intelligence.generators.complexity_generator import ComplexityGenerator
from app.services.repository_intelligence.generators.health_generator import HealthGenerator
from app.services.repository_intelligence.generators.observations_generator import ObservationsGenerator
from app.services.repository_intelligence.generators.architecture_generator import ArchitectureGenerator

logger = logging.getLogger(__name__)

class PipelineDependencyError(ValueError):
    """Exception raised when a circular dependency or resolution failure is detected in the pipeline."""
    pass

class RepositoryIntelligencePipeline:
    """Generic engine coordinating facts cache acquisition and running dependency-driven pipeline generators."""

    def __init__(self):
        self.client = LLMClient()
        self.generators = [
            DomainGenerator,
            TechnologyGenerator,
            PurposeGenerator,
            ExecutionFlowGenerator,
            ReadingGuideGenerator,
            LayersGenerator,
            CriticalFilesGenerator,
            ComplexityGenerator,
            HealthGenerator,
            ObservationsGenerator,
            ArchitectureGenerator
        ]
        # Resolve order dynamically via topological sorting on output keys and dependencies
        self.pipeline = self._resolve_order(self.generators)

    def _resolve_order(self, generators: List[type]) -> List[type]:
        """Resolves execution order using a three-state DFS cycle detector."""
        key_to_cls = {cls.output_key: cls for cls in generators if cls.output_key}
        
        # States: 0 = unvisited, 1 = visiting, 2 = visited
        states = {cls.output_key: 0 for cls in generators if cls.output_key}
        order = []
        path = []

        def visit(cls):
            key = cls.output_key
            if states.get(key) == 2:
                return
            if states.get(key) == 1:
                cycle = " -> ".join(path[path.index(key):]) + " -> " + key
                raise PipelineDependencyError(
                    f"Circular dependency detected in intelligence pipeline: {cycle}"
                )
            
            states[key] = 1
            path.append(key)
            
            for req in getattr(cls, "requires", []):
                if req in key_to_cls:
                    visit(key_to_cls[req])
            
            path.pop()
            states[key] = 2
            order.append(cls)

        for cls in generators:
            if cls.output_key:
                visit(cls)
        return order

    def assemble(
        self,
        analysis_id: str,
        graph_repo: GraphRepositoryProtocol,
        overview: Dict[str, Any],
        entry_points: List[Dict[str, Any]],
        hotspots: Dict[str, Any],
        risk_areas: List[Dict[str, Any]],
        risk_score: int
    ) -> Dict[str, Any]:
        """Runs the resolved dependency-driven pipeline using CachedFactsProvider."""
        
        # 1. Fetch facts from caching provider
        facts_provider = CachedFactsProvider(graph_repo)
        facts = facts_provider.get_facts(
            analysis_id, overview, entry_points, hotspots, risk_areas, risk_score
        )

        # 2. Sequential pipeline execution in topological order with timing profiling
        context = {}
        for generator_cls in self.pipeline:
            generator = generator_cls(self.client)
            
            start_time = time.perf_counter()
            context[generator.output_key] = generator.generate(facts, context)
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            logger.info(
                "Pipeline Step: %s | key: %s | duration: %.2fms",
                generator_cls.__name__, generator.output_key, duration_ms
            )

        # 3. Assemble final repository intelligence dict matching React model keys
        purpose = context.get("projectPurpose") or {
            "title": "Project Purpose & Core Goals",
            "description": "This program provides standard command-line routines and utility executors.",
            "confidence": 90,
            "evidence": ["No readme file found"]
        }
        flow_info = context.get("executionFlow") or {}
        guide_info = context.get("readingGuide") or {}
        health_info = context.get("health") or {}

        return {
            "projectPurpose": purpose,
            "executionFlow": flow_info.get("flow") or [],
            "workflowConfidence": flow_info.get("confidence") or 30,
            "workflowReconstructed": flow_info.get("reconstructed") or False,
            "startHere": guide_info.get("startHere") or [],
            "estimatedOnboardingMinutes": 25,
            "estimatedUnderstandingPct": guide_info.get("estimatedUnderstandingPct") or 70,
            "repositoryLayers": context.get("repositoryLayers") or [],
            "integrations": context.get("integrations") or [],
            "criticalFiles": context.get("criticalFiles") or [],
            "complexity": context.get("complexity") or {
                "title": "Moderate coupling",
                "description": "Coupling concentration is distributed.",
                "evidence": []
            },
            "domain": context.get("domain") or {},
            "observations": context.get("observations") or [],
            "closingSentence": "Pipeline execution completed successfully.",
            "healthScore": health_info.get("healthScore", 100),
            "healthBreakdown": health_info.get("healthBreakdown", []),
            "architecture": context.get("architecture") or []
        }
