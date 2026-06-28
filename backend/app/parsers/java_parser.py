"""Tree-sitter Java parser for extracting code structure."""

from typing import Dict, List, Optional, Any

try:
    import tree_sitter as ts
    from tree_sitter import Language
    import tree_sitter_java as tsj
except ImportError:
    raise ImportError(
        "tree-sitter-java is required. Install with: pip install tree-sitter tree-sitter-java"
    )


class JavaParser:
    """Parse Java files using tree-sitter."""

    def __init__(self):
        java_lang_capsule = tsj.language()
        self.language = Language(java_lang_capsule)
        self.parser = ts.Parser()
        self.parser.language = self.language

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                source_code = f.read()
        except Exception as e:
            return {"error": f"Failed to read {file_path}: {str(e)}", "file": file_path}

        try:
            tree = self.parser.parse(source_code.encode("utf-8"))
            root = tree.root_node
            return {
                "file": file_path,
                "functions": self._extract_methods(root, source_code),
                "classes": self._extract_classes(root, source_code),
                "imports": self._extract_imports(root, source_code),
                "inheritance": self._extract_inheritance(root, source_code),
                "calls": self._extract_calls(root, source_code),
            }
        except Exception as e:
            return {"error": f"Failed to parse {file_path}: {str(e)}", "file": file_path}

    # ------------------------------------------------------------------
    # Extraction helpers
    # ------------------------------------------------------------------

    def _text(self, node) -> str:
        return node.text.decode("utf-8") if node.text else ""

    def _extract_classes(self, root, source_code: str) -> List[Dict[str, Any]]:
        classes = []
        self._walk_for_types(root, {"class_declaration", "interface_declaration", "enum_declaration"}, classes, self._make_class)
        return classes

    def _make_class(self, node, source_code: str) -> Optional[Dict[str, Any]]:
        name = None
        methods = []
        for child in node.children:
            if child.type == "identifier":
                name = self._text(child)
            elif child.type == "class_body":
                methods = self._extract_method_names_from_body(child)
        if name:
            return {
                "name": name,
                "line": node.start_point[0] + 1,
                "bases": [],
                "methods": methods,
            }
        return None

    def _extract_method_names_from_body(self, body_node) -> List[str]:
        methods = []
        for child in body_node.children:
            if child.type == "method_declaration":
                for sub in child.children:
                    if sub.type == "identifier":
                        methods.append(self._text(sub))
                        break
            elif child.type == "constructor_declaration":
                for sub in child.children:
                    if sub.type == "identifier":
                        methods.append(self._text(sub))
                        break
        return methods

    def _extract_methods(self, root, source_code: str) -> List[Dict[str, Any]]:
        methods = []

        def traverse(node):
            if node.type in ("method_declaration", "constructor_declaration"):
                name = None
                params = []
                for child in node.children:
                    if child.type == "identifier":
                        name = self._text(child)
                    elif child.type == "formal_parameters":
                        params = self._extract_formal_params(child)
                if name:
                    methods.append({
                        "name": name,
                        "line": node.start_point[0] + 1,
                        "params": params,
                        "decorators": [],
                    })
            for child in node.children:
                traverse(child)

        traverse(root)
        return methods

    def _extract_formal_params(self, params_node) -> List[str]:
        params = []
        for child in params_node.children:
            if child.type == "formal_parameter":
                # last identifier is the param name
                idents = [c for c in child.children if c.type == "identifier"]
                if idents:
                    params.append(self._text(idents[-1]))
        return params

    def _extract_imports(self, root, source_code: str) -> List[Dict[str, Any]]:
        imports = []
        for child in root.children:
            if child.type == "import_declaration":
                text = self._text(child).strip()
                # "import com.example.Foo;" or "import static ..."
                module = text.removeprefix("import").removesuffix(";").strip()
                static = module.startswith("static")
                if static:
                    module = module.removeprefix("static").strip()
                parts = module.split(".")
                imports.append({
                    "type": "import",
                    "module": ".".join(parts[:-1]) if len(parts) > 1 else module,
                    "names": [parts[-1]] if parts else [],
                })
        return imports

    def _extract_inheritance(self, root, source_code: str) -> List[Dict[str, Any]]:
        inheritance = []

        def traverse(node):
            if node.type in ("class_declaration", "interface_declaration"):
                name = None
                bases = []
                for child in node.children:
                    if child.type == "identifier" and name is None:
                        name = self._text(child)
                    elif child.type == "superclass":
                        for sub in child.children:
                            if sub.type == "type_identifier":
                                bases.append(self._text(sub))
                    elif child.type == "super_interfaces":
                        for sub in child.children:
                            if sub.type in ("type_list", "interface_type_list"):
                                for t in sub.children:
                                    if t.type == "type_identifier":
                                        bases.append(self._text(t))
                if name and bases:
                    inheritance.append({"class": name, "inherits_from": bases})
            for child in node.children:
                traverse(child)

        traverse(root)
        return inheritance

    def _extract_calls(self, root, source_code: str) -> List[Dict[str, Any]]:
        calls = []
        seen: set = set()

        def traverse(node):
            if node.type == "method_invocation":
                # Find the method name (identifier after the dot, or standalone)
                idents = [c for c in node.children if c.type == "identifier"]
                if idents:
                    name = self._text(idents[-1])
                    if name not in seen:
                        calls.append({"name": name, "line": node.start_point[0] + 1})
                        seen.add(name)
            for child in node.children:
                traverse(child)

        traverse(root)
        return calls

    # ------------------------------------------------------------------
    # Generic walker
    # ------------------------------------------------------------------

    def _walk_for_types(self, node, target_types: set, results: list, maker):
        if node.type in target_types:
            item = maker(node, "")
            if item:
                results.append(item)
        for child in node.children:
            self._walk_for_types(child, target_types, results, maker)
