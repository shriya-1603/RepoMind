import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

logger = logging.getLogger(__name__)

class CriticalFilesGenerator(BaseGenerator):
    """Generates the blast radius reasons for modification of high fan-in hotspots."""

    output_key = "criticalFiles"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        hotspots = facts.get("hotspots") or {}
        stats = facts.get("stats") or {}
        total_files = max(1, stats.get("files", 1))
        total_fns = max(1, stats.get("functions", 1))
        
        critical = []
        seen = set()

        sorted_files = sorted(hotspots.get("files", []), key=lambda x: x.get("dependencyCount", 0), reverse=True)
        for hs in sorted_files:
            path_abs = hs.get("path") or hs.get("name") or ""
            name = path_abs.split("/")[-1]
            if not path_abs or path_abs in seen:
                continue
            seen.add(path_abs)

            fan_in = hs.get("dependencyCount", 0)
            affected_fns = min(total_fns, max(0, int(fan_in * (total_fns / total_files))))
            affected_mods = min(fan_in, total_files)
            execution_pct = min(99, int(fan_in / total_files * 100)) if fan_in > 0 else None

            name_lower = name.lower()
            if any(kw in name_lower for kw in ("config", "settings", "args", "setup")):
                role_desc = "Configuration schema definition. Coordinates global system thresholds and parameters."
            elif any(kw in name_lower for kw in ("app", "main", "cli", "run", "entry", "wrapper", "pipeline", "manager")):
                role_desc = "Central orchestration hub. Coordinates high-level control flows and data streams."
            else:
                role_desc = "Operational logic component. Implements processing algorithms and state transformation."

            metric_str = f"Modifying this module carries a high regression risk: it affects {affected_mods} depending modules and has a blast radius extending to {affected_fns} downstream function signatures across the dependency tree."
            reason = f"{role_desc} {metric_str}"

            critical.append({
                "name": name,
                "path": path_abs,
                "fanIn": fan_in,
                "affectedFunctions": affected_fns,
                "affectedModules": affected_mods,
                "executionPct": execution_pct,
                "reason": reason
            })
            if len(critical) >= 5:
                break

        return critical
