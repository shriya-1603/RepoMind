import logging
from collections import defaultdict
from typing import Dict, Any, List, Set, Tuple

logger = logging.getLogger(__name__)

class GraphAnalyzer:
    """Calculates network metrics and clusters dependencies into communities."""

    @staticmethod
    def calculate_metrics(all_files: List[dict], all_imports: List[dict], risk_areas: List[dict]) -> Dict[str, Any]:
        """Calculates fan-in, fan-out, and central nodes."""
        file_paths = {f.get("path") or f.get("rel_path") or "": f for f in all_files}
        fan_in = defaultdict(int)
        fan_out = defaultdict(int)

        for imp in all_imports:
            source = imp.get("source_file") or imp.get("file_path") or ""
            target = imp.get("target_module") or imp.get("imported_module") or ""
            if source:
                fan_out[source] += 1
            if target:
                fan_in[target] += 1

        # Calculate graph centralization index
        max_incoming = max(fan_in.values()) if fan_in else 0
        total_files = len(all_files)
        centralization_index = int((max_incoming / max(1, total_files)) * 100)

        # Detect circular SCC cycles
        circular_area = next((r for r in risk_areas if r.get("type") == "circular_dependency"), None)
        scc_nodes = circular_area.get("nodes", []) if circular_area else []

        return {
            "fan_in": dict(fan_in),
            "fan_out": dict(fan_out),
            "centralization_index": centralization_index,
            "scc_nodes": scc_nodes,
        }

    @staticmethod
    def detect_communities(all_files: List[dict], all_imports: List[dict]) -> Dict[str, List[str]]:
        """Groups files by structural dependency communities."""
        clusters = defaultdict(list)
        for f in all_files:
            rel = (f.get("rel_path") or "").replace("\\", "/")
            if not rel or "." not in rel:
                continue
            parts = rel.split("/")
            if len(parts) <= 1:
                clusters["core"].append(parts[-1])
            else:
                first_dir = parts[0].lower()
                if first_dir in ("src", "app", "backend", "lib", "source") and len(parts) > 2:
                    key = f"{parts[0]}/{parts[1]}"
                else:
                    key = parts[0]
                clusters[key].append(parts[-1])
        return dict(clusters)
