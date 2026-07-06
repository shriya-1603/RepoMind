import logging
from typing import Dict, Any, List
from app.services.repository_intelligence.generators.base_generator import BaseGenerator

logger = logging.getLogger(__name__)

class LayersGenerator(BaseGenerator):
    """Clusters folders and modules dynamically to construct architectural layers."""

    output_key = "repositoryLayers"

    def generate(self, facts: Dict[str, Any], context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        communities = facts.get("communities") or {}
        layers = []

        for cluster_dir, filenames in communities.items():
            if not filenames:
                continue
            unique_files = list(dict.fromkeys(filenames))[:4]
            dir_lower = cluster_dir.lower()

            if dir_lower == "core":
                name = "Core / Bootstrap"
                desc = "Root entry points, orchestration modules, and application bootstrap logic."
            elif any(kw in dir_lower for kw in ("api", "route", "controller", "endpoint", "server", "http")):
                name = "API / Interface Layer"
                desc = "Exposes public ports, API endpoints, routing logic, and request parameter validation."
            elif any(kw in dir_lower for kw in ("service", "business", "logic", "usecase", "domain")):
                name = "Business Logic Layer"
                desc = "Core application business rules, domain operations, and orchestrations."
            elif any(kw in dir_lower for kw in ("graph", "neo4j", "db", "database", "persist", "store", "repository", "sql")):
                name = "Persistence & Graph Layer"
                desc = "Graph topologies, connection pools, query execution, and database schema persistence."
            else:
                folder_name = cluster_dir.split("/")[-1].replace("_", " ").replace("-", " ").title()
                name = f"{folder_name} Layer"
                if any(x in dir_lower for x in ("modules", "networks", "layers", "nn")):
                    desc = "Core operational logic and modeling components coordinating calculations and processing blocks."
                elif any(x in dir_lower for x in ("config", "settings", "params")):
                    desc = "Configuration declarations, constants, and system thresholds driving parameter defaults."
                elif any(x in dir_lower for x in ("utils", "helpers", "tools")):
                    desc = "Shared algorithmic helper operations and low-level utility procedures."
                else:
                    desc = f"Domain modules coordinating local processing routines under the '{cluster_dir}' workspace path."

            layers.append({
                "name": name,
                "description": desc,
                "components": unique_files
            })

        layers.sort(key=lambda x: 0 if "Core" in x["name"] else 1 if "API" in x["name"] else 2 if "Business" in x["name"] else 3)
        return layers[:6]
