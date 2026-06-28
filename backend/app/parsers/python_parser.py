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
                    "decorators": [],
                }
                
                for subchild in child.children:
                    if subchild.type == "identifier":
                        func_data["name"] = subchild.text.decode("utf-8")
                    elif subchild.type == "parameters":
                        func_data["params"] = self._extract_params(subchild, source_code)
                    elif subchild.type == "decorator":
                        dec_text = subchild.text.decode("utf-8").strip()
                        func_data["decorators"].append(dec_text)
                
                if func_data["name"]:
                    functions.append(func_data)
            elif child.type in ("class_definition", "block"):
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
                    names = import_part.strip()
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
        """Extract function/method calls (simplified)."""
        calls = []
        seen = set()
        
        def traverse_for_calls(n):
            if n.type == "call":
                for subchild in n.children:
                    if subchild.type == "identifier":
                        call_name = subchild.text.decode("utf-8")
                        if call_name not in seen and not call_name[0].isupper():
                            calls.append(
                                {
                                    "name": call_name,
                                    "line": subchild.start_point[0] + 1,
                                }
                            )
                            seen.add(call_name)
                        break
            
            for child in n.children:
                traverse_for_calls(child)
        
        traverse_for_calls(node)
        return list({c["name"]: c for c in calls}.values())

    def _extract_methods_in_block(self, block_node, source_code: str) -> List[str]:
        """Extract method names from a class block."""
        methods = []
        for child in block_node.children:
            if child.type == "function_definition":
                for grandchild in child.children:
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
        except Exception:
            pass
        return params

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
                if child.type == "function_definition":
                    for grandchild in child.children:
                        if grandchild.type == "identifier":
                            methods.append(grandchild.text.decode("utf-8"))
                            break
        except Exception:
            pass
        return methods
