"""Graph service – stores parsed Python repository data in Neo4j."""

import logging
import uuid
from typing import Any, Dict, List, Optional

from app.graph.neo4j_client import Neo4jClient, get_neo4j_client

logger = logging.getLogger(__name__)


class GraphService:
    """
    Translates the output of ``ParserService.scan_repository()`` into a
    property-graph stored in Neo4j, and provides retrieval helpers that
    return data shaped for frontend visualisation.

    Node labels
    -----------
    - Repository
    - File
    - Function
    - Class
    - Import

    Relationships
    -------------
    - REPOSITORY_CONTAINS_FILE
    - FILE_CONTAINS_FUNCTION
    - FILE_CONTAINS_CLASS
    - FILE_IMPORTS_MODULE
    - CLASS_INHERITS_CLASS
    - FUNCTION_CALLS_FUNCTION
    """

    def __init__(self, client: Optional[Neo4jClient] = None) -> None:
        self._client = client or get_neo4j_client()

    # ------------------------------------------------------------------
    # Public write API
    # ------------------------------------------------------------------

    def _create_constraints_and_indexes(self) -> None:
        statements = [
            "CREATE CONSTRAINT repo_id IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE",
            "CREATE CONSTRAINT file_id IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE",
            "CREATE CONSTRAINT function_id IF NOT EXISTS FOR (fn:Function) REQUIRE fn.id IS UNIQUE",
            "CREATE CONSTRAINT class_id IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT import_id IF NOT EXISTS FOR (i:Import) REQUIRE i.id IS UNIQUE",
            "CREATE INDEX file_analysis_id IF NOT EXISTS FOR (f:File) ON (f.analysis_id)",
            "CREATE INDEX function_analysis_id IF NOT EXISTS FOR (fn:Function) ON (fn.analysis_id)",
            "CREATE INDEX class_analysis_id IF NOT EXISTS FOR (c:Class) ON (c.analysis_id)",
            "CREATE INDEX import_analysis_id IF NOT EXISTS FOR (i:Import) ON (i.analysis_id)",
            "CREATE INDEX file_rel_path IF NOT EXISTS FOR (f:File) ON (f.rel_path)"
        ]
        for stmt in statements:
            try:
                self._client.run_write_query(stmt)
            except Exception as e:
                logger.warning("Failed to run Cypher schema statement: %s. Error: %s", stmt, e)

    def _batch_merge_relationships(self, analysis_id: str, label_a: str, label_b: str, rel_type: str, batch: List[Dict[str, str]]) -> None:
        if not batch:
            return
        query = f"""
        UNWIND $batch AS rel
        MATCH (a:{label_a} {{id: rel.source, analysis_id: $analysis_id}})
        MATCH (b:{label_b} {{id: rel.target, analysis_id: $analysis_id}})
        MERGE (a)-[r:{rel_type}]->(b)
        """
        self._client.run_write_query(query, {"batch": batch, "analysis_id": analysis_id})

    def store_graph(
        self,
        analysis_id: str,
        repo_name: str,
        parsed_output: Dict[str, Any],
    ) -> None:
        """
        Persist all nodes and relationships for a parsed repository.

        Args:
            analysis_id:   Unique identifier for this analysis run.
            repo_name:     Human-readable repository name / path.
            parsed_output: Dict returned by ParserService.scan_repository().
        """
        logger.info(
            "Storing graph for analysis_id=%s repo=%s", analysis_id, repo_name
        )

        # Ensure constraints and indexes are created
        self._create_constraints_and_indexes()

        # 1. Repository node (merge single repository node)
        self._merge_repository(analysis_id, repo_name, parsed_output)

        files_list = parsed_output.get("files", [])
        funcs_list = parsed_output.get("functions", [])
        classes_list = parsed_output.get("classes", [])
        imports_list = parsed_output.get("imports", [])

        node_counts = len(files_list) + len(funcs_list) + len(classes_list) + len(imports_list)

        # 2. Batch write File nodes
        files_batch = []
        file_node_ids: Dict[str, str] = {}  # file_path → neo4j node id (our id)
        for file_info in files_list:
            file_id = f"file:{analysis_id}:{file_info['path']}"
            file_node_ids[file_info["path"]] = file_id
            files_batch.append({
                "id": file_id,
                "analysis_id": analysis_id,
                "repo_name": repo_name,
                "path": file_info.get("path", ""),
                "rel_path": file_info.get("rel_path", ""),
                "functions_count": file_info.get("functions_count", 0),
                "classes_count": file_info.get("classes_count", 0),
                "imports_count": file_info.get("imports_count", 0)
            })
        if files_batch:
            query = """
            UNWIND $batch AS item
            MERGE (f:File {id: item.id})
            SET f.analysis_id      = item.analysis_id,
                f.repo_name        = item.repo_name,
                f.path             = item.path,
                f.rel_path         = item.rel_path,
                f.functions_count  = item.functions_count,
                f.classes_count    = item.classes_count,
                f.imports_count    = item.imports_count
            """
            self._client.run_write_query(query, {"batch": files_batch})

        # 3. Batch write Function nodes
        funcs_batch = []
        func_node_ids: Dict[str, str] = {}  # qualified name → node id
        for func in funcs_list:
            func_id = f"func:{analysis_id}:{func.get('file','')}:{func.get('name','')}"
            func_node_ids[self._func_key(func)] = func_id
            funcs_batch.append({
                "id": func_id,
                "analysis_id": analysis_id,
                "name": func.get("name", ""),
                "file_path": func.get("file", ""),
                "line_number": func.get("line", 0),
                "params": func.get("params", []),
                "decorators": func.get("decorators", [])
            })
        if funcs_batch:
            query = """
            UNWIND $batch AS item
            MERGE (fn:Function {id: item.id})
            SET fn.analysis_id = item.analysis_id,
                fn.name        = item.name,
                fn.file_path   = item.file_path,
                fn.line_number = item.line_number,
                fn.params      = item.params,
                fn.decorators  = item.decorators
            """
            self._client.run_write_query(query, {"batch": funcs_batch})

        # 4. Batch write Class nodes
        classes_batch = []
        class_node_ids: Dict[str, str] = {}  # qualified name → node id
        for cls in classes_list:
            cls_id = f"class:{analysis_id}:{cls.get('file','')}:{cls.get('name','')}"
            class_node_ids[self._class_key(cls)] = cls_id
            classes_batch.append({
                "id": cls_id,
                "analysis_id": analysis_id,
                "name": cls.get("name", ""),
                "file_path": cls.get("file", ""),
                "line_number": cls.get("line", 0),
                "bases": cls.get("bases", []),
                "methods": cls.get("methods", [])
            })
        if classes_batch:
            query = """
            UNWIND $batch AS item
            MERGE (c:Class {id: item.id})
            SET c.analysis_id = item.analysis_id,
                c.name        = item.name,
                c.file_path   = item.file_path,
                c.line_number = item.line_number,
                c.bases       = item.bases,
                c.methods     = item.methods
            """
            self._client.run_write_query(query, {"batch": classes_batch})

        # 5. Batch write Import nodes
        imports_batch = []
        for imp in imports_list:
            module = imp.get("module", "")
            file_path = imp.get("file", "")
            imp_id = f"import:{analysis_id}:{file_path}:{module}"
            imports_batch.append({
                "id": imp_id,
                "analysis_id": analysis_id,
                "module": module,
                "import_type": imp.get("type", "import"),
                "names": imp.get("names", []),
                "file_path": file_path
            })
        if imports_batch:
            query = """
            UNWIND $batch AS item
            MERGE (i:Import {id: item.id})
            SET i.analysis_id = item.analysis_id,
                i.module      = item.module,
                i.import_type = item.import_type,
                i.names       = item.names,
                i.file_path   = item.file_path
            """
            self._client.run_write_query(query, {"batch": imports_batch})

        # --- RELATIONSHIPS GATHERING & DEDUPLICATION ---
        repo_file_rels = []
        file_func_rels = []
        file_class_rels = []
        file_import_rels = []
        inheritance_rels = []
        call_rels = []

        repo_node_id = f"repo:{analysis_id}"
        for file_info in files_list:
            file_id = file_node_ids.get(file_info["path"])
            if file_id:
                repo_file_rels.append({"source": repo_node_id, "target": file_id, "type": "REPOSITORY_CONTAINS_FILE"})

        for func in funcs_list:
            file_id = file_node_ids.get(func.get("file", ""))
            func_id = func_node_ids.get(self._func_key(func))
            if file_id and func_id:
                file_func_rels.append({"source": file_id, "target": func_id, "type": "FILE_CONTAINS_FUNCTION"})

        for cls in classes_list:
            file_id = file_node_ids.get(cls.get("file", ""))
            class_id = class_node_ids.get(self._class_key(cls))
            if file_id and class_id:
                file_class_rels.append({"source": file_id, "target": class_id, "type": "FILE_CONTAINS_CLASS"})

        for imp in imports_list:
            file_id = file_node_ids.get(imp.get("file", ""))
            module = imp.get("module", "")
            file_path = imp.get("file", "")
            imp_id = f"import:{analysis_id}:{file_path}:{module}"
            if file_id and imp_id:
                file_import_rels.append({"source": file_id, "target": imp_id, "type": "FILE_IMPORTS_MODULE"})

        for inh in parsed_output.get("inheritance", []):
            child_name = inh.get("class", "")
            for base_name in inh.get("inherits_from", []):
                child_id = self._find_class_id(analysis_id, child_name, class_node_ids)
                base_id = self._find_class_id(analysis_id, base_name, class_node_ids)
                if child_id and base_id:
                    inheritance_rels.append({"source": child_id, "target": base_id, "type": "CLASS_INHERITS_CLASS"})

        # FUNCTION_CALLS_FUNCTION relationships
        name_to_ids: Dict[str, List[str]] = {}
        for key, node_id in func_node_ids.items():
            parts = key.split(":")
            func_name = parts[-1] if parts else key
            name_to_ids.setdefault(func_name, []).append(node_id)

        for call in parsed_output.get("calls", []):
            callee_name = call.get("name", "")
            if not callee_name or callee_name not in name_to_ids:
                continue
            callee_ids = name_to_ids[callee_name]
            call_file = call.get("file", "")
            caller_ids = [
                nid
                for key, nid in func_node_ids.items()
                if call_file and call_file in key
            ]
            for caller_id in caller_ids:
                for callee_id in callee_ids:
                    if caller_id != callee_id:
                        call_rels.append({"source": caller_id, "target": callee_id, "type": "FUNCTION_CALLS_FUNCTION"})

        # Diagnostics & Deduplication
        all_rels = (
            repo_file_rels +
            file_func_rels +
            file_class_rels +
            file_import_rels +
            inheritance_rels +
            call_rels
        )
        total_relationships_count = len(all_rels)

        unique_rels_dict = {}
        duplicates_removed = 0
        for r in all_rels:
            key = (r["source"], r["target"], r["type"], analysis_id)
            if key not in unique_rels_dict:
                unique_rels_dict[key] = r
            else:
                duplicates_removed += 1

        repo_file_rels_dedup = []
        file_func_rels_dedup = []
        file_class_rels_dedup = []
        file_import_rels_dedup = []
        inheritance_rels_dedup = []
        call_rels_dedup = []

        for r in unique_rels_dict.values():
            rtype = r["type"]
            if rtype == "REPOSITORY_CONTAINS_FILE":
                repo_file_rels_dedup.append(r)
            elif rtype == "FILE_CONTAINS_FUNCTION":
                file_func_rels_dedup.append(r)
            elif rtype == "FILE_CONTAINS_CLASS":
                file_class_rels_dedup.append(r)
            elif rtype == "FILE_IMPORTS_MODULE":
                file_import_rels_dedup.append(r)
            elif rtype == "CLASS_INHERITS_CLASS":
                inheritance_rels_dedup.append(r)
            elif rtype == "FUNCTION_CALLS_FUNCTION":
                call_rels_dedup.append(r)

        # Output exact diagnostics format
        logger.info(
            "[GRAPH_STORE] nodes=%d relationships=%d unique_relationships=%d duplicates_removed=%d",
            node_counts,
            total_relationships_count,
            len(unique_rels_dict),
            duplicates_removed
        )
        print(f"[GRAPH_STORE] nodes={node_counts}")
        print(f"[GRAPH_STORE] relationships={total_relationships_count}")
        print(f"[GRAPH_STORE] unique_relationships={len(unique_rels_dict)}")
        print(f"[GRAPH_STORE] duplicates_removed={duplicates_removed}")

        # Storing diagnostics metrics back into parsed_output for routes.py output/observability
        parsed_output["nodes_written"] = node_counts
        parsed_output["relationships_written"] = len(unique_rels_dict)
        parsed_output["duplicates_removed"] = duplicates_removed

        # Batch write relationships using UNWIND
        self._batch_merge_relationships(analysis_id, "Repository", "File", "REPOSITORY_CONTAINS_FILE", repo_file_rels_dedup)
        self._batch_merge_relationships(analysis_id, "File", "Function", "FILE_CONTAINS_FUNCTION", file_func_rels_dedup)
        self._batch_merge_relationships(analysis_id, "File", "Class", "FILE_CONTAINS_CLASS", file_class_rels_dedup)
        self._batch_merge_relationships(analysis_id, "File", "Import", "FILE_IMPORTS_MODULE", file_import_rels_dedup)
        self._batch_merge_relationships(analysis_id, "Class", "Class", "CLASS_INHERITS_CLASS", inheritance_rels_dedup)
        self._batch_merge_relationships(analysis_id, "Function", "Function", "FUNCTION_CALLS_FUNCTION", call_rels_dedup)

        logger.info("Graph stored for analysis_id=%s", analysis_id)

    # ------------------------------------------------------------------
    # Public read API
    # ------------------------------------------------------------------

    def get_graph_for_analysis(self, analysis_id: str) -> Dict[str, Any]:
        """
        Retrieve all nodes and relationships for a given analysis run,
        formatted for frontend graph visualisation.

        Returns:
            {
              "nodes": [{"id", "type", "label", "metadata"}, ...],
              "edges": [{"id", "source", "target", "type"}, ...],
            }
        """
        nodes = self._fetch_nodes(analysis_id)
        edges = self._fetch_edges(analysis_id)
        return {"nodes": nodes, "edges": edges}

    def get_impact_analysis_for_target(self, analysis_id: str, target: str) -> Optional[Dict[str, Any]]:
        """Perform a 2-hop Neo4j traversal to compute impact analysis for a target."""
        target_node = self._find_target_node(analysis_id, target)
        if not target_node:
            return None

        target_id = target_node["id"]
        upstream_nodes = self._gather_related_nodes(analysis_id, target_id, incoming=True)
        downstream_nodes = self._gather_related_nodes(analysis_id, target_id, incoming=False)

        affected_files = set()
        affected_functions = set()
        affected_classes = set()
        all_related = []

        for node in upstream_nodes + downstream_nodes:
            node_type = node.get("type", "unknown")
            label = node.get("label", "")
            if node_type == "file":
                affected_files.add(label)
            elif node_type == "function":
                affected_functions.add(label)
            elif node_type == "class":
                affected_classes.add(label)
            all_related.append(node)

        dependency_counts = {
            "upstream": len(upstream_nodes),
            "downstream": len(downstream_nodes),
            "total": len({n["id"] for n in upstream_nodes + downstream_nodes}),
        }

        risk_score = self._score_impact(analysis_id, target_id, upstream_nodes, downstream_nodes)
        explanation = self._build_explanation(target_node, upstream_nodes, downstream_nodes, risk_score)

        return {
            "source": "neo4j",
            "targetNode": target_node,
            "upstreamDependencies": upstream_nodes,
            "downstreamDependencies": downstream_nodes,
            "affectedFiles": sorted(list(affected_files)),
            "affectedFunctions": sorted(list(affected_functions)),
            "affectedClasses": sorted(list(affected_classes)),
            "dependencyCounts": dependency_counts,
            "riskScore": risk_score,
            "explanation": explanation,
        }

    def simulate_change_real(self, analysis_id: str, target: str) -> Optional[Dict[str, Any]]:
        """Simulate a change with the richer /change-simulation-real response shape.

        Returns blastRadius as {direct, indirect, total} and uses
        directlyAffectedFiles / directlyAffectedFunctions / indirectlyAffectedFunctions.
        Falls back to None if target not found so caller can use mock.
        """
        target_node = self._find_target_node(analysis_id, target)
        if not target_node:
            logger.info(
                "[change-sim-real] target=%s not found in analysis_id=%s — will use mock fallback",
                target, analysis_id,
            )
            return None

        target_id = target_node["id"]
        logger.info(
            "[change-sim-real] source=neo4j target_id=%s target_label=%s analysis_id=%s",
            target_id, target_node.get("label"), analysis_id,
        )

        # 1-hop directly affected files
        directly_affected_files = self._collect_string_values(
            "MATCH (tgt {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (f:File {analysis_id: $analysis_id})\n"
            "WHERE (tgt)-[*1..1]-(f)\n"
            "RETURN DISTINCT f.rel_path AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        # 1-hop directly affected functions
        directly_affected_functions = self._collect_string_values(
            "MATCH (tgt {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (fn:Function {analysis_id: $analysis_id})\n"
            "WHERE (tgt)-[*1..1]-(fn)\n"
            "RETURN DISTINCT fn.name AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        # 2-hop indirectly affected functions
        indirectly_affected_functions = self._collect_string_values(
            "MATCH (tgt {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (fn:Function {analysis_id: $analysis_id})\n"
            "WHERE (tgt)-[:FUNCTION_CALLS_FUNCTION*2..3]-(fn)\n"
            "RETURN DISTINCT fn.name AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        # Affected classes (up to 2 hops via relevant relationship types)
        affected_classes = self._collect_string_values(
            "MATCH (tgt {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (c:Class {analysis_id: $analysis_id})\n"
            "WHERE (tgt)-[*1..2]-(c)\n"
            "AND ALL(r IN [(tgt)-[r2*1..2]-(c) | r2][0] WHERE type(r) IN "
            "['CLASS_INHERITS_CLASS', 'FILE_CONTAINS_CLASS', 'FUNCTION_CALLS_FUNCTION'])\n"
            "RETURN DISTINCT c.name AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        direct_count = len(set(directly_affected_files + directly_affected_functions))
        indirect_count = len(set(indirectly_affected_functions))
        total_count = len(set(
            directly_affected_files + directly_affected_functions +
            indirectly_affected_functions + affected_classes
        ))

        risk_score = self._calculate_change_risk_score(
            len(directly_affected_files),
            len(directly_affected_functions),
            len(indirectly_affected_functions),
            len(affected_classes),
        )

        explanation_items = (directly_affected_files + directly_affected_functions + affected_classes)[:10]
        explanation = (
            f"If this {'function' if target_node.get('type') == 'function' else 'node'} changes, "
            f"these modules may be impacted: {', '.join(explanation_items)}"
            f"{'...' if len(explanation_items) >= 10 else ''}"
        )

        logger.info(
            "[change-sim-real] direct=%d indirect=%d total=%d risk=%d",
            direct_count, indirect_count, total_count, risk_score,
        )

        return {
            "source": "neo4j",
            "target": target_node,
            "directlyAffectedFiles": directly_affected_files,
            "directlyAffectedFunctions": directly_affected_functions,
            "indirectlyAffectedFunctions": indirectly_affected_functions,
            "affectedClasses": affected_classes,
            "blastRadius": {
                "direct": direct_count,
                "indirect": indirect_count,
                "total": total_count,
            },
            "riskScore": risk_score,
            "explanation": explanation,
        }

    def simulate_change(self, analysis_id: str, target: str) -> Optional[Dict[str, Any]]:
        target_node = self._find_target_node(analysis_id, target)
        if not target_node:
            return None

        target_id = target_node["id"]

        direct_files = self._collect_string_values(
            "MATCH (target {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (f:File {analysis_id: $analysis_id})\n"
            "MATCH p = (target)-[*1..1]-(f)\n"
            "RETURN DISTINCT f.rel_path AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        direct_functions = self._collect_string_values(
            "MATCH (target {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (fn:Function {analysis_id: $analysis_id})\n"
            "MATCH p = (target)-[*1..1]-(fn)\n"
            "RETURN DISTINCT fn.name AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        indirect_functions = self._collect_string_values(
            "MATCH (target {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (fn:Function {analysis_id: $analysis_id})\n"
            "WHERE (target)-[:FUNCTION_CALLS_FUNCTION*2..3]-(fn)\n"
            "RETURN DISTINCT fn.name AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        affected_classes = self._collect_string_values(
            "MATCH (target {id: $target_id, analysis_id: $analysis_id})\n"
            "MATCH (c:Class {analysis_id: $analysis_id})\n"
            "MATCH p = (target)-[*1..2]-(c)\n"
            "WHERE ALL(r IN relationships(p) WHERE type(r) IN ['CLASS_INHERITS_CLASS', 'FILE_CONTAINS_CLASS', 'FUNCTION_CALLS_FUNCTION'])\n"
            "RETURN DISTINCT c.name AS value\n",
            {"analysis_id": analysis_id, "target_id": target_id},
        )

        unique_items = set(direct_files + direct_functions + indirect_functions + affected_classes)
        blast_radius = len(unique_items)
        risk_score = self._calculate_change_risk_score(
            len(direct_files), len(direct_functions), len(indirect_functions), len(affected_classes)
        )
        explanation_base = ', '.join((direct_files + direct_functions + affected_classes)[:10])
        explanation = (
            f"If this function changes, these modules may be impacted: "
            f"{explanation_base}{'...' if len(direct_files + direct_functions + affected_classes) > 10 else ''}"
        )

        return {
            "source": "neo4j",
            "target": target_node.get("label", target),
            "directFiles": direct_files,
            "directFunctions": direct_functions,
            "indirectFunctions": indirect_functions,
            "affectedClasses": affected_classes,
            "blastRadius": blast_radius,
            "riskScore": risk_score,
            "explanation": explanation,
        }

    def _collect_string_values(self, query: str, parameters: Dict[str, Any]) -> List[str]:
        rows = self._client.run_query(query, parameters)
        return [row.get("value") for row in rows if row.get("value")]

    def _calculate_change_risk_score(
        self,
        direct_files_count: int,
        direct_functions_count: int,
        indirect_functions_count: int,
        affected_classes_count: int,
    ) -> int:
        score = (
            direct_files_count * 8
            + direct_functions_count * 7
            + indirect_functions_count * 4
            + affected_classes_count * 5
            + 15
        )
        return min(100, max(20, score))

    # ------------------------------------------------------------------
    # Clear
    # ------------------------------------------------------------------

    def clear_graph_for_analysis(self, analysis_id: str) -> None:
        """
        Delete all nodes (and their relationships) tagged with the given
        analysis_id.  Other analyses are untouched.
        """
        query = """
        MATCH (n {analysis_id: $analysis_id})
        DETACH DELETE n
        """
        self._client.run_write_query(query, {"analysis_id": analysis_id})
        logger.info("Cleared graph for analysis_id=%s", analysis_id)

    # ------------------------------------------------------------------
    # Private – node merges
    # ------------------------------------------------------------------

    def _merge_repository(
        self,
        analysis_id: str,
        repo_name: str,
        parsed_output: Dict[str, Any],
    ) -> str:
        node_id = f"repo:{analysis_id}"
        summary = parsed_output.get("summary", {})
        timing = parsed_output.get("timing_metrics", {})
        query = """
        MERGE (r:Repository {id: $id})
        SET r.analysis_id    = $analysis_id,
            r.name           = $repo_name,
            r.total_files    = $total_files,
            r.total_functions= $total_functions,
            r.total_classes  = $total_classes,
            r.total_imports  = $total_imports,
            r.cloneTimeMs    = $clone_time,
            r.parseTimeMs    = $parse_time,
            r.graphStoreTimeMs = $graph_store_time,
            r.gitActivityTimeMs = $git_activity_time,
            r.totalAnalysisTimeMs = $total_analysis_time
        RETURN r.id AS id
        """
        self._client.run_write_query(
            query,
            {
                "id": node_id,
                "analysis_id": analysis_id,
                "repo_name": repo_name,
                "total_files": summary.get("total_files", 0),
                "total_functions": summary.get("total_functions", 0),
                "total_classes": summary.get("total_classes", 0),
                "total_imports": summary.get("total_imports", 0),
                "clone_time": timing.get("cloneTimeMs", 0),
                "parse_time": timing.get("parseTimeMs", 0),
                "graph_store_time": timing.get("graphStoreTimeMs", 0),
                "git_activity_time": timing.get("gitActivityTimeMs", 0),
                "total_analysis_time": timing.get("totalAnalysisTimeMs", 0),
            },
        )
        return node_id

    def _merge_file(
        self, analysis_id: str, repo_name: str, file_info: Dict[str, Any]
    ) -> str:
        node_id = f"file:{analysis_id}:{file_info['path']}"
        query = """
        MERGE (f:File {id: $id})
        SET f.analysis_id      = $analysis_id,
            f.repo_name        = $repo_name,
            f.path             = $path,
            f.rel_path         = $rel_path,
            f.functions_count  = $functions_count,
            f.classes_count    = $classes_count,
            f.imports_count    = $imports_count
        RETURN f.id AS id
        """
        self._client.run_write_query(
            query,
            {
                "id": node_id,
                "analysis_id": analysis_id,
                "repo_name": repo_name,
                "path": file_info.get("path", ""),
                "rel_path": file_info.get("rel_path", ""),
                "functions_count": file_info.get("functions_count", 0),
                "classes_count": file_info.get("classes_count", 0),
                "imports_count": file_info.get("imports_count", 0),
            },
        )
        return node_id

    def _merge_function(self, analysis_id: str, func: Dict[str, Any]) -> str:
        node_id = f"func:{analysis_id}:{func.get('file','')}:{func.get('name','')}"
        query = """
        MERGE (fn:Function {id: $id})
        SET fn.analysis_id = $analysis_id,
            fn.name        = $name,
            fn.file_path   = $file_path,
            fn.line_number = $line_number,
            fn.params      = $params,
            fn.decorators  = $decorators
        RETURN fn.id AS id
        """
        self._client.run_write_query(
            query,
            {
                "id": node_id,
                "analysis_id": analysis_id,
                "name": func.get("name", ""),
                "file_path": func.get("file", ""),
                "line_number": func.get("line", 0),
                "params": func.get("params", []),
                "decorators": func.get("decorators", []),
            },
        )
        return node_id

    def _merge_class(self, analysis_id: str, cls: Dict[str, Any]) -> str:
        node_id = f"class:{analysis_id}:{cls.get('file','')}:{cls.get('name','')}"
        query = """
        MERGE (c:Class {id: $id})
        SET c.analysis_id = $analysis_id,
            c.name        = $name,
            c.file_path   = $file_path,
            c.line_number = $line_number,
            c.bases       = $bases,
            c.methods     = $methods
        RETURN c.id AS id
        """
        self._client.run_write_query(
            query,
            {
                "id": node_id,
                "analysis_id": analysis_id,
                "name": cls.get("name", ""),
                "file_path": cls.get("file", ""),
                "line_number": cls.get("line", 0),
                "bases": cls.get("bases", []),
                "methods": cls.get("methods", []),
            },
        )
        return node_id

    def _merge_import(self, analysis_id: str, imp: Dict[str, Any]) -> str:
        module = imp.get("module", "")
        file_path = imp.get("file", "")
        node_id = f"import:{analysis_id}:{file_path}:{module}"
        query = """
        MERGE (i:Import {id: $id})
        SET i.analysis_id = $analysis_id,
            i.module      = $module,
            i.import_type = $import_type,
            i.names       = $names,
            i.file_path   = $file_path
        RETURN i.id AS id
        """
        self._client.run_write_query(
            query,
            {
                "id": node_id,
                "analysis_id": analysis_id,
                "module": module,
                "import_type": imp.get("type", "import"),
                "names": imp.get("names", []),
                "file_path": file_path,
            },
        )
        return node_id

    # ------------------------------------------------------------------
    # Private – relationship merges
    # ------------------------------------------------------------------

    def _merge_repo_file_rel(
        self, analysis_id: str, repo_node_id: str, file_node_id: str
    ) -> None:
        query = """
        MATCH (r:Repository {id: $repo_id, analysis_id: $analysis_id})
        MATCH (f:File       {id: $file_id, analysis_id: $analysis_id})
        MERGE (r)-[:REPOSITORY_CONTAINS_FILE]->(f)
        """
        self._client.run_write_query(
            query,
            {
                "repo_id": repo_node_id,
                "file_id": file_node_id,
                "analysis_id": analysis_id,
            },
        )

    def _merge_file_func_rel(
        self, analysis_id: str, file_node_id: str, func_node_id: str
    ) -> None:
        query = """
        MATCH (f:File     {id: $file_id, analysis_id: $analysis_id})
        MATCH (fn:Function{id: $func_id, analysis_id: $analysis_id})
        MERGE (f)-[:FILE_CONTAINS_FUNCTION]->(fn)
        """
        self._client.run_write_query(
            query,
            {
                "file_id": file_node_id,
                "func_id": func_node_id,
                "analysis_id": analysis_id,
            },
        )

    def _merge_file_class_rel(
        self, analysis_id: str, file_node_id: str, class_node_id: str
    ) -> None:
        query = """
        MATCH (f:File  {id: $file_id,  analysis_id: $analysis_id})
        MATCH (c:Class {id: $class_id, analysis_id: $analysis_id})
        MERGE (f)-[:FILE_CONTAINS_CLASS]->(c)
        """
        self._client.run_write_query(
            query,
            {
                "file_id": file_node_id,
                "class_id": class_node_id,
                "analysis_id": analysis_id,
            },
        )

    def _merge_file_import_rel(
        self, analysis_id: str, file_node_id: str, import_node_id: str
    ) -> None:
        query = """
        MATCH (f:File   {id: $file_id,   analysis_id: $analysis_id})
        MATCH (i:Import {id: $import_id, analysis_id: $analysis_id})
        MERGE (f)-[:FILE_IMPORTS_MODULE]->(i)
        """
        self._client.run_write_query(
            query,
            {
                "file_id": file_node_id,
                "import_id": import_node_id,
                "analysis_id": analysis_id,
            },
        )

    def _merge_inheritance(
        self,
        analysis_id: str,
        inh: Dict[str, Any],
        class_node_ids: Dict[str, str],
    ) -> None:
        child_name = inh.get("class", "")
        for base_name in inh.get("inherits_from", []):
            # Try to resolve both ends from the already-stored classes
            child_id = self._find_class_id(analysis_id, child_name, class_node_ids)
            base_id = self._find_class_id(analysis_id, base_name, class_node_ids)
            if child_id and base_id:
                query = """
                MATCH (child:Class {id: $child_id, analysis_id: $analysis_id})
                MATCH (base:Class  {id: $base_id,  analysis_id: $analysis_id})
                MERGE (child)-[:CLASS_INHERITS_CLASS]->(base)
                """
                self._client.run_write_query(
                    query,
                    {
                        "child_id": child_id,
                        "base_id": base_id,
                        "analysis_id": analysis_id,
                    },
                )

    def _merge_call_relationships(
        self,
        analysis_id: str,
        calls: List[Dict[str, Any]],
        func_node_ids: Dict[str, str],
    ) -> None:
        """
        Store FUNCTION_CALLS_FUNCTION edges where both caller and callee
        names can be matched to known function nodes for this analysis.
        """
        # Build a name → list-of-ids map (same name may exist in multiple files)
        name_to_ids: Dict[str, List[str]] = {}
        for key, node_id in func_node_ids.items():
            # key format: "func:<analysis_id>:<file>:<name>"
            parts = key.split(":")
            func_name = parts[-1] if parts else key
            name_to_ids.setdefault(func_name, []).append(node_id)

        for call in calls:
            callee_name = call.get("name", "")
            if not callee_name or callee_name not in name_to_ids:
                continue

            callee_ids = name_to_ids[callee_name]

            # For each function that calls this callee (heuristic: all funcs
            # in the same file as the call record)
            call_file = call.get("file", "")
            caller_ids = [
                nid
                for key, nid in func_node_ids.items()
                if call_file and call_file in key
            ]

            for caller_id in caller_ids:
                for callee_id in callee_ids:
                    if caller_id == callee_id:
                        continue
                    query = """
                    MATCH (caller:Function {id: $caller_id, analysis_id: $aid})
                    MATCH (callee:Function {id: $callee_id, analysis_id: $aid})
                    MERGE (caller)-[:FUNCTION_CALLS_FUNCTION]->(callee)
                    """
                    try:
                        self._client.run_write_query(
                            query,
                            {
                                "caller_id": caller_id,
                                "callee_id": callee_id,
                                "aid": analysis_id,
                            },
                        )
                    except Exception as exc:
                        logger.warning(
                            "Could not create call edge %s→%s: %s",
                            caller_id,
                            callee_id,
                            exc,
                        )

    # ------------------------------------------------------------------
    # Private – fetch helpers
    # ------------------------------------------------------------------

    def _fetch_nodes(self, analysis_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (n {analysis_id: $analysis_id})
        RETURN
            n.id          AS id,
            labels(n)[0]  AS type,
            CASE labels(n)[0]
                WHEN 'Repository' THEN n.name
                WHEN 'File'       THEN n.rel_path
                WHEN 'Function'   THEN n.name
                WHEN 'Class'      THEN n.name
                WHEN 'Import'     THEN n.module
                ELSE n.id
            END AS label,
            properties(n) AS metadata
        """
        raw = self._client.run_query(query, {"analysis_id": analysis_id})
        nodes = []
        for row in raw:
            node_type = (row.get("type") or "unknown").lower()
            metadata = dict(row.get("metadata") or {})
            # Remove redundant top-level fields already exposed on the node
            metadata.pop("id", None)
            nodes.append(
                {
                    "id": row.get("id", ""),
                    "type": node_type,
                    "label": row.get("label", ""),
                    "metadata": metadata,
                }
            )
        return nodes

    def _fetch_edges(self, analysis_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (a {analysis_id: $analysis_id})-[r]->(b {analysis_id: $analysis_id})
        RETURN
            a.id          AS source,
            b.id          AS target,
            type(r)       AS rel_type
        """
        raw = self._client.run_query(query, {"analysis_id": analysis_id})
        edges = []
        for row in raw:
            source = row.get("source", "")
            target = row.get("target", "")
            rel_type = row.get("rel_type", "")
            edge_id = f"{source}-{rel_type}-{target}"
            edges.append(
                {
                    "id": edge_id,
                    "source": source,
                    "target": target,
                    "type": rel_type,
                }
            )
        return edges

    # ------------------------------------------------------------------
    # Private – utilities
    # ------------------------------------------------------------------

    def _find_target_node(self, analysis_id: str, target: str) -> Optional[Dict[str, Any]]:
        """Search for a node matching target name/path up to 2 hops."""
        query = """
        MATCH (n {analysis_id: $analysis_id})
        WHERE n.name CONTAINS $target OR n.path CONTAINS $target OR n.module CONTAINS $target OR n.rel_path CONTAINS $target
        LIMIT 1
        RETURN
            n.id AS id,
            labels(n)[0] AS type,
            CASE labels(n)[0]
                WHEN 'File' THEN n.rel_path
                WHEN 'Function' THEN n.name
                WHEN 'Class' THEN n.name
                ELSE n.id
            END AS label,
            properties(n) AS metadata
        """
        results = self._client.run_query(query, {"analysis_id": analysis_id, "target": target})
        if not results:
            return None

        row = results[0]
        node_type = (row.get("type") or "unknown").lower()
        metadata = dict(row.get("metadata") or {})
        metadata.pop("id", None)
        return {
            "id": row.get("id", ""),
            "type": node_type,
            "label": row.get("label", ""),
            "metadata": metadata,
        }

    def _gather_related_nodes(self, analysis_id: str, target_id: str, incoming: bool = True) -> List[Dict[str, Any]]:
        """Gather up to 2-hop related nodes (upstream dependencies or downstream dependents)."""
        if incoming:
            # Upstream: nodes that the target depends on (incoming edges)
            query = """
            MATCH (target {id: $target_id, analysis_id: $analysis_id})
            MATCH (related {analysis_id: $analysis_id})<-[*1..2]-(target)
            RETURN DISTINCT
                related.id AS id,
                labels(related)[0] AS type,
                CASE labels(related)[0]
                    WHEN 'File' THEN related.rel_path
                    WHEN 'Function' THEN related.name
                    WHEN 'Class' THEN related.name
                    ELSE related.id
                END AS label,
                properties(related) AS metadata
            """
        else:
            # Downstream: nodes that depend on the target (outgoing edges)
            query = """
            MATCH (target {id: $target_id, analysis_id: $analysis_id})
            MATCH (related {analysis_id: $analysis_id})-[*1..2]->(target)
            RETURN DISTINCT
                related.id AS id,
                labels(related)[0] AS type,
                CASE labels(related)[0]
                    WHEN 'File' THEN related.rel_path
                    WHEN 'Function' THEN related.name
                    WHEN 'Class' THEN related.name
                    ELSE related.id
                END AS label,
                properties(related) AS metadata
            """
        
        raw = self._client.run_query(query, {"target_id": target_id, "analysis_id": analysis_id})
        nodes = []
        for row in raw:
            node_type = (row.get("type") or "unknown").lower()
            metadata = dict(row.get("metadata") or {})
            metadata.pop("id", None)
            nodes.append(
                {
                    "id": row.get("id", ""),
                    "type": node_type,
                    "label": row.get("label", ""),
                    "metadata": metadata,
                }
            )
        return nodes

    def _score_impact(
        self,
        analysis_id: str,
        target_id: str,
        upstream: List[Dict[str, Any]],
        downstream: List[Dict[str, Any]],
    ) -> int:
        """
        Calculate risk score (0-100) based on:
        - Node degree (how many connections)
        - Cross-file references (higher risk)
        - Inheritance chains (higher risk)
        - Function call density (higher complexity)
        """
        # Base score from dependency counts
        base_score = 20
        
        # Upstream dependencies score (higher = more risk if many deps)
        upstream_count = len(upstream)
        upstream_score = min(upstream_count * 4, 25)
        
        # Downstream dependents score (higher = more risk if many dependents)
        downstream_count = len(downstream)
        downstream_score = min(downstream_count * 5, 35)
        
        # Cross-file references boost
        cross_file_upstream = sum(1 for n in upstream if n.get("type") == "file")
        cross_file_downstream = sum(1 for n in downstream if n.get("type") == "file")
        cross_file_score = (cross_file_upstream + cross_file_downstream) * 2
        
        # Inheritance chain complexity boost
        inheritance_score = 0
        for node in upstream + downstream:
            metadata = node.get("metadata", {})
            if metadata.get("bases") or node.get("type") == "class":
                inheritance_score += 3
        inheritance_score = min(inheritance_score, 10)
        
        # Function call density
        function_calls_score = 0
        for node in upstream + downstream:
            if node.get("type") == "function":
                function_calls_score += 2
        function_calls_score = min(function_calls_score, 8)
        
        # Combine scores with diminishing returns
        total = base_score + upstream_score + downstream_score + cross_file_score + inheritance_score + function_calls_score
        return min(100, total)

    # ------------------------------------------------------------------
    # Semantic Search
    # ------------------------------------------------------------------

    def get_semantic_search(self, analysis_id: str, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Search functions, classes, files, and imports for a given query.

        Supports exact, prefix, and contains (case-insensitive) matching.
        Returns list of results: {type, name, filePath, lineNumber, score, reason}
        """
        q_lower = query.lower()
        results: List[Dict[str, Any]] = []

        # Functions (highest priority)
        fn_query = """
        MATCH (fn:Function {analysis_id: $analysis_id})
        WHERE toLower(fn.name) = $q_lower OR toLower(fn.name) STARTS WITH $q_lower OR toLower(fn.name) CONTAINS $q_lower
        RETURN fn.name AS name, fn.file_path AS filePath, fn.line_number AS lineNumber,
               CASE
                 WHEN toLower(fn.name) = $q_lower THEN 1.0
                 WHEN toLower(fn.name) STARTS WITH $q_lower THEN 0.9
                 ELSE 0.7
               END AS score
        LIMIT $limit
        """
        try:
            fn_rows = self._client.run_query(fn_query, {"analysis_id": analysis_id, "q_lower": q_lower, "limit": limit})
            for r in fn_rows:
                results.append({
                    "type": "function",
                    "name": r.get("name"),
                    "filePath": r.get("filePath") or r.get("file_path") or "",
                    "lineNumber": r.get("lineNumber"),
                    "score": float(r.get("score") or 0),
                    "reason": "Function name matched query",
                })
        except Exception:
            logger.debug("No function matches for semantic search")

        # Classes
        cls_query = """
        MATCH (c:Class {analysis_id: $analysis_id})
        WHERE toLower(c.name) = $q_lower OR toLower(c.name) STARTS WITH $q_lower OR toLower(c.name) CONTAINS $q_lower
        RETURN c.name AS name, c.file_path AS filePath, c.line_number AS lineNumber,
               CASE
                 WHEN toLower(c.name) = $q_lower THEN 1.0
                 WHEN toLower(c.name) STARTS WITH $q_lower THEN 0.9
                 ELSE 0.7
               END AS score
        LIMIT $limit
        """
        try:
            cls_rows = self._client.run_query(cls_query, {"analysis_id": analysis_id, "q_lower": q_lower, "limit": limit})
            for r in cls_rows:
                results.append({
                    "type": "class",
                    "name": r.get("name"),
                    "filePath": r.get("filePath") or "",
                    "lineNumber": r.get("lineNumber"),
                    "score": float(r.get("score") or 0) * 0.95,
                    "reason": "Class name matched query",
                })
        except Exception:
            logger.debug("No class matches for semantic search")

        # Files
        file_query = """
        MATCH (f:File {analysis_id: $analysis_id})
        WHERE toLower(f.rel_path) = $q_lower OR toLower(f.rel_path) STARTS WITH $q_lower OR toLower(f.rel_path) CONTAINS $q_lower OR toLower(f.path) CONTAINS $q_lower
        RETURN f.rel_path AS name, f.path AS filePath,
               CASE
                 WHEN toLower(f.rel_path) = $q_lower THEN 1.0
                 WHEN toLower(f.rel_path) STARTS WITH $q_lower THEN 0.85
                 ELSE 0.65
               END AS score
        LIMIT $limit
        """
        try:
            file_rows = self._client.run_query(file_query, {"analysis_id": analysis_id, "q_lower": q_lower, "limit": limit})
            for r in file_rows:
                results.append({
                    "type": "file",
                    "name": r.get("name"),
                    "filePath": r.get("filePath") or "",
                    "lineNumber": None,
                    "score": float(r.get("score") or 0) * 0.9,
                    "reason": "File path matched query",
                })
        except Exception:
            logger.debug("No file matches for semantic search")

        # Imports / modules
        import_query = """
        MATCH (im:Import {analysis_id: $analysis_id})
        WHERE toLower(im.module) = $q_lower OR toLower(im.module) STARTS WITH $q_lower OR toLower(im.module) CONTAINS $q_lower OR any(n IN im.names WHERE toLower(n) = $q_lower OR toLower(n) CONTAINS $q_lower)
        RETURN im.module AS name, im.file_path AS filePath,
               CASE
                 WHEN toLower(im.module) = $q_lower THEN 1.0
                 WHEN toLower(im.module) STARTS WITH $q_lower THEN 0.8
                 ELSE 0.6
               END AS score
        LIMIT $limit
        """
        try:
            imp_rows = self._client.run_query(import_query, {"analysis_id": analysis_id, "q_lower": q_lower, "limit": limit})
            for r in imp_rows:
                results.append({
                    "type": "import",
                    "name": r.get("name"),
                    "filePath": r.get("filePath") or "",
                    "lineNumber": None,
                    "score": float(r.get("score") or 0) * 0.8,
                    "reason": "Import/module matched query",
                })
        except Exception:
            logger.debug("No import matches for semantic search")

        # Rank results: prefer type priority (function > class > file > import) and score
        priority = {"function": 4, "class": 3, "file": 2, "import": 1}
        results_sorted = sorted(results, key=lambda r: (priority.get(r.get("type"), 0), r.get("score", 0)), reverse=True)

        # Normalize scores to 0..1 and cap
        for r in results_sorted:
            r["score"] = min(1.0, max(0.0, float(r.get("score", 0))))

        return results_sorted[:limit]

    def _build_explanation(
        self,
        target: Dict[str, Any],
        upstream: List[Dict[str, Any]],
        downstream: List[Dict[str, Any]],
        risk_score: int,
    ) -> str:
        """Generate a human-readable risk explanation."""
        target_label = target.get("label", "unknown")
        target_type = target.get("type", "node")

        level = "critical" if risk_score >= 80 else "high" if risk_score >= 60 else "medium" if risk_score >= 40 else "low"

        explanation = f"**{level.upper()} IMPACT** — Modifying {target_type} `{target_label}` affects {len(downstream)} downstream dependents.\n\n"

        if upstream:
            explanation += f"**{len(upstream)} upstream dependencies** provide essential services:\n"
            for node in upstream[:3]:
                explanation += f"- `{node['label']}` ({node['type']})\n"
            if len(upstream) > 3:
                explanation += f"- ... and {len(upstream) - 3} more\n"

        if downstream:
            explanation += f"\n**{len(downstream)} downstream consumers** rely on this:\n"
            for node in downstream[:3]:
                explanation += f"- `{node['label']}` ({node['type']})\n"
            if len(downstream) > 3:
                explanation += f"- ... and {len(downstream) - 3} more\n"

        if risk_score >= 70:
            explanation += f"\n**Recommendation**: Comprehensive testing required. Deploy behind feature flag."
        elif risk_score >= 50:
            explanation += f"\n**Recommendation**: Run full test suite before merge."

        return explanation

    @staticmethod
    def _func_key(func: Dict[str, Any]) -> str:
        return f"func:{{analysis_id}}:{func.get('file','')}:{func.get('name','')}"


    @staticmethod
    def _class_key(cls: Dict[str, Any]) -> str:
        return f"class:{{analysis_id}}:{cls.get('file','')}:{cls.get('name','')}"

    @staticmethod
    def _find_class_id(
        analysis_id: str, class_name: str, class_node_ids: Dict[str, str]
    ) -> Optional[str]:
        """Resolve a class name to its Neo4j node id."""
        for key, node_id in class_node_ids.items():
            if key.endswith(f":{class_name}"):
                return node_id
        return None
