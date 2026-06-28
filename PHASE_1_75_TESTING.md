# Phase 1.75 Testing

## Goal
Validate that imported repositories no longer display fake demo analytics anywhere in the dashboard and that demo repos still render the full mock experience.

## Test Steps

1. Import a public GitHub repository
   - Open the dashboard
   - Click `+ Import Repo`
   - Paste a valid public GitHub URL (for example `https://github.com/octocat/Hello-World`)
   - Submit the import and wait for success

2. Select the imported repository
   - Confirm the imported repository appears in the `Imported Repositories` section of the repo selector
   - Select it

3. Confirm truthfulness for imported repos
   - No fake anomaly banner is visible
   - No fake commit timeline appears
   - No fake commit heatmap appears
   - No fake hotspot files panel appears
   - No fake recent commits list appears
   - No fake active commit value is shown
   - No fake graph complexity score is shown
   - No fake chunk count metrics are shown anywhere
   - No fake health score is shown
   - No fake contributor statistics are shown

4. Confirm real metadata display
   - `Files Indexed` shows the imported repository file count
   - `Lines of Code` shows the imported repository line count
   - `Active Branches` shows the branch count or current branch name
   - `Graph Complexity` displays `Not Indexed`
   - `Commit Intelligence` displays `Not Indexed`
   - Semantic Search displays `Not Indexed`
   - Impact Analysis displays `Not Indexed`
   - AI Onboarding displays `Not Generated`

5. Confirm repository readiness/status card
   - A `Repository Status` card is visible
   - It lists `Repository Imported` as ready
   - It lists graph, semantic, commit, impact, and onboarding stages as pending
   - It shows the imported repository files and lines counts

6. Confirm demo repo behavior
   - Switch back to a demo repository from the selector
   - Confirm the original demo widgets are present again
   - Confirm anomaly detection, hotspots, timeline, and demo metrics remain visible for demos

7. Visual polish
   - The dashboard still feels polished and intentionally staged
   - Placeholder cards use muted colors and subtle labels rather than empty space

## Notes
- This phase is intentionally not indexing anything.
- The dashboard should now clearly separate imported repo staging from the demo analytics experience.
