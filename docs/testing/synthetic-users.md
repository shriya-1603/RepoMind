# Synthetic User Testing Scenarios

## Junior Engineer
- **Role**: Junior Developer joining the team.
- **Task**: 
  1. Import pallets/flask repository.
  2. Open the AI Developer Onboarding page.
  3. Read through the dynamic architecture onboarding path to understand the codebase.
- **Expected Result**: 
  - Onboarding steps load successfully from Neo4j `/repository-summary-real` backend API.
  - No default React/Vite/mock templates are displayed.
- **Pass/Fail Criteria**:
  - **PASS**: Onboarding path matches Flask repository file structure, showing real module summaries and file paths, or shows "Not enough repository intelligence available" if graph is missing. No mock templates (octocat/hello-world, rateLimit.ts) are present.
  - **FAIL**: Displays mock Vite/React onboarding steps or references to octocat/hello-world.

---

## Senior Engineer
- **Role**: Senior Developer preparing a major refactoring of a module.
- **Task**:
  1. Search for core functions/classes using Semantic Search.
  2. Perform Impact Analysis on a critical module to check downstream dependencies.
  3. Run Change Simulation on the module to estimate blast radius.
- **Expected Result**:
  - Semantic search returns exact match hits from the Flask codebase.
  - Impact Analysis visualizes real upstream/downstream connections in React Flow.
  - Change Simulation computes Risk Score and blast radius directly from Neo4j backend.
- **Pass/Fail Criteria**:
  - **PASS**: Search, Impact, and Simulation display only real Neo4j-backed data with exact count matching.
  - **FAIL**: Any page returns stale demo metrics or defaults silently to mock file structures.

---

## Tech Lead
- **Role**: Architect assessing the safety and design quality of a repository.
- **Task**:
  1. Review the dynamic Architecture Summary on the AI Onboarding page.
  2. Inspect the hotspot files and coupled risk areas.
- **Expected Result**:
  - Real repository intelligence displays module breakdowns, coupling percentages, and circular dependency risks from `/repository-summary-real/{analysisId}`.
- **Pass/Fail Criteria**:
  - **PASS**: Metrics and modules match the backend summary API exactly.
  - **FAIL**: Shows mock warning indicators or mock coupling files.

---

## Interview Candidate
- **Role**: Technical candidate performing a codebase walkthrough in a timed interview.
- **Task**:
  1. Understand an unfamiliar repository structure under 10 minutes.
  2. Use AI Onboarding and Semantic Search to locate entrypoints.
- **Expected Result**:
  - Real onboarding steps and quick semantic responses are sufficient to identify entrypoint modules.
- **Pass/Fail Criteria**:
  - **PASS**: AI guides are successfully derived from the active analysis state, allowing quick traversal of files.
  - **FAIL**: Stale cache or different repository profiles render, confusing the candidate.
