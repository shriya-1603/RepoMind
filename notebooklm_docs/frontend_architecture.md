RepoMind Frontend Architecture & UI Specifications
This document provides a detailed breakdown of the React-based frontend dashboard for RepoMind, detailing layout components, visual styles, and API integrations.
--------------------------------------------------------------------------------
🏗 Directory Structure
src/
├── components/
│   ├── StartHere.tsx          # Onboarding reading guide file sequence
│   ├── ExecutionFlow.tsx      # Runtime timeline step cards
│   ├── RepositoryLayers.tsx   # Clustered directory widgets
│   ├── Observations.tsx       # Bottlenecks and circular loops warning alerts
│   ├── CodeHealth.tsx         # Health dial and deductions breakdown list
│   └── Integrations.tsx       # Tech frameworks grid
├── pages/
│   └── Dashboard.tsx          # Primary dashboard page coordinating widgets
├── services/
│   └── api.ts                 # Axios API request clients
└── index.css                  # Vanilla CSS styling tokens
--------------------------------------------------------------------------------
🎨 Visual Aesthetics & Layout
Uses rich, premium styling:
- Outfit and Inter font typography.
- Smooth gradients and animations for step hovers.
- Glassmorphism design system for overlay dialogs.
- Interactive dials rendering code health scores.
--------------------------------------------------------------------------------
🌐 API Mapping & Hook Integrations
- Enters page via route `/repository-summary-real/:analysisId`.
- Component reads analysisId parameter and fires Axios call: `GET http://localhost:8000/repository-summary-real/{analysisId}`.
- Maps JSON fields to local component states:
  - `repositoryIntelligence.projectPurpose` -> binds description to Overview section.
  - `repositoryIntelligence.executionFlow` -> binds steps to Flow timeline.
  - `repositoryIntelligence.startHere` -> binds file items to Onboarding panel.
  - `repositoryIntelligence.repositoryLayers` -> binds layers to Directory list.
  - `repositoryIntelligence.healthScore` & `healthBreakdown` -> renders health dials.
--------------------------------------------------------------------------------
🔄 User View Sequence
1. Dashboard mounts.
2. Triggers API fetch query.
3. Renders loaders.
4. Payload loaded successfully: maps overview cards, starts onboarding guides, lists circular loop warnings, and displays folder architecture layers.
