"""Tree-sitter Python parser for extracting code structure."""

from typing import Dict, List, Tuple, Optional, Any
import os

try:
    import tree_sitter as ts
    from tree_sitter import Language
    import tree_sitter_python as tsp
except ImportError:
    raise ImportError(
        "tree-sitter is required. Install with: pip install tree-sitter tree-sitter-python"
    )


class PythonParser:
    """Parse Python files using tree-sitter."""

    def __init__(self):
        """Initialize tree-sitter parser for Python."""
        try:
            # Get the Python language from tree-sitter-python
            py_lang_capsule = tsp.language()
            # Wrap it in tree-sitter's Language class
            self.language = Language(py_lang_capsule)
            # Create parser with the wrapped language
            self.parser = ts.Parser()
            self.parser.language = self.language
        except Exception as e:
            raise RuntimeError(
                f"Could not load tree-sitter-python. "
                f"Try reinstalling: pip install --force-reinstall tree-sitter-python. "
                f"Error: {str(e)}"
            )

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """
        Parse a single Python file and extract structure.

        Args:
            file_path: Full path to the .py file

        Returns:
            Dictionary with extracted code structure
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                source_code = f.read()
        except Exception as e:
            return {"error": f"Failed to read {file_path}: {str(e)}", "file": file_path}

        try:
            tree = self.parser.parse(source_code.encode("utf-8"))
            return {
                "file": file_path,
                "functions": self._extract_functions_simple(tree.root_node, source_code),
                "classes": self._extract_classes_simple(tree.root_node, source_code),
                "imports": self._extract_imports_simple(tree.root_node, source_code),
                "inheritance": self._extract_inheritance_simple(tree.root_node, source_code),
                "calls": self._extract_calls_simple(tree.root_node, source_code),
            }
        except Exception as e:
            return {"error": f"Failed to parse {file_path}: {str(e)}", "file": file_path}

    def _extract_functions_simple(
        self, node, source_code: str, parent_class: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Extract function definitions by traversing the AST."""
        functions = []
        
        for child in node.children:
            if child.type == "function_definition":
                func_data = {
                    "name": None,
                    "line": child.start_point[0] + 1,
                    "params": [],
                    "param_types": {},
                    "return_type": None,
                    "decorators": [],
                    "local_assignments": []
                }
                if parent_class:
                    func_data["classname"] = parent_class
                
                for subchild in child.children:
                    if subchild.type == "identifier":
                        func_data["name"] = subchild.text.decode("utf-8")
                    elif subchild.type == "parameters":
                        func_data["params"] = self._extract_params(subchild, source_code)
                        func_data["param_types"] = self._extract_param_types(subchild, source_code)
                    elif subchild.type == "type":
                        func_data["return_type"] = subchild.text.decode("utf-8").strip()
                        func_data["return_type_annotated"] = True
                    elif subchild.type == "decorator":
                        dec_text = subchild.text.decode("utf-8").strip()
                        func_data["decorators"].append(dec_text)
                    elif subchild.type == "block":
                        func_data["local_assignments"] = self._extract_local_assignments(subchild, source_code)
                        func_data["type_narrowings"] = self._extract_type_narrowings(subchild, source_code)
                        if not func_data.get("return_type"):
                            func_data["return_type"] = self._infer_return_type_from_block(subchild, func_data["local_assignments"])
                        functions.extend(
                            self._extract_functions_simple(subchild, source_code, parent_class)
                        )
                
                if func_data["name"]:
                    functions.append(func_data)
            elif child.type == "decorated_definition":
                decorators = []
                definition_child = None
                for subchild in child.children:
                    if subchild.type == "decorator":
                        decorators.append(subchild.text.decode("utf-8").strip())
                    elif subchild.type in ("function_definition", "class_definition"):
                        definition_child = subchild
                
                if definition_child:
                    if definition_child.type == "function_definition":
                        func_data = {
                            "name": None,
                            "line": definition_child.start_point[0] + 1,
                            "params": [],
                            "param_types": {},
                            "return_type": None,
                            "decorators": decorators,
                            "local_assignments": []
                        }
                        if parent_class:
                            func_data["classname"] = parent_class
                        for subsub in definition_child.children:
                            if subsub.type == "identifier":
                                func_data["name"] = subsub.text.decode("utf-8")
                            elif subsub.type == "parameters":
                                func_data["params"] = self._extract_params(subsub, source_code)
                                func_data["param_types"] = self._extract_param_types(subsub, source_code)
                            elif subsub.type == "type":
                                func_data["return_type"] = subsub.text.decode("utf-8").strip()
                                func_data["return_type_annotated"] = True
                            elif subsub.type == "block":
                                func_data["local_assignments"] = self._extract_local_assignments(subsub, source_code)
                                func_data["type_narrowings"] = self._extract_type_narrowings(subsub, source_code)
                                if not func_data.get("return_type"):
                                    func_data["return_type"] = self._infer_return_type_from_block(subsub, func_data["local_assignments"])
                                functions.extend(
                                    self._extract_functions_simple(subsub, source_code, parent_class)
                                )
                        if func_data["name"]:
                            functions.append(func_data)
                    elif definition_child.type == "class_definition":
                        class_name = None
                        for subsub in definition_child.children:
                            if subsub.type == "identifier":
                                class_name = subsub.text.decode("utf-8")
                                break
                        functions.extend(
                            self._extract_functions_simple(definition_child, source_code, class_name)
                        )
            elif child.type == "class_definition":
                class_name = None
                for subchild in child.children:
                    if subchild.type == "identifier":
                        class_name = subchild.text.decode("utf-8")
                        break
                functions.extend(
                    self._extract_functions_simple(child, source_code, class_name)
                )
            elif child.type == "block":
                functions.extend(
                    self._extract_functions_simple(child, source_code, parent_class)
                )
        
        return functions

    def _extract_classes_simple(self, node, source_code: str) -> List[Dict[str, Any]]:
        """Extract class definitions by traversing the AST."""
        classes = []
        
        for child in node.children:
            if child.type == "class_definition":
                class_data = {
                    "name": None,
                    "line": child.start_point[0] + 1,
                    "bases": [],
                    "methods": [],
                }
                
                for subchild in child.children:
                    if subchild.type == "identifier":
                        class_data["name"] = subchild.text.decode("utf-8")
                    elif subchild.type == "argument_list":
                        class_data["bases"] = self._extract_bases(subchild, source_code)
                    elif subchild.type == "block":
                        class_data["methods"] = self._extract_methods_in_block(
                            subchild, source_code
                        )
                
                if class_data["name"]:
                    classes.append(class_data)
            elif child.type == "decorated_definition":
                definition_child = None
                for subchild in child.children:
                    if subchild.type == "class_definition":
                        definition_child = subchild
                        break
                if definition_child:
                    class_data = {
                        "name": None,
                        "line": definition_child.start_point[0] + 1,
                        "bases": [],
                        "methods": [],
                    }
                    for subchild in definition_child.children:
                        if subchild.type == "identifier":
                            class_data["name"] = subchild.text.decode("utf-8")
                        elif subchild.type == "argument_list":
                            class_data["bases"] = self._extract_bases(subchild, source_code)
                        elif subchild.type == "block":
                            class_data["methods"] = self._extract_methods_in_block(
                                subchild, source_code
                            )
                    if class_data["name"]:
                        classes.append(class_data)
            elif child.type == "block":
                classes.extend(self._extract_classes_simple(child, source_code))
        
        return classes

    def _extract_imports_simple(self, node, source_code: str) -> List[Dict[str, str]]:
        """Extract import statements by traversing the AST."""
        imports = []
        
        for child in node.children:
            if child.type == "import_statement":
                import_data = {"type": "import", "module": None, "names": []}
                child_text = child.text.decode("utf-8")
                
                # Parse "import X" or "import X as Y" statements
                if "import" in child_text:
                    parts = child_text.split("import")[1].strip().split(",")
                    for part in parts:
                        part = part.strip()
                        if " as " in part:
                            module, alias = part.split(" as ")
                            import_data["module"] = module.strip()
                            import_data["names"].append(alias.strip())
                        else:
                            import_data["module"] = part
                
                if import_data["module"]:
                    imports.append(import_data)
            
            elif child.type == "import_from_statement":
                import_data = {"type": "from", "module": None, "names": []}
                child_text = child.text.decode("utf-8")
                
                # Parse "from X import Y" statements
                if "from" in child_text and "import" in child_text:
                    from_part, import_part = child_text.split("import", 1)
                    module = from_part.replace("from", "").strip()
                    import_data["module"] = module
                    
                    # Extract imported names
                    names = import_part.strip("() \n\t")
                    if names != "*":
                        for name in names.split(","):
                            name = name.strip()
                            if " as " in name:
                                orig, alias = name.split(" as ")
                                import_data["names"].append(alias.strip())
                            else:
                                import_data["names"].append(name)
                
                if import_data["module"]:
                    imports.append(import_data)
            
            elif child.type == "block":
                imports.extend(self._extract_imports_simple(child, source_code))
        
        return imports

    def _extract_inheritance_simple(self, node, source_code: str) -> List[Dict[str, Any]]:
        """Extract class inheritance relationships by traversing the AST."""
        inheritance = []
        
        for child in node.children:
            if child.type == "class_definition":
                class_name = None
                bases = []
                
                for subchild in child.children:
                    if subchild.type == "identifier":
                        class_name = subchild.text.decode("utf-8")
                    elif subchild.type == "argument_list":
                        bases = self._extract_bases(subchild, source_code)
                
                if class_name and bases:
                    inheritance.append({"class": class_name, "inherits_from": bases})
            
            elif child.type == "block":
                inheritance.extend(self._extract_inheritance_simple(child, source_code))
        
        return inheritance

    def _extract_calls_simple(self, node, source_code: str) -> List[Dict[str, Any]]:
        """Extract function/method calls (both identifiers and attributes)."""
        calls = []
        seen = set()
        
        def traverse_for_calls(n):
            if n.type == "call" and len(n.children) > 0:
                callable_node = n.children[0]
                if callable_node.type == "identifier":
                    call_name = callable_node.text.decode("utf-8")
                    key = (call_name, callable_node.start_point[0] + 1)
                    if key not in seen and not call_name[0].isupper():
                        calls.append(
                            {
                                "name": call_name,
                                "line": callable_node.start_point[0] + 1,
                                "type": "identifier",
                                "expression": call_name,
                            }
                        )
                        seen.add(key)
                elif callable_node.type == "attribute" and len(callable_node.children) >= 3:
                    obj_node = callable_node.children[0]
                    attr_node = callable_node.children[-1]
                    call_name = attr_node.text.decode("utf-8")
                    obj_name = obj_node.text.decode("utf-8")
                    expr = callable_node.text.decode("utf-8")
                    key = (expr, attr_node.start_point[0] + 1)
                    if key not in seen:
                        calls.append(
                            {
                                "name": call_name,
                                "receiver": obj_name,
                                "line": attr_node.start_point[0] + 1,
                                "type": "attribute",
                                "expression": expr,
                            }
                        )
                        seen.add(key)
            
            for child in n.children:
                traverse_for_calls(child)
        
        traverse_for_calls(node)
        return calls

    def _extract_methods_in_block(self, block_node, source_code: str) -> List[str]:
        """Extract method names from a class block."""
        methods = []
        for child in block_node.children:
            func_node = None
            if child.type == "function_definition":
                func_node = child
            elif child.type == "decorated_definition":
                for sub in child.children:
                    if sub.type == "function_definition":
                        func_node = sub
                        break
            if func_node:
                for grandchild in func_node.children:
                    if grandchild.type == "identifier":
                        methods.append(grandchild.text.decode("utf-8"))
                        break
        return methods

    def _extract_params(self, params_node, source_code: str) -> List[str]:
        """Extract function parameter names."""
        params = []
        try:
            for child in params_node.children:
                if child.type == "identifier":
                    params.append(child.text.decode("utf-8"))
                elif child.type == "typed_parameter":
                    for grandchild in child.children:
                        if grandchild.type == "identifier":
                            params.append(grandchild.text.decode("utf-8"))
                            break
        except Exception:
            pass
        return params

    def _extract_param_types(self, params_node, source_code: str) -> Dict[str, str]:
        """Extract function parameter type annotations."""
        types = {}
        try:
            for child in params_node.children:
                if child.type == "typed_parameter":
                    name = None
                    type_name = None
                    for sub in child.children:
                        if sub.type == "identifier":
                            name = sub.text.decode("utf-8")
                        elif sub.type == "type":
                            type_name = sub.text.decode("utf-8").strip()
                    if name and type_name:
                        types[name] = type_name
        except Exception:
            pass
        return types

    def _extract_local_assignments(self, block_node, source_code: str) -> List[Dict[str, str]]:
        """Extract local variables assigned in block."""
        assignments = []
        try:
            def traverse(n):
                if n.type == "assignment":
                    if len(n.children) >= 3:
                        lhs = n.children[0]
                        rhs = n.children[-1]
                        if lhs.type == "identifier":
                            lhs_name = lhs.text.decode("utf-8")
                            var_type = "unknown"
                            source = "variable_assignment"
                            # Look for type annotation child (e.g. users: list[User])
                            for child in n.children:
                                if child.type == "type":
                                    var_type = child.text.decode("utf-8").strip()
                                    source = "local_annotation"
                                    break
                            if source != "local_annotation" and rhs.type == "call" and len(rhs.children) > 0:
                                callable_node = rhs.children[0]
                                if callable_node.type == "identifier":
                                    var_type = callable_node.text.decode("utf-8")
                                    source = "constructor_call"
                                elif callable_node.type == "attribute":
                                    var_type = callable_node.text.decode("utf-8")
                                    source = "factory_method_call"
                            assignments.append({
                                "name": lhs_name,
                                "type": var_type,
                                "source": source
                            })
                        elif lhs.type == "attribute" and len(lhs.children) >= 3:
                            obj_node = lhs.children[0]
                            attr_node = lhs.children[-1]
                            if obj_node.text.decode("utf-8") == "self":
                                attr_name = attr_node.text.decode("utf-8")
                                var_type = "unknown"
                                source = "instance_attribute_assignment"
                                if rhs.type == "call" and len(rhs.children) > 0:
                                    callable_node = rhs.children[0]
                                    if callable_node.type == "identifier":
                                        var_type = callable_node.text.decode("utf-8")
                                        source = "constructor_call"
                                assignments.append({
                                    "name": f"self.{attr_name}",
                                    "type": var_type,
                                    "source": source
                                })
                elif n.type == "for_statement":
                    lhs = None
                    rhs = None
                    in_idx = -1
                    for idx, child in enumerate(n.children):
                        if child.text.decode("utf-8") == "in":
                            in_idx = idx
                            break
                    if in_idx != -1:
                        for child in n.children[:in_idx]:
                            if child.type == "identifier":
                                lhs = child.text.decode("utf-8")
                                break
                        for child in n.children[in_idx+1:]:
                            if child.type in ("identifier", "attribute", "call"):
                                rhs = child.text.decode("utf-8")
                                break
                    if lhs and rhs:
                        assignments.append({
                            "name": lhs,
                            "type": rhs,
                            "source": "for_loop_iterator"
                        })
                for child in n.children:
                    if child.type not in ("function_definition", "class_definition"):
                        traverse(child)
            traverse(block_node)
        except Exception:
            pass
        return assignments

    def _extract_bases(self, bases_node, source_code: str) -> List[str]:
        """Extract base class names from argument list."""
        bases = []
        try:
            for child in bases_node.children:
                if child.type == "identifier":
                    bases.append(child.text.decode("utf-8"))
                elif child.type == "attribute":
                    bases.append(child.text.decode("utf-8"))
        except Exception:
            pass
        return bases

    def _extract_methods(self, block_node, source_code: str) -> List[str]:
        """Extract method names from a class block."""
        methods = []
        try:
            for child in block_node.children:
                func_node = None
                if child.type == "function_definition":
                    func_node = child
                elif child.type == "decorated_definition":
                    for sub in child.children:
                        if sub.type == "function_definition":
                            func_node = sub
                            break
                if func_node:
                    for grandchild in func_node.children:
                        if grandchild.type == "identifier":
                            methods.append(grandchild.text.decode("utf-8"))
                            break
        except Exception:
            pass
        return methods

    def _infer_return_type_from_block(self, block_node, local_assignments: List[Dict[str, str]]) -> Optional[str]:
        """Infer return type from direct constructor returns inside block."""
        return_types = set()
        has_generic_return = False
        try:
            def traverse(n):
                nonlocal has_generic_return
                if n.type == "return_statement":
                    if len(n.children) > 1:
                        ret_expr = n.children[1]
                        if ret_expr.type == "call" and len(ret_expr.children) > 0:
                            callable_node = ret_expr.children[0]
                            if callable_node.type == "identifier":
                                return_types.add(callable_node.text.decode("utf-8"))
                            else:
                                has_generic_return = True
                        elif ret_expr.type == "identifier":
                            var_name = ret_expr.text.decode("utf-8")
                            var_type = None
                            for la in local_assignments:
                                if la.get("name") == var_name:
                                    var_type = la.get("type")
                                    break
                            if var_type and var_type != "unknown":
                                return_types.add(var_type)
                            else:
                                has_generic_return = True
                        else:
                            has_generic_return = True
                    else:
                        has_generic_return = True
                for child in n.children:
                    if child.type not in ("function_definition", "class_definition"):
                        traverse(child)
            traverse(block_node)
        except Exception:
            pass
        if not has_generic_return and len(return_types) == 1:
            return list(return_types)[0]
        return None

    def _extract_type_narrowings(self, block_node, source_code: str) -> List[Dict[str, Any]]:
        narrowings = []
        try:
            def traverse(n):
                if n.type == "if_statement":
                    consequence_node = None
                    for child in n.children:
                        if child.type == "block":
                            consequence_node = child
                            break
                    if consequence_node:
                        start_line = consequence_node.start_point[0] + 1
                        end_line = consequence_node.end_point[0] + 1
                        isinstance_calls = []
                        for child in n.children:
                            if child == consequence_node:
                                break
                            def find_isinstance(sub_n):
                                if sub_n.type == "call" and len(sub_n.children) > 0:
                                    func_name_node = sub_n.children[0]
                                    if func_name_node.type == "identifier" and func_name_node.text.decode("utf-8") == "isinstance":
                                        isinstance_calls.append(sub_n)
                                for c in sub_n.children:
                                    find_isinstance(c)
                            find_isinstance(child)
                        for call_node in isinstance_calls:
                            arg_list = next((c for c in call_node.children if c.type == "argument_list"), None)
                            if arg_list and len(arg_list.children) >= 3:
                                args = [c for c in arg_list.children if c.type in ("identifier", "type")]
                                if len(args) == 2:
                                    var_name = args[0].text.decode("utf-8")
                                    class_name = args[1].text.decode("utf-8")
                                    narrowings.append({
                                        "name": var_name,
                                        "type": class_name,
                                        "start_line": start_line,
                                        "end_line": end_line,
                                        "source": "isinstance_narrowing"
                                    })
                elif n.type == "with_statement":
                    consequence_node = next((c for c in n.children if c.type == "block"), None)
                    if consequence_node:
                        start_line = consequence_node.start_point[0] + 1
                        end_line = consequence_node.end_point[0] + 1
                        with_items = []
                        def find_with_items(sub_n):
                            if sub_n.type == "with_item":
                                with_items.append(sub_n)
                            for c in sub_n.children:
                                find_with_items(c)
                        find_with_items(n)
                        for item in with_items:
                            as_pat = next((c for c in item.children if c.type == "as_pattern"), None)
                            if as_pat:
                                target_node = next((c for c in as_pat.children if c.type == "as_pattern_target"), None)
                                var_id = None
                                if target_node:
                                    var_id = next((c for c in target_node.children if c.type == "identifier"), None)
                                else:
                                    var_id = next((c for c in as_pat.children if c.type == "identifier"), None)
                                
                                if var_id:
                                    var_name = var_id.text.decode("utf-8")
                                    val_node = as_pat.children[0]
                                    class_name = "unknown"
                                    if val_node.type == "call" and len(val_node.children) > 0:
                                        func_node = val_node.children[0]
                                        if func_node.type == "identifier":
                                            class_name = func_node.text.decode("utf-8")
                                    narrowings.append({
                                        "name": var_name,
                                        "type": class_name,
                                        "start_line": start_line,
                                        "end_line": end_line,
                                        "source": "with_statement_binding"
                                    })
                for child in n.children:
                    if child.type not in ("function_definition", "class_definition"):
                        traverse(child)
            traverse(block_node)
        except Exception:
            pass
        return narrowings
