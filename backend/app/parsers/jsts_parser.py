"""Tree-sitter JavaScript/TypeScript parser for extracting code structure.

Handles .js, .jsx, .ts, .tsx files using the appropriate tree-sitter grammar.
"""

from typing import Dict, List, Optional, Any

try:
    import tree_sitter as ts
    from tree_sitter import Language
    import tree_sitter_javascript as tsjs
    import tree_sitter_typescript as tst
except ImportError:
    raise ImportError(
        "tree-sitter-javascript and tree-sitter-typescript are required. "
        "Install with: pip install tree-sitter tree-sitter-javascript tree-sitter-typescript"
    )

# JS grammar node type → is class-like
_CLASS_TYPES = {
    "class_declaration",
    "class",
    "abstract_class_declaration",
    "interface_declaration",   # TS
}

# Function-like node types
_FUNCTION_TYPES = {
    "function_declaration",
    "function",
    "arrow_function",
    "method_definition",
    "function_signature",        # TS interface method
    "abstract_method_signature", # TS
}

# Import node types
_IMPORT_TYPES = {
    "import_statement",
    "import_declaration",  # TS uses this too
}


class JSTSParser:
    """Parse JS/TS files using tree-sitter."""

    def __init__(self, language: str = "typescript"):
        """
        Args:
            language: one of 'javascript', 'typescript', 'tsx'
        """
        if language == "javascript":
            lang_capsule = tsjs.language()
        elif language == "tsx":
            lang_capsule = tst.language_tsx()
        else:
            lang_capsule = tst.language_typescript()

        self.language_name = language
        lang = Language(lang_capsule)
        self._parser = ts.Parser()
        self._parser.language = lang

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                source_code = f.read()
        except Exception as e:
            return {"error": f"Failed to read {file_path}: {str(e)}", "file": file_path}

        try:
            tree = self._parser.parse(source_code.encode("utf-8"))
            root = tree.root_node
            return {
                "file": file_path,
                "functions": self._extract_functions(root, source_code),
                "classes": self._extract_classes(root, source_code),
                "imports": self._extract_imports(root, source_code),
                "inheritance": self._extract_inheritance(root, source_code),
                "calls": self._extract_calls(root, source_code),
            }
        except Exception as e:
            return {"error": f"Failed to parse {file_path}: {str(e)}", "file": file_path}

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _text(node) -> str:
        return node.text.decode("utf-8") if node.text else ""

    def _extract_functions(self, root, source_code: str) -> List[Dict[str, Any]]:
        functions = []
        seen: set = set()

        def traverse(node, depth: int = 0):
            if node.type in _FUNCTION_TYPES:
                name = self._get_function_name(node)
                if name and name not in seen:
                    seen.add(name)
                    functions.append({
                        "name": name,
                        "line": node.start_point[0] + 1,
                        "params": self._get_params(node),
                        "decorators": [],
                    })
            for child in node.children:
                traverse(child, depth + 1)

        traverse(root)
        return functions

    def _get_function_name(self, node) -> Optional[str]:
        """Extract the name of a function/method node."""
        # function_declaration → look for identifier child
        # method_definition → first identifier child
        # arrow_function assigned to variable: handled via parent in lexical_declaration
        for child in node.children:
            if child.type == "identifier":
                return self._text(child)
            if child.type == "property_identifier":
                return self._text(child)
        # For arrow functions inside variable declarations the name is on the parent
        if node.type == "arrow_function" and node.parent:
            p = node.parent
            if p.type in ("variable_declarator",):
                for c in p.children:
                    if c.type == "identifier":
                        return self._text(c)
        return None

    def _get_params(self, node) -> List[str]:
        params = []
        for child in node.children:
            if child.type in ("formal_parameters", "parameters"):
                for sub in child.children:
                    if sub.type in ("identifier", "required_parameter", "optional_parameter"):
                        ident = sub if sub.type == "identifier" else next(
                            (c for c in sub.children if c.type == "identifier"), None
                        )
                        if ident:
                            params.append(self._text(ident))
        return params

    def _extract_classes(self, root, source_code: str) -> List[Dict[str, Any]]:
        classes = []

        def traverse(node):
            if node.type in _CLASS_TYPES:
                name = None
                methods = []
                for child in node.children:
                    if child.type == "identifier" and name is None:
                        name = self._text(child)
                    elif child.type == "type_identifier" and name is None:
                        name = self._text(child)
                    elif child.type == "class_body":
                        methods = self._extract_method_names(child)
                if name:
                    classes.append({
                        "name": name,
                        "line": node.start_point[0] + 1,
                        "bases": [],
                        "methods": methods,
                    })
            for child in node.children:
                traverse(child)

        traverse(root)
        return classes

    def _extract_method_names(self, body_node) -> List[str]:
        names = []
        for child in body_node.children:
            if child.type == "method_definition":
                for sub in child.children:
                    if sub.type in ("property_identifier", "identifier"):
                        names.append(self._text(sub))
                        break
        return names

    def _extract_imports(self, root, source_code: str) -> List[Dict[str, Any]]:
        imports = []

        def traverse(node):
            if node.type == "import_statement":
                module = ""
                names = []
                for child in node.children:
                    if child.type == "string":
                        # strip quotes
                        module = self._text(child).strip("\"'`")
                    elif child.type in ("import_clause", "named_imports", "namespace_import"):
                        names = self._extract_import_names(child)
                    elif child.type == "identifier":
                        names.append(self._text(child))
                if module:
                    imports.append({
                        "type": "import",
                        "module": module,
                        "names": names,
                    })
            for child in node.children:
                traverse(child)

        traverse(root)
        return imports

    def _extract_import_names(self, node) -> List[str]:
        names = []
        for child in node.children:
            if child.type == "identifier":
                names.append(self._text(child))
            elif child.type == "named_imports":
                names.extend(self._extract_import_names(child))
            elif child.type == "import_specifier":
                for sub in child.children:
                    if sub.type in ("identifier", "property_identifier"):
                        names.append(self._text(sub))
                        break
            elif child.type == "namespace_import":
                for sub in child.children:
                    if sub.type == "identifier":
                        names.append(self._text(sub))
        return names

    def _extract_inheritance(self, root, source_code: str) -> List[Dict[str, Any]]:
        inheritance = []

        def traverse(node):
            if node.type in _CLASS_TYPES:
                name = None
                bases = []
                for child in node.children:
                    if child.type in ("identifier", "type_identifier") and name is None:
                        name = self._text(child)
                    elif child.type == "class_heritage":
                        # "extends Foo" / "implements Bar"
                        for sub in child.children:
                            if sub.type in ("identifier", "type_identifier"):
                                bases.append(self._text(sub))
                            elif sub.type == "extends_clause":
                                for s2 in sub.children:
                                    if s2.type in ("identifier", "type_identifier"):
                                        bases.append(self._text(s2))
                            elif sub.type == "implements_clause":
                                for s2 in sub.children:
                                    if s2.type in ("identifier", "type_identifier"):
                                        bases.append(self._text(s2))
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
            if node.type == "call_expression":
                fn_node = node.children[0] if node.children else None
                if fn_node:
                    name = None
                    if fn_node.type == "identifier":
                        name = self._text(fn_node)
                    elif fn_node.type == "member_expression":
                        # last identifier after dot
                        for sub in fn_node.children:
                            if sub.type in ("identifier", "property_identifier"):
                                name = self._text(sub)
                    if name and name not in seen and not name[0].isupper():
                        calls.append({"name": name, "line": node.start_point[0] + 1})
                        seen.add(name)
            for child in node.children:
                traverse(child)

        traverse(root)
        return calls
