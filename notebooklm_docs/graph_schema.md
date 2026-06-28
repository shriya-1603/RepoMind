# Neo4j Graph Database Schema & Dependency Analysis

This document details the database architecture of RepoMind. It outlines the Neo4j node schemas, edge relationships, and the logic behind our Impact Analysis engine.

---

## 🗄 Neo4j Graph Database Schema

RepoMind maps files and programming symbols into a graph database to expose structural relationships.

```
                  [:FILE_CONTAINS_CLASS]
      ┌──────────────────────────────────────────┐
      │                                          ▼
   ( :File ) ──[:FILE_CONTAINS_FUNCTION]──> ( :Function )
      │                                          │
      │ [:FILE_IMPORTS_MODULE]                   │ [:FUNCTION_CALLS]
      ▼                                          ▼
   ( :Import )                             ( :Function )
```

---

## 🏷 Node Definitions

### 1. `File`
Represents a source code file (e.g., `.ts`, `.tsx`, `.py`, `.js`).
* **Properties**:
  * `id`: Absolute path or unique composite key.
  * `name`: File basename (e.g., `api.ts`).
  * `rel_path`: Relative path from the repository root.
  * `analysis_id`: Unique run identifier linking nodes to their source repository.
  * `loc`: Lines of code (optional, metric-dependent).

### 2. `Class`
Represents an object-oriented class declaration.
* **Properties**:
  * `id`: Composite identifier.
  * `name`: Name of the class (e.g., `ParserService`).
  * `analysis_id`: Run identifier.

### 3. `Function`
Represents a function or method declaration.
* **Properties**:
  * `id`: Composite identifier.
  * `name`: Function name (e.g., `extract_git_metadata`).
  * `analysis_id`: Run identifier.

### 4. `Import`
Represents an external library or file import statement.
* **Properties**:
  * `id`: Unique import key.
  * `name`: Package or path target.
  * `analysis_id`: Run identifier.

---

## 🔗 Relationship Definitions

* **`FILE_IMPORTS_MODULE`**: Connects a `File` to an `Import` node.
* **`FILE_CONTAINS_CLASS`**: Connects a `File` to a `Class` declared within it.
* **`FILE_CONTAINS_FUNCTION`**: Connects a `File` to a global/independent `Function` declared within it.
* **`CLASS_CONTAINS_FUNCTION`**: Connects a `Class` to its internal methods.
* **`FUNCTION_CALLS`**: Connects a `Function` to another `Function` it invokes, forming call graphs.
* **`CLASS_INHERITS`**: Connects a subclass to its base parent class.

---

## ⚡ Impact Analysis Risk Calculation Engine

When a developer changes a function, class, or file, the impact analysis engine simulates potential bugs propagating through downstream dependencies.

### 1. Dependency Tracing (2-Hop Search)
Using Cypher query searches, the engine queries Neo4j for:
* **Upstream Dependencies**: Nodes that the target depends on (direct imports, parent classes, called functions).
* **Downstream Dependencies**: Nodes that depend on the target (functions that call the target, files that import it).

### 2. Risk Score Engine
The engine computes a **Risk Score** ($R$) from 0 to 100 based on the following metrics:
1. **Downstream Count ($D_d$)**: The number of symbols affected downstream. High numbers indicate a bottleneck symbol.
2. **Coupling Score ($C_s$)**: Total connections (imports + exports) of the file.
3. **Degree Centrality ($D_c$)**: How central the file is to the rest of the app.

The risk score is calculated as:
$$R = \min\left(100, (D_d \times 12) + (C_s \times 8) + (\text{is\_core} \times 20)\right)$$

### 3. Impact Level Categorization
* **Low Risk** ($R < 30$): The change is isolated.
* **Medium Risk** ($30 \le R < 70$): Affects adjacent modules. Requires unit testing.
* **High Risk** ($R \ge 70$): Affects core systems. Code review is highly recommended.
