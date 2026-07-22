"""Graph service – stores parsed Python repository data in Neo4j."""

import logging
import uuid
import os
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

        class_func_rels = []
        for func in funcs_list:
            file_id = file_node_ids.get(func.get("file", ""))
            func_id = func_node_ids.get(self._func_key(func))
            if file_id and func_id:
                file_func_rels.append({"source": file_id, "target": func_id, "type": "FILE_CONTAINS_FUNCTION"})
            
            class_name = func.get("classname")
            if class_name:
                class_id = self._find_class_id(analysis_id, class_name, class_node_ids)
                if class_id and func_id:
                    class_func_rels.append({"source": class_id, "target": func_id, "type": "CLASS_CONTAINS_FUNCTION"})

        for cls in classes_list:
            file_id = file_node_ids.get(cls.get("file", ""))
            class_id = class_node_ids.get(self._class_key(cls))
            if file_id and class_id:
                file_class_rels.append({"source": file_id, "target": class_id, "type": "FILE_CONTAINS_CLASS"})

        # Resolve imports to files and build FILE_IMPORTS_FILE
        file_imports_file_rels = []
        module_to_file_id = {}
        for file_info in files_list:
            path = file_info["path"]
            rel_path = file_info["rel_path"]
            file_id = file_node_ids.get(path)
            if not file_id:
                continue
            parts = rel_path.replace(".py", "").replace("\\", "/").split("/")
            if len(parts) > 1 and parts[-1] == "__init__":
                mod_name = ".".join(parts[:-1])
                module_to_file_id[mod_name] = file_id
                short_name = parts[-2]
                module_to_file_id[short_name] = file_id
            else:
                mod_name = ".".join(parts)
                module_to_file_id[mod_name] = file_id
                short_name = parts[-1]
                module_to_file_id[short_name] = file_id

        for imp in imports_list:
            file_id = file_node_ids.get(imp.get("file", ""))
            if not file_id:
                continue
            module = imp.get("module", "")
            if not module:
                continue
            
            target_file_id = module_to_file_id.get(module)
            # relative import resolution
            if not target_file_id and module.startswith("."):
                curr_file = imp.get("file", "")
                curr_rel = next((f["rel_path"] for f in files_list if f["path"] == curr_file), "")
                if curr_rel:
                    curr_dir = os.path.dirname(curr_rel).replace("\\", "/")
                    dots_count = len(module) - len(module.lstrip('.'))
                    module_name = module.lstrip('.')
                    dir_parts = curr_dir.split('/') if curr_dir else []
                    if dots_count > 1 and len(dir_parts) >= (dots_count - 1):
                        dir_parts = dir_parts[:-(dots_count - 1)]
                    if module_name:
                        dir_parts.append(module_name)
                    resolved_rel = ".".join(dir_parts)
                    target_file_id = module_to_file_id.get(resolved_rel)
            
            if target_file_id and file_id != target_file_id:
                file_imports_file_rels.append({
                    "source": file_id,
                    "target": target_file_id,
                    "type": "FILE_IMPORTS_FILE",
                    "import_type": imp.get("type", "import"),
                    "module": module,
                    "resolved": "true",
                    "resolution_method": "local_file"
                })

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

        # Build symbol table for files
        symbol_tables = {}
        for file_info in files_list:
            path = file_info["path"]
            symbol_tables[path] = {}
            
        # Add local functions and classes to symbol tables
        for func in funcs_list:
            fpath = func.get("file", "")
            if fpath in symbol_tables:
                func_id = func_node_ids.get(self._func_key(func))
                if func_id:
                    symbol_tables[fpath][func.get("name", "")] = func_id
                    
        for cls in classes_list:
            cpath = cls.get("file", "")
            if cpath in symbol_tables:
                class_id = class_node_ids.get(self._class_key(cls))
                if class_id:
                    symbol_tables[cpath][cls.get("name", "")] = class_id

        # Resolve imported symbols in symbol tables (iterate 3 times to handle package re-exports)
        for _ in range(3):
            for imp in imports_list:
                file_path = imp.get("file", "")
                if file_path not in symbol_tables:
                    continue
                
                module = imp.get("module", "")
                target_file_id = module_to_file_id.get(module)
                if not target_file_id and module.startswith("."):
                    curr_rel = next((f["rel_path"] for f in files_list if f["path"] == file_path), "")
                    if curr_rel:
                        curr_dir = os.path.dirname(curr_rel).replace("\\", "/")
                        dots_count = len(module) - len(module.lstrip('.'))
                        module_name = module.lstrip('.')
                        dir_parts = curr_dir.split('/') if curr_dir else []
                        if dots_count > 1 and len(dir_parts) >= (dots_count - 1):
                            dir_parts = dir_parts[:-(dots_count - 1)]
                        if module_name:
                            dir_parts.append(module_name)
                        resolved_rel = ".".join(dir_parts)
                        target_file_id = module_to_file_id.get(resolved_rel)
                
                if target_file_id:
                    target_path = next((f["path"] for f in files_list if file_node_ids.get(f["path"]) == target_file_id), None)
                    if target_path and target_path in symbol_tables:
                        names = imp.get("names", [])
                        if not names:
                            # For module-level imports, bind the module name itself
                            symbol_tables[file_path][module] = target_file_id
                        else:
                            for name in names:
                                if name in symbol_tables[target_path]:
                                    symbol_tables[file_path][name] = symbol_tables[target_path][name]
                                else:
                                    # Map module name/alias to target_file_id
                                    symbol_tables[file_path][name] = target_file_id

        # Build and resolve Calls
        BUILTINS = {"print", "len", "range", "str", "int", "dict", "list", "set", "tuple", "open", "dir", "type", "sum", "min", "max", "abs"}
        
        # Save processed diagnostics classification back to parsed_output for run_benchmark.py
        parsed_output["resolved_calls_diagnostics"] = []

        # Build class-level instance attribute type map
        class_instance_types = {}  # class_name -> {attr_name: set(types)}
        for func in funcs_list:
            cls_name = func.get("classname")
            if not cls_name:
                continue
            if cls_name not in class_instance_types:
                class_instance_types[cls_name] = {}
            for la in func.get("local_assignments", []):
                name = la.get("name", "")
                if name.startswith("self."):
                    attr_name = name[5:]  # strip "self."
                    var_type = la.get("type", "unknown")
                    if var_type != "unknown":
                        if attr_name not in class_instance_types[cls_name]:
                            class_instance_types[cls_name][attr_name] = set()
                        class_instance_types[cls_name][attr_name].add(var_type)

        def get_class_attr_type(cls_name: str, attr_name: str) -> Optional[str]:
            if cls_name in class_instance_types and attr_name in class_instance_types[cls_name]:
                types = class_instance_types[cls_name][attr_name]
                if len(types) == 1:
                    return list(types)[0]
                else:
                    return None
            bases = []
            for inh in parsed_output.get("inheritance", []):
                if inh.get("class") == cls_name:
                    bases = inh.get("inherits_from", [])
                    break
            for base in bases:
                t = get_class_attr_type(base, attr_name)
                if t:
                    return t
            return None
        def get_collection_item_type(type_str: str) -> Optional[str]:
            if not type_str:
                return None
            if "[" in type_str and type_str.endswith("]"):
                start = type_str.find("[")
                inner = type_str[start+1:-1].strip()
                if "|" in inner or "," in inner or "Union" in inner:
                    return None
                if inner in ("Any", "object", ""):
                    return None
                return inner
            return None
        for call in parsed_output.get("calls", []):
            callee_name = call.get("name", "")
            call_file = call.get("file", "")
            call_type = call.get("type", "identifier")
            receiver = call.get("receiver")
            
            # Find the caller's node ID (should be a function or file containing this call)
            caller_ids = [
                nid
                for key, nid in func_node_ids.items()
                if call_file and call_file in key
            ]
            if not caller_ids:
                # Fallback to file ID
                caller_ids = [file_node_ids[call_file]] if call_file in file_node_ids else []

            # 1. Classify Builtins
            if callee_name in BUILTINS and call_type == "identifier":
                parsed_output["resolved_calls_diagnostics"].append({
                    "name": callee_name, "source_file": call_file, "classification": "BUILTIN", "resolved": False
                })
                continue
                
            # 2. Try to resolve call
            resolved_target_id = None
            resolution_method = "unresolved"
            confidence = "NONE"
            classification = "UNRESOLVED"
            
            # Evidence provenance fields
            ev_var = None
            ev_type = None
            ev_assign = None
            ev_lookup = None

            if call_type == "identifier":
                # Shadowing Precedence: check if identifier is shadowed locally in function
                is_shadowed = False
                caller_func = None
                closest_start = -1
                for f in funcs_list:
                    if f.get("file") == call_file:
                        f_line = f.get("line", 0)
                        if f_line <= call.get("line", 0) and f_line > closest_start:
                            closest_start = f_line
                            caller_func = f
                if caller_func:
                    local_vars = [la["name"] for la in caller_func.get("local_assignments", [])] + caller_func.get("params", [])
                    if callee_name in local_vars:
                        is_shadowed = True

                if is_shadowed:
                    resolved_target_id = None
                    classification = "UNRESOLVED"
                    confidence = "NONE"
                    resolution_method = "unresolved"
                elif call_file in symbol_tables and callee_name in symbol_tables[call_file]:
                    resolved_target_id = symbol_tables[call_file][callee_name]
                    if resolved_target_id.startswith("func:") or resolved_target_id.startswith("class:"):
                        classification = "USER_DEFINED"
                        resolution_method = "direct_import" if "import:" in resolved_target_id else "local_scope"
                        confidence = "HIGH"
                    else:
                        classification = "IMPORTED_SYMBOL"
                        resolution_method = "module_resolution"
                        confidence = "HIGH"
                    ev_lookup = callee_name
            elif call_type == "attribute" and receiver:
                # 1. OOP super() method resolution
                if receiver in ("super", "super()"):
                    caller_func = None
                    closest_start = -1
                    for f in funcs_list:
                        if f.get("file") == call_file:
                            f_line = f.get("line", 0)
                            if f_line <= call.get("line", 0) and f_line > closest_start:
                                closest_start = f_line
                                caller_func = f
                    if caller_func and caller_func.get("classname"):
                        cls_name = caller_func.get("classname")
                        bases = []
                        for inh in parsed_output.get("inheritance", []):
                            if inh.get("class") == cls_name:
                                bases = inh.get("inherits_from", [])
                                break
                        for base in bases:
                            base_path = None
                            for c in classes_list:
                                if c["name"] == base:
                                    base_path = c.get("file")
                                    break
                            if base_path and base_path in symbol_tables:
                                if callee_name in symbol_tables[base_path]:
                                    resolved_target_id = symbol_tables[base_path][callee_name]
                                    classification = "USER_DEFINED"
                                    resolution_method = "inheritance_resolution"
                                    confidence = "HIGH"
                                    
                                    ev_var = receiver
                                    ev_type = base
                                    ev_assign = f"{receiver}"
                                    ev_lookup = f"{base}.{callee_name}"
                                    break

                # 2. Local variable/parameter/instance-attribute static type-inference
                if not resolved_target_id:
                    caller_func = None
                    closest_start = -1
                    for f in funcs_list:
                        if f.get("file") == call_file:
                            f_line = f.get("line", 0)
                            if f_line <= call.get("line", 0) and f_line > closest_start:
                                closest_start = f_line
                                caller_func = f

                    inferred_type = None
                    provenance = None
                    assignment_expr = None
                    
                    if caller_func:
                        # Case A: Chained attribute lookup (e.g. self.service.client)
                        if "." in receiver:
                            parts = receiver.split(".")
                            current_type = None
                            
                            # Initialize start of chain
                            if parts[0] == "self" and caller_func.get("classname"):
                                current_type = caller_func.get("classname")
                            else:
                                param_types = caller_func.get("param_types", {})
                                if parts[0] in param_types:
                                    current_type = param_types[parts[0]]
                                else:
                                    for la in caller_func.get("local_assignments", []):
                                        if la.get("name") == parts[0]:
                                            current_type = la.get("type")
                                            break
                                            
                            # Step through attributes
                            for part in parts[1:]:
                                if current_type:
                                    current_type = get_class_attr_type(current_type, part)
                                else:
                                    break
                                    
                            if current_type:
                                inferred_type = current_type
                                provenance = "chained_attributes"
                                
                        # Case B: Standard local/instance variable lookup
                        else:
                            # Try control-flow-aware type narrowing first
                            call_line = call.get("line", 0)
                            active_narrowing = None
                            for tn in caller_func.get("type_narrowings", []):
                                if tn.get("name") == receiver and tn.get("start_line", 0) <= call_line <= tn.get("end_line", 0):
                                    active_narrowing = tn
                                    break
                            
                            if active_narrowing:
                                if active_narrowing.get("source") == "isinstance_narrowing":
                                    inferred_type = active_narrowing.get("type")
                                    provenance = "isinstance_narrowing"
                                    assignment_expr = f"isinstance({receiver}, {inferred_type})"
                                elif active_narrowing.get("source") == "with_statement_binding":
                                    class_name = active_narrowing.get("type")
                                    if class_name and class_name != "unknown":
                                        class_id = symbol_tables[call_file].get(class_name) if call_file in symbol_tables else None
                                        cls_path = None
                                        if class_id and class_id.startswith("class:"):
                                            for c in classes_list:
                                                if class_node_ids.get(self._class_key(c)) == class_id:
                                                    cls_path = c.get("file")
                                                    break
                                        has_enter = False
                                        enter_return_type = None
                                        if cls_path:
                                            for f in funcs_list:
                                                if f.get("file") == cls_path and f.get("classname") == class_name and f.get("name") == "__enter__":
                                                    has_enter = True
                                                    if f.get("return_type_annotated"):
                                                        enter_return_type = f.get("return_type")
                                                    break
                                        if has_enter:
                                            if enter_return_type:
                                                inferred_type = enter_return_type
                                                provenance = "with_statement_binding"
                                                assignment_expr = f"with {class_name}() as {receiver}"
                                            else:
                                                inferred_type = None
                                                provenance = None
                                        else:
                                            inferred_type = class_name
                                            provenance = "with_statement_binding"
                                            assignment_expr = f"with {class_name}() as {receiver}"
                                    else:
                                        inferred_type = None
                                        provenance = None
                            
                            if not inferred_type:
                                param_types = caller_func.get("param_types", {})
                                if receiver in param_types:
                                    inferred_type = param_types[receiver]
                                    provenance = "typed_parameter"
                                else:
                                    for la in caller_func.get("local_assignments", []):
                                        if la.get("name") == receiver:
                                            inferred_type = la.get("type")
                                            provenance = la.get("source", "constructor_call")
                                            if provenance == "constructor_call":
                                                assignment_expr = f"{receiver} = {inferred_type}()"
                                            break
                                
                                # Case B.2: For loop iterator type resolution (PHASE 8)
                                if provenance == "for_loop_iterator":
                                    collection_name = inferred_type  # e.g. "users"
                                    collection_type = None
                                    if collection_name in param_types:
                                        collection_type = param_types[collection_name]
                                    else:
                                        for la in caller_func.get("local_assignments", []):
                                            if la.get("name") == collection_name:
                                                collection_type = la.get("type")
                                                break
                                    item_type = get_collection_item_type(collection_type)
                                    if item_type:
                                        inferred_type = item_type
                                        provenance = "collection_element_type"
                                        assignment_expr = f"for {receiver} in {collection_name}"
                                    else:
                                        inferred_type = None
                                        provenance = None
                                # If not found locally, look up in self attributes (if in method)
                                if not inferred_type and caller_func.get("classname"):
                                    cls_name = caller_func.get("classname")
                                    t = get_class_attr_type(cls_name, receiver)
                                    if t:
                                        inferred_type = t
                                        provenance = "instance_attribute_type"
                                        assignment_expr = f"self.{receiver} = {t}()"

                    # Case C: Return type call-site propagation
                    if inferred_type and call_file in symbol_tables:
                        if "." not in inferred_type:
                            symbol_id = symbol_tables[call_file].get(inferred_type)
                            if symbol_id and symbol_id.startswith("func:"):
                                target_func = None
                                for f in funcs_list:
                                    if func_node_ids.get(self._func_key(f)) == symbol_id:
                                        target_func = f
                                        break
                                if target_func and target_func.get("return_type"):
                                    inferred_type = target_func.get("return_type")
                                    provenance = "annotated_return_type"
                                    assignment_expr = f"{receiver} = {target_func.get('name')}()"
                        else:
                            parts = inferred_type.split(".")
                            if len(parts) == 2:
                                class_name, method_name = parts
                                symbol_id = symbol_tables[call_file].get(class_name)
                                if symbol_id and symbol_id.startswith("class:"):
                                    target_func = None
                                    for f in funcs_list:
                                        if f.get("classname") == class_name and f.get("name") == method_name:
                                            target_func = f
                                            break
                                    if target_func and target_func.get("return_type"):
                                        inferred_type = target_func.get("return_type")
                                        provenance = "factory_return_type"
                                        assignment_expr = f"{receiver} = {class_name}.{method_name}()"
                                    else:
                                        inferred_type = None
                                        provenance = None

                    if inferred_type and call_file in symbol_tables and inferred_type in symbol_tables[call_file]:
                        rec_id = symbol_tables[call_file][inferred_type]
                        rec_path = None
                        for c in classes_list:
                            if class_node_ids.get(self._class_key(c)) == rec_id:
                                rec_path = c.get("file")
                                break
                        
                        if rec_path and rec_path in symbol_tables:
                            class_def = next((c for c in classes_list if c["name"] == inferred_type and c.get("file") == rec_path), None)
                            if class_def:
                                found_method_id = None
                                if callee_name in class_def.get("methods", []):
                                    for f in funcs_list:
                                        if f.get("file") == rec_path and f.get("name") == callee_name and f.get("classname") == inferred_type:
                                            found_method_id = func_node_ids.get(self._func_key(f))
                                            break
                                
                                if not found_method_id:
                                    # Inheritance chain MRO search
                                    bases = []
                                    for inh in parsed_output.get("inheritance", []):
                                        if inh.get("class") == inferred_type:
                                            bases = inh.get("inherits_from", [])
                                            break
                                    for base in bases:
                                        base_path = None
                                        for c in classes_list:
                                            if c["name"] == base:
                                                base_path = c.get("file")
                                                break
                                        if base_path and base_path in symbol_tables:
                                            base_class_def = next((c for c in classes_list if c["name"] == base and c.get("file") == base_path), None)
                                            if base_class_def and callee_name in base_class_def.get("methods", []):
                                                for f in funcs_list:
                                                    if f.get("file") == base_path and f.get("name") == callee_name and f.get("classname") == base:
                                                        found_method_id = func_node_ids.get(self._func_key(f))
                                                        break
                                                if found_method_id:
                                                    break
                                
                                if found_method_id:
                                    resolved_target_id = found_method_id
                                    classification = "USER_DEFINED"
                                    resolution_method = f"type_inference_{provenance}" if not provenance.startswith("type_inference_") else provenance
                                    confidence = "HIGH"
                                    
                                    ev_var = receiver
                                    ev_type = inferred_type
                                    if assignment_expr:
                                        ev_assign = assignment_expr
                                    ev_lookup = f"{inferred_type}.{callee_name}"

                # Class or Module attribute call resolution
                if not resolved_target_id and call_file in symbol_tables and receiver in symbol_tables[call_file]:
                    rec_id = symbol_tables[call_file][receiver]
                    # Case 1: Class static/class method call (e.g. ClientFactory.create())
                    if rec_id.startswith("class:"):
                        rec_path = None
                        for c in classes_list:
                            key = self._class_key(c)
                            node_id = class_node_ids.get(key)
                            if node_id == rec_id:
                                rec_path = c.get("file")
                                break
                        if rec_path and rec_path in symbol_tables:
                            class_def = next((c for c in classes_list if c["name"] == receiver and c.get("file") == rec_path), None)
                            if class_def and callee_name in class_def.get("methods", []):
                                for f in funcs_list:
                                    if f.get("file") == rec_path and f.get("name") == callee_name and f.get("classname") == receiver:
                                        resolved_target_id = func_node_ids.get(self._func_key(f))
                                        classification = "USER_DEFINED"
                                        resolution_method = "class_method_call"
                                        confidence = "HIGH"
                                        
                                        ev_var = receiver
                                        ev_type = receiver
                                        ev_assign = f"{receiver}.{callee_name}()"
                                        ev_lookup = f"{receiver}.{callee_name}"
                                        break
                    # Case 2: Module-level function call (e.g. math_utils.quad())
                    else:
                        rec_path = next((f["path"] for f in files_list if file_node_ids.get(f["path"]) == rec_id), None)
                        if rec_path and rec_path in symbol_tables:
                            if callee_name in symbol_tables[rec_path]:
                                resolved_target_id = symbol_tables[rec_path][callee_name]
                                classification = "USER_DEFINED"
                                resolution_method = "module_resolution"
                                confidence = "HIGH"
                                
                                ev_var = receiver
                                ev_lookup = f"{receiver}.{callee_name}"
                
                if not resolved_target_id:
                    classification = "UNRESOLVED_MEMBER_CALL"
                    resolution_method = "unresolved"
                    confidence = "NONE"

            # Log resolution
            if resolved_target_id:
                parts = resolved_target_id.split(":")
                target_file_path = parts[2] if len(parts) >= 3 else ""
                target_rel = os.path.relpath(target_file_path, repo_name).replace("\\", "/") if target_file_path else ""

                if resolved_target_id.startswith("func:") or resolved_target_id.startswith("class:"):
                    for caller_id in caller_ids:
                        if caller_id != resolved_target_id:
                            edge_properties = {
                                "source": caller_id,
                                "target": resolved_target_id,
                                "type": "FUNCTION_CALLS_FUNCTION",
                                "confidence": confidence,
                                "resolution_method": resolution_method
                            }
                            if ev_var:
                                edge_properties["evidence_variable"] = ev_var
                            if ev_type:
                                edge_properties["evidence_type"] = ev_type
                            if ev_assign:
                                edge_properties["evidence_assignment"] = ev_assign
                            if ev_lookup:
                                edge_properties["evidence_lookup"] = ev_lookup
                            call_rels.append(edge_properties)
                
                diag_item = {
                    "name": callee_name,
                    "source_file": call_file,
                    "resolved": True,
                    "classification": classification,
                    "target_id": resolved_target_id,
                    "target_file": target_rel,
                    "resolution_method": resolution_method
                }
                if ev_var:
                    diag_item["evidence_variable"] = ev_var
                if ev_type:
                    diag_item["evidence_type"] = ev_type
                if ev_assign:
                    diag_item["evidence_assignment"] = ev_assign
                if ev_lookup:
                    diag_item["evidence_lookup"] = ev_lookup
                parsed_output["resolved_calls_diagnostics"].append(diag_item)
            else:
                parsed_output["resolved_calls_diagnostics"].append({
                    "name": callee_name,
                    "source_file": call_file,
                    "resolved": False,
                    "classification": classification,
                    "resolution_method": "unresolved"
                })

        # Diagnostics & Deduplication
        all_rels = (
            repo_file_rels +
            file_func_rels +
            file_class_rels +
            file_import_rels +
            inheritance_rels +
            call_rels +
            class_func_rels +
            file_imports_file_rels
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
        class_func_rels_dedup = []
        file_imports_file_rels_dedup = []

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
            elif rtype == "CLASS_CONTAINS_FUNCTION":
                class_func_rels_dedup.append(r)
            elif rtype == "FILE_IMPORTS_FILE":
                file_imports_file_rels_dedup.append(r)

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
        self._batch_merge_relationships(analysis_id, "Class", "Function", "CLASS_CONTAINS_FUNCTION", class_func_rels_dedup)
        self._batch_merge_relationships(analysis_id, "File", "File", "FILE_IMPORTS_FILE", file_imports_file_rels_dedup)

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
        readme_content = parsed_output.get("readme_content", "") or ""
        manifest_files = list((parsed_output.get("manifest_content") or {}).keys())
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
            r.totalAnalysisTimeMs = $total_analysis_time,
            r.readme_content = $readme_content,
            r.manifest_files = $manifest_files
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
                "readme_content": readme_content[:8000],
                "manifest_files": manifest_files,
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
            type(r)       AS rel_type,
            properties(r) AS properties
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
                    "properties": row.get("properties", {}),
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
