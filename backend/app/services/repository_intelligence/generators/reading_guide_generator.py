import logging
from typing import Dict, Any, List, Set
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

logger = logging.getLogger(__name__)

class ReadingGuideGenerator(BaseGenerator):
    """Generates onboarding guide using facts exclusively."""

    output_key = "readingGuide"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        entry_points = facts.get("entrypoints") or []
        hotspots = facts.get("hotspots") or {}
        all_files = facts.get("files") or []
        graph_metrics = facts.get("graph_metrics") or {}
        fan_in_map = graph_metrics.get("fan_in") or {}
        call_chains = facts.get("call_chains") or {}
        
        steps = []
        seen_paths: Set[str] = set()
        order = 1

        def get_role_description(name: str, path: str, is_primary: bool) -> str:
            name_lower = name.lower()
            fan_in = fan_in_map.get(path, 0)
            
            if any(kw in name_lower for kw in ("app", "main", "cli", "run", "entry")):
                if is_primary:
                    return "Start here. This file assembles the application's runtime, wires together the execution paths, and initializes dependencies. Understanding this file explains how every major subsystem interacts."
                return "Alternative entry point or service runner. Bootstraps a separate runtime configuration or secondary workflow pathway within the application framework."
            if any(kw in name_lower for kw in ("config", "settings", "args", "setup")):
                return "Defines configuration boundaries. Wires parameters, environment constants, and system thresholds used globally by downstream services."
            if any(kw in name_lower for kw in ("route", "api", "controller", "server", "endpoint")):
                return "Manages interface ingestion. Maps client requests, executes security middleware, and coordinates the API response schema lifecycle."
            if any(kw in name_lower for kw in ("wrapper", "orchestrator", "pipeline", "manager")):
                return "Orchestrates execution flows. Coordinates component operations, pipelines data streams, and translates domain events to downstream services."
            if any(kw in name_lower for kw in ("utils", "helper", "common", "lib", "tools")) or fan_in > 8:
                return "Provides shared math, conversion, or file I/O operations. Extensively referenced by functional components."
            
            return "Provides the core functional implementation for this component. Read this to understand the operational algorithms, state modifications, or processing logic that executes the business requirements of the system."

        # 1. Main entry points
        for ep in entry_points:
            ep_path_abs = ep.get("path_abs") or ep.get("path") or ""
            name = ep.get("name") or ep_path_abs.split("/")[-1]
            if ep.get("type") in ("main", "cli", "worker") and ep_path_abs not in seen_paths:
                call_chain = call_chains.get(ep_path_abs)
                steps.append({
                    "order": order,
                    "file": name,
                    "path": ep_path_abs,
                    "reason": get_role_description(name, ep_path_abs, order == 1),
                    "callChain": call_chain or None
                })
                seen_paths.add(ep_path_abs)
                order += 1
            if order > 2:
                break

        # 2. Hotspots
        sorted_files = sorted(
            hotspots.get("files", []), key=lambda x: x.get("dependencyCount", 0), reverse=True
        )
        for hs in sorted_files[:3]:
            path_abs = hs.get("path") or hs.get("name", "")
            name = path_abs.split("/")[-1]
            if path_abs not in seen_paths and name not in seen_paths:
                call_chain = call_chains.get(path_abs)
                steps.append({
                    "order": order,
                    "file": name,
                    "path": path_abs,
                    "reason": get_role_description(name, path_abs, False),
                    "callChain": call_chain or None
                })
                seen_paths.add(path_abs)
                seen_paths.add(name)
                order += 1
            if order > 4:
                break

        # 3. Config
        for f in all_files:
            path_abs = f.get("path") or ""
            name = path_abs.split("/")[-1]
            if "config" in name.lower() and path_abs not in seen_paths:
                steps.append({
                    "order": order,
                    "file": name,
                    "path": path_abs,
                    "reason": get_role_description(name, path_abs, False),
                    "callChain": None
                })
                seen_paths.add(path_abs)
                order += 1
                break

        est_und_pct = min(90, max(50, 45 + len(steps) * 10))
        return {
            "startHere": steps[:6],
            "estimatedUnderstandingPct": est_und_pct
        }
