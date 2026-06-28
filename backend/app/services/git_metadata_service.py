"""
Git metadata service — extracts commit history, contributors, and file ownership
from a cloned repository using git CLI commands (no GitPython dependency required).
"""

import subprocess
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

from pathlib import Path
import json

# In-memory store keyed by analysis_id
_GIT_METADATA_STORE: dict[str, dict[str, Any]] = {}

BACKEND_DIR = Path(__file__).resolve().parents[2]
ACTIVITY_DIR = BACKEND_DIR / '.repomind' / 'activity'

def _ensure_activity_dir():
    ACTIVITY_DIR.mkdir(parents=True, exist_ok=True)


# ── Public store/retrieve helpers ─────────────────────────────────────────────

def store_git_metadata(analysis_id: str, metadata: dict[str, Any]) -> None:
    _GIT_METADATA_STORE[analysis_id] = metadata
    try:
        _ensure_activity_dir()
        file_path = ACTIVITY_DIR / f"{analysis_id}.json"
        file_path.write_text(json.dumps(metadata, indent=2))
        logger.info("[ACTIVITY] persisted for analysis_id=%s", analysis_id)
    except Exception as e:
        logger.error("[ACTIVITY] failed to persist for analysis_id=%s: %s", analysis_id, e)


def extract_activity(repo_path: str, analysis_id: str, repo_url: str) -> dict[str, Any]:
    """
    Extract git metadata from the cloned repo and immediately persist it.
    """
    logger.info("[ACTIVITY] extracting for analysis_id=%s path=%s url=%s", analysis_id, repo_path, repo_url)
    meta = extract_git_metadata(repo_path)
    store_git_metadata(analysis_id, meta)
    return meta


def get_git_metadata(analysis_id: str) -> Optional[dict[str, Any]]:
    # 1. Try in-memory store
    if analysis_id in _GIT_METADATA_STORE:
        return _GIT_METADATA_STORE[analysis_id]

    # 2. Try loading from disk
    file_path = ACTIVITY_DIR / f"{analysis_id}.json"
    if file_path.exists():
        try:
            data = json.loads(file_path.read_text())
            _GIT_METADATA_STORE[analysis_id] = data
            logger.info("[ACTIVITY] loaded_from_disk for analysis_id=%s", analysis_id)
            return data
        except Exception as e:
            logger.error("[ACTIVITY] failed to load from disk for analysis_id=%s: %s", analysis_id, e)

    logger.info("[ACTIVITY] unavailable for analysis_id=%s", analysis_id)
    return None


def get_git_metadata_debug_info(analysis_id: str) -> dict[str, Any]:
    file_path = ACTIVITY_DIR / f"{analysis_id}.json"
    return {
        "in_memory": analysis_id in _GIT_METADATA_STORE,
        "on_disk": file_path.exists(),
        "file_path": str(file_path)
    }





# ── Git CLI helpers ───────────────────────────────────────────────────────────

def _run_git(args: list[str], cwd: str) -> str:
    """Run a git subcommand and return stdout, or '' on failure."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            logger.debug("[git_metadata] git %s failed: %s", args[0], result.stderr[:200])
            return ""
        return result.stdout.strip()
    except Exception as exc:
        logger.warning("[git_metadata] git subprocess error: %s", exc)
        return ""


def _is_git_repo(path: str) -> bool:
    return bool(_run_git(["rev-parse", "--is-inside-work-tree"], cwd=path))


# ── Extraction logic ──────────────────────────────────────────────────────────

def extract_git_metadata(repo_path: str, max_commits: int = 50) -> dict[str, Any]:
    """
    Extract git metadata from a local clone.

    Returns a dict matching the /repository-activity response shape,
    or an empty-source dict if the path isn't a git repo.
    """
    logger.info("[ACTIVITY] extracting from path=%s", repo_path)
    if not os.path.isdir(repo_path):

        logger.warning("[git_metadata] repo_path does not exist: %s", repo_path)
        return _empty_metadata()

    if not _is_git_repo(repo_path):
        logger.warning("[git_metadata] not a git repo: %s", repo_path)
        return _empty_metadata()

    try:
        return _extract(repo_path, max_commits)
    except Exception as exc:
        logger.error("[git_metadata] extraction failed: %s", exc)
        return _empty_metadata()


def _empty_metadata() -> dict[str, Any]:
    return {
        "source": "unavailable",
        "overview": {},
        "recentCommits": [],
        "contributors": [],
    }


def _extract(repo_path: str, max_commits: int) -> dict[str, Any]:
    # ── Overview ──────────────────────────────────────────────────────────────
    default_branch = (
        _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=repo_path) or "main"
    )

    # Total commit count
    total_commits_str = _run_git(["rev-list", "--count", "HEAD"], cwd=repo_path)
    total_commits = int(total_commits_str) if total_commits_str.isdigit() else 0

    # Last commit date (ISO 8601)
    last_commit_date = _run_git(
        ["log", "-1", "--format=%cI"], cwd=repo_path
    )

    # Unique active contributors
    contributor_names_raw = _run_git(
        ["log", "--format=%ae"], cwd=repo_path
    )
    active_contributor_emails = set(
        e for e in contributor_names_raw.splitlines() if e.strip()
    )

    # ── Recent commits ────────────────────────────────────────────────────────
    # Format: SHA|subject|author name|author email|ISO date
    log_raw = _run_git(
        [
            "log",
            f"-{max_commits}",
            "--format=%H|%s|%an|%ae|%cI",
            "--no-merges",
        ],
        cwd=repo_path,
    )

    recent_commits = []
    commit_sha_list = []  # used to look up files per commit below
    for line in log_raw.splitlines():
        if "|" not in line:
            continue
        parts = line.split("|", 4)
        if len(parts) < 5:
            continue
        sha, message, author_name, author_email, date = parts
        recent_commits.append(
            {
                "sha": sha[:12],
                "message": message[:120],
                "authorName": author_name,
                "authorEmail": author_email,
                "date": date,
                "filesChanged": [],  # filled in below
            }
        )
        commit_sha_list.append(sha)

    # Attach files changed to each recent commit (one git call per commit would
    # be expensive for large repos; batch using --name-only with separators)
    if commit_sha_list:
        # We'll fetch name-only log for the same window
        name_log = _run_git(
            [
                "log",
                f"-{max_commits}",
                "--no-merges",
                "--name-only",
                "--format=COMMIT:%H",
            ],
            cwd=repo_path,
        )
        _attach_files_to_commits(name_log, recent_commits)

    # ── Per-contributor stats ─────────────────────────────────────────────────
    # One pass: git log with name-only to build file→contributor mapping
    full_log = _run_git(
        [
            "log",
            "--no-merges",
            "--name-only",
            "--format=COMMIT:%H|%an|%ae|%cI",
        ],
        cwd=repo_path,
    )

    contributors = _build_contributors(full_log)

    return {
        "source": "git",
        "overview": {
            "defaultBranch": default_branch,
            "lastCommitDate": last_commit_date,
            "totalCommits": total_commits,
            "activeContributors": len(active_contributor_emails),
        },
        "recentCommits": recent_commits,
        "contributors": contributors,
    }


def _attach_files_to_commits(
    name_log: str, commits: list[dict[str, Any]]
) -> None:
    """
    Parse --name-only log output (with COMMIT:<sha> markers) and attach
    the files list to the matching commit dict in-place.
    """
    sha_to_commit = {c["sha"]: c for c in commits}
    current_sha = None

    for line in name_log.splitlines():
        if line.startswith("COMMIT:"):
            sha_full = line[7:].strip()
            current_sha = sha_full[:12]
        elif line.strip() and current_sha and current_sha in sha_to_commit:
            sha_to_commit[current_sha]["filesChanged"].append(line.strip())


def _build_contributors(full_log: str) -> list[dict[str, Any]]:
    """
    Parse full git log (--name-only) and build per-contributor stats.
    """
    # contributor_key: email
    # per_contributor: { name, email, commits: [(sha, date)], files: {path: {count, lastDate}} }
    contribs: dict[str, dict[str, Any]] = {}

    current_email: str | None = None
    current_sha: str | None = None
    current_date: str | None = None

    for line in full_log.splitlines():
        if line.startswith("COMMIT:"):
            rest = line[7:].strip()
            parts = rest.split("|", 3)
            if len(parts) < 4:
                current_email = None
                continue
            sha_full, author_name, author_email, date = parts
            current_sha = sha_full[:12]
            current_date = date
            current_email = author_email.strip().lower()

            if current_email not in contribs:
                contribs[current_email] = {
                    "name": author_name.strip(),
                    "email": current_email,
                    "commitCount": 0,
                    "lastActiveDate": date,
                    "files": {},  # path -> {count, lastDate}
                }
            c = contribs[current_email]
            c["commitCount"] += 1
            # Keep the most recent date
            if date > c["lastActiveDate"]:
                c["lastActiveDate"] = date

        elif line.strip() and current_email and current_email in contribs:
            path = line.strip()
            files = contribs[current_email]["files"]
            if path not in files:
                files[path] = {"count": 0, "lastDate": current_date or ""}
            files[path]["count"] += 1
            if (current_date or "") > files[path]["lastDate"]:
                files[path]["lastDate"] = current_date or ""

    # ── Compute total commits per file (across all contributors) ───────────
    file_total_commits: dict[str, int] = {}
    for c in contribs.values():
        for path, info in c["files"].items():
            file_total_commits[path] = file_total_commits.get(path, 0) + info["count"]

    # ── Build output list ──────────────────────────────────────────────────
    result = []
    for email, c in contribs.items():
        # Sort files by commit count desc, take top 20
        sorted_files = sorted(c["files"].items(), key=lambda x: -x[1]["count"])[:20]

        files_touched = []
        for path, info in sorted_files:
            total = file_total_commits.get(path, 1)
            ownership_score = round(info["count"] / total, 3) if total > 0 else 0.0
            files_touched.append(
                {
                    "path": path,
                    "commitCount": info["count"],
                    "lastTouched": info["lastDate"],
                    "ownershipScore": ownership_score,
                }
            )

        # Infer primary areas from top-level directories
        primary_areas = _infer_primary_areas([ft["path"] for ft in files_touched])

        result.append(
            {
                "name": c["name"],
                "email": c["email"],
                "commitCount": c["commitCount"],
                "lastActiveDate": c["lastActiveDate"],
                "filesTouched": files_touched,
                "primaryAreas": primary_areas,
            }
        )

    # Sort by commit count descending
    result.sort(key=lambda x: -x["commitCount"])
    return result


def _infer_primary_areas(file_paths: list[str]) -> list[str]:
    """Extract top-level directories from file paths as primary areas."""
    areas: dict[str, int] = {}
    for path in file_paths:
        parts = path.split("/")
        area = parts[0] if len(parts) > 1 else "(root)"
        areas[area] = areas.get(area, 0) + 1
    return [k for k, _ in sorted(areas.items(), key=lambda x: -x[1])[:5]]
