# PHASE 1 TESTING - Repository Import

Manual test steps to verify repository ingestion (Phase 1)

1. Start backend

```bash
# from repo root
cd backend
# ensure virtualenv and deps installed
python3 -m uvicorn app.main:app --port 8000
```

2. Start frontend

```bash
# from repo root
npm run dev
# or
pnpm dev
```

3. Open the app in the browser (usually http://localhost:5173)

4. Go to the Dashboard page

5. Click the small branch icon button near the repository selector ("Import Repository")

6. In the modal, paste a public GitHub repository URL, e.g. `https://github.com/vercel/next.js` (use a small repo for quick test)

7. Optionally provide a branch name (leave empty to use default)

8. Click `Import` and wait for the operation to complete. The modal will close on success.

9. Refresh repository list (the selector automatically refreshes when modal closes). Select the newly imported repository from the selector.

10. Confirm the dashboard title updates to the imported repository `full_name`, and metadata (language, file counts) reflect the imported repo.

11. Verify backend storage: `backend/storage/repositories.json` contains the repository metadata and `backend/storage/repos/{repo_id}` folder exists with the cloned repo.

Troubleshooting:
- If import fails with "Git clone failed", ensure `git` is installed and the repo URL is public.
- Large repositories may be rejected by the file count guard (default limit: 40000 files).

Notes:
- This phase only imports basic metadata and stores a local clone. It does not yet run code parsing, graphing, or semantic indexing.
