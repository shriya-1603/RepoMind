RepoMind Graph Database Schema & Caching Specifications
This document outlines the graph database properties, relationship mappings, and facts caching layer configurations.
--------------------------------------------------------------------------------
📊 Graph Node Schema Properties
1. File Node (:File)
- name: File basename (e.g. app.py)
- path: Absolute filesystem path
- rel_path: Relative workspace path
- functions_count: Total functions count in AST
- classes_count: Total classes count in AST
- imports_count: Total imports count in AST
2. Function Node (:Function)
- name: Declared name of function
- file_path: Path to containing file
- decorators: Applied decorator strings list
- params: Parameters list
3. Class Node (:Class)
- name: Declared name of class
- file_path: Path to containing file
4. Import Node (:Import)
- module: Target imported module string
- import_type: Type classification (standard, external, workspace)
- file_path: Path to importing file
--------------------------------------------------------------------------------
🔗 Relationship Types & Edge Mappings
- (:File)-[:FILE_IMPORTS_MODULE]->(:Module)
  Maps package imports. Used by TechnologyGenerator.
- (:File)-[:FILE_CONTAINS_FUNCTION]->(:Function)
  Maps functions inside files. Used by ExecutionFlowGenerator.
- (:Function)-[:FUNCTION_CALLS_FUNCTION]->(:Function)
  Maps function invocations. Used by ReadingGuideGenerator for call-chains.
- (:Class)-[:INHERITS_FROM]->(:Class)
  Maps class inheritance hierarchies. Used by HealthGenerator.
--------------------------------------------------------------------------------
💾 Facts Caching Specifications
To minimize database query latency, compiled facts are saved to local disk:
- Storage path: <workspace_root>/.gemini/antigravity-ide/brain/facts_cache/<analysis_id>.json
- Cache check proxy: CachedFactsProvider checks cache file. On miss, Rebuilds via FactsBuilder and saves cache. On hit, reads file directly.
- Cache contents: stats counts, files, imports, functions, readme, communities, graph_metrics, call_chains.
