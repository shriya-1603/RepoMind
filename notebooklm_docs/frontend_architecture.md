# RepoMind Frontend Architecture & Components

This document outlines the React + TypeScript + Vite frontend configuration, state management, and key pages powering RepoMind's premium user experience.

---

## 🎨 User Experience & Design Language
RepoMind implements a modern, dark-themed, glassmorphic design system:
* **Typography**: Utilizes premium typography scale with Inter and Outfit.
* **Palette**: tailors HSL gradients (sleek dark mode base, vivid purple/violet accents for links, emerald for metrics, amber for warnings).
* **Micro-interactions**: Powered by `framer-motion` for hardware-accelerated transitions, sliding side sheets, and modal panels.

---

## 🏗 Directory Structure

```
src/
├── components/
│   ├── Layout.tsx            # Header, Sidebar, and active Repository status panel
│   └── ui/                   # Reusable cards, buttons, lists, and sliders
├── contexts/
│   └── RepoContext.tsx       # Core React Context syncing active repository state
├── pages/
│   ├── Dashboard.tsx         # Main overview screen displaying Git activity & owner stats
│   ├── GraphExplorer.tsx     # Interactive D3/Force-directed dependency graph visualizer
│   ├── ImpactAnalysis.tsx    # Change simulator and dependency trace UI
│   ├── SemanticSearch.tsx    # Natural language chatbot UI
│   └── LandingPage.tsx       # Onboarding input for cloning new repositories
├── services/
│   ├── api.ts                # Axios/Fetch client base configuration with CORS base
│   ├── repoApi.ts            # Type-safe API client mapping endpoints to TS interfaces
│   └── observability.ts      # Action telemetry tracker logging user events
├── App.tsx                   # Page router and layout wrapper
└── main.tsx                  # React DOM rendering entry point
```

---

## 🔄 Core React State: `RepoContext.tsx`
Manages the global state of the active repository:
* **`analysisId`**: The unique identifier of the currently selected analysis.
* **`repoUrl` / `repoName`**: Coordinates of the analyzed repository.
* **`status`**: Track state (`queued` | `processing` | `completed` | `failed`).
* **`isAnalyzing`**: Boolean flag showing active processing status.
* **`setActiveRepository(...)`**: Saves repository metadata to local storage and updates context to switch dashboards instantly.

---

## 📄 Key Pages Breakdown

### 1. Dashboard (`pages/Dashboard.tsx`)
* **Onboarding View**: Rendered when `analysisId` is null. Prompts the user with a GitHub URL input, capability cards, and sample repository buttons (Flask, FastAPI, React).
* **Repository Summary Strip**: Displays high-level stats (commits, authors, default branch, last commit date).
* **Recent Activity Log**: An interactive timeline of recent commits.
* **Contributors Grid**: List of active authors. Clicking a contributor opens a sliding panel on the right.
* **Contributor Details Panel**: A sliding layout displaying all files the contributor has touched, their commit count, and a visual progress bar indicating their ownership percentage.

### 2. Graph Explorer (`pages/GraphExplorer.tsx`)
* Uses interactive node and edge rendering to map code structures.
* Allows expanding/collapsing structural units (modules, directories) and clicking nodes to inspect properties (line counts, dependencies).

### 3. Impact Analysis (`pages/ImpactAnalysis.tsx`)
* Renders search inputs to look up files or classes.
* Visualizes direct upstream/downstream lists alongside a calculated risk meter.
* Outlines natural-language recommendations explaining why specific routes could break when editing code.

### 4. Semantic Search (`pages/SemanticSearch.tsx`)
* Simple chatbot interface sending queries to the backend.
* Displays highlighted file names with direct line citation links so developers can navigate straight to code.
