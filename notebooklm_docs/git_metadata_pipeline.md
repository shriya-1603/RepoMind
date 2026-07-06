RepoMind Pipeline Engine & Dependency Specifications
This document outlines the pipeline engine execution, topological sort dependency resolver, cycle detection logic, and GraphRepository protocol interfaces.
--------------------------------------------------------------------------------
⚙️ Topological Sort Algorithm (pipeline.py)
Dynamic execution resolution uses a recursive DFS three-state resolver:
- State 0 (Unvisited): Start state for all generators.
- State 1 (Visiting): Generator is currently in the traversal stack. If encountered again, cycle is detected.
- State 2 (Visited): Generator and dependencies resolved. Safe to execute.

Dynamic sorting execution flow steps:
1. Initialize states to 0 for all keys.
2. Select next generator from list.
3. Call visit(generator).
   - If State is 2: Return.
   - If State is 1: Raise PipelineDependencyError (Circular Loop Detected!).
   - If State is 0: Set state to 1, push key to path stack, visit all required dependencies recursively.
4. Pop key from path stack, set state to 2, and append generator to order sequence.
--------------------------------------------------------------------------------
📄 Core Pipeline Contract (pipeline.py snippet)
```python
class RepositoryIntelligencePipeline:
    def __init__(self):
        self.client = LLMClient()
        self.generators = [
            DomainGenerator, TechnologyGenerator, PurposeGenerator,
            ExecutionFlowGenerator, ReadingGuideGenerator, LayersGenerator,
            CriticalFilesGenerator, ComplexityGenerator, HealthGenerator,
            ObservationsGenerator, ArchitectureGenerator
        ]
        self.pipeline = self._resolve_order(self.generators)

    def _resolve_order(self, generators: List[type]) -> List[type]:
        key_to_cls = {cls.output_key: cls for cls in generators if cls.output_key}
        states = {cls.output_key: 0 for cls in generators if cls.output_key}
        order, path = [], []

        def visit(cls):
            key = cls.output_key
            if states.get(key) == 2:
                return
            if states.get(key) == 1:
                cycle = " -> ".join(path[path.index(key):]) + " -> " + key
                raise PipelineDependencyError(f"Circular dependency: {cycle}")
            
            states[key] = 1
            path.append(key)
            for req in getattr(cls, "requires", []):
                if req in key_to_cls:
                    visit(key_to_cls[req])
            path.pop()
            states[key] = 2
            order.append(cls)

        for cls in generators:
            if cls.output_key:
                visit(cls)
        return order
```
--------------------------------------------------------------------------------
🔌 GraphRepository Protocol Interface (graph_repository.py)
Declares database access contracts, decoupling SQL/Cypher database queries from facts compilation:
```python
class GraphRepositoryProtocol(Protocol):
    def get_all_imports(self, analysis_id: str) -> List[Dict[str, Any]]: ...
    def get_all_files(self, analysis_id: str) -> List[Dict[str, Any]]: ...
    def get_all_functions(self, analysis_id: str) -> List[Dict[str, Any]]: ...
    def get_readme(self, analysis_id: str) -> str: ...
    def get_call_chain_for_file(self, analysis_id: str, rel_path: str) -> List[str]: ...
```
--------------------------------------------------------------------------------
⏱ Latency Profiling & Observability
Each step is wrapped in precision timers:
`start_time = time.perf_counter()`
`context[gen.output_key] = gen.generate(facts, context)`
Outputs duration metrics (e.g. `DomainGenerator: 22ms`) to logs.
