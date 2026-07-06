import logging
from typing import Dict, Any, List, Protocol

logger = logging.getLogger(__name__)

class GraphRepositoryProtocol(Protocol):
    """Protocol defining the repository interface for Neo4j database data access."""
    
    def get_all_imports(self, analysis_id: str) -> List[Dict[str, Any]]:
        ...
        
    def get_all_files(self, analysis_id: str) -> List[Dict[str, Any]]:
        ...
        
    def get_all_functions(self, analysis_id: str) -> List[Dict[str, Any]]:
        ...
        
    def get_readme(self, analysis_id: str) -> str:
        ...
        
    def get_call_chain_for_file(self, analysis_id: str, rel_path: str) -> List[str]:
        ...


class Neo4jGraphRepository:
    """Handles all raw data access and Cypher queries against the Neo4j database."""

    def __init__(self, client):
        self.client = client

    def get_all_imports(self, analysis_id: str) -> List[Dict[str, Any]]:
        return self.client.run_query(
            "MATCH (f:File {analysis_id: $analysis_id})-[r:FILE_IMPORTS_MODULE]->(m) "
            "RETURN f.path AS file_path, m.name AS target_module",
            {"analysis_id": analysis_id},
        ) or []

    def get_all_files(self, analysis_id: str) -> List[Dict[str, Any]]:
        return self.client.run_query(
            "MATCH (f:File {analysis_id: $analysis_id}) "
            "RETURN f.name AS name, f.path AS path, f.rel_path AS rel_path",
            {"analysis_id": analysis_id},
        ) or []

    def get_all_functions(self, analysis_id: str) -> List[Dict[str, Any]]:
        return self.client.run_query(
            "MATCH (fn:Function {analysis_id: $analysis_id}) "
            "RETURN fn.name AS name, fn.file_path AS file_path",
            {"analysis_id": analysis_id},
        ) or []

    def get_readme(self, analysis_id: str) -> str:
        results = self.client.run_query(
            "MATCH (r:Repository {analysis_id: $analysis_id}) "
            "RETURN coalesce(r.readme_content, '') AS readme_content LIMIT 1",
            {"analysis_id": analysis_id},
        )
        return (results[0].get("readme_content") or "").strip() if results else ""

    def get_call_chain_for_file(self, analysis_id: str, rel_path: str) -> List[str]:
        try:
            results = self.client.run_query(
                """
                MATCH (f:File {analysis_id: $analysis_id, path: $rel_path})
                -[:FILE_CONTAINS_FUNCTION]->(fn:Function {analysis_id: $analysis_id})
                MATCH p = (fn)-[:FUNCTION_CALLS_FUNCTION*1..3]->(callee:Function {analysis_id: $analysis_id})
                WHERE all(x in nodes(p) WHERE x.analysis_id = $analysis_id)
                RETURN [n in nodes(p) | n.name] AS chain
                ORDER BY size(chain) DESC
                LIMIT 15
                """,
                {"analysis_id": analysis_id, "rel_path": rel_path},
            )
            ignored = {"basename", "prefix", "logger", "exists", "len", "print", "tensor_to_numpy", "fast_check_ffmpeg", "partial_fields"}
            if results:
                for res in results:
                    chain = res.get("chain") or []
                    cleaned = []
                    seen = set()
                    for n in chain:
                        n_lower = n.lower()
                        if n_lower not in ignored and n not in seen:
                            cleaned.append(f"{n}()")
                            seen.add(n)
                    if len(cleaned) >= 1:
                        return cleaned[:4]
                chain = results[0].get("chain") or []
                return [f"{n}()" for n in chain if n and n.lower() not in ignored][:4]
        except Exception as exc:
            logger.debug("get_call_chain_for_file failed: %s", exc)
        return []
