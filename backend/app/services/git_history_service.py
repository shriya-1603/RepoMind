"""
Git History Service — Extracts commit history, developers, and file change metrics
from a git repository using subprocess git CLI calls.
"""

import os
import subprocess
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def _run_git(args: List[str], cwd: str) -> str:
    """Execute a git command in the target directory and return stdout."""
    try:
        res = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=15
        )
        if res.returncode != 0:
            logger.debug("git %s failed: %s", args[0], res.stderr[:200])
            return ""
        return res.stdout.strip()
    except Exception as e:
        logger.warning("git subprocess error: %s", e)
        return ""

def is_git_repository(repo_path: str) -> bool:
    """Check if the given path is inside a valid git repository work tree."""
    if not os.path.isdir(repo_path):
        return False
    return bool(_run_git(["rev-parse", "--is-inside-work-tree"], cwd=repo_path))

def extract_git_history(repo_path: str, max_commits: int = 100) -> List[Dict[str, Any]]:
    """
    Extract git commits with their authors, parent hashes, and changed files.
    """
    if not is_git_repository(repo_path):
        logger.warning("Path %s is not a valid git repository", repo_path)
        return []

    # Format: full_hash|short_hash|author_name|author_email|committer_name|author_date|parent_hashes|subject
    # parent_hashes is space-separated
    log_format = "%H|%h|%an|%ae|%cn|%aI|%P|%s"
    log_raw = _run_git(["log", f"-{max_commits}", f"--format={log_format}"], cwd=repo_path)

    commits = []
    for line in log_raw.splitlines():
        if not line.strip() or "|" not in line:
            continue
        parts = line.split("|", 7)
        if len(parts) < 8:
            continue
            
        full_hash, short_hash, author_name, author_email, committer_name, timestamp, parents_str, message = parts
        parent_hashes = [p.strip() for p in parents_str.split(" ") if p.strip()]

        # Extract file status changes
        files_data = {}
        status_raw = _run_git(["show", "--name-status", "--format=", full_hash], cwd=repo_path)
        for s_line in status_raw.splitlines():
            if not s_line.strip():
                continue
            s_parts = s_line.split(maxsplit=1)
            if len(s_parts) == 2:
                status, path = s_parts
                # Map git statuses (A=added, D=deleted, M=modified, R=renamed, etc.)
                change_type = "modified"
                if status.startswith("A"):
                    change_type = "added"
                elif status.startswith("D"):
                    change_type = "deleted"
                elif status.startswith("R"):
                    change_type = "renamed"
                
                files_data[path] = {
                    "path": path,
                    "change_type": change_type,
                    "insertions": 0,
                    "deletions": 0
                }

        # Extract insertions & deletions counts
        numstat_raw = _run_git(["show", "--numstat", "--format=", full_hash], cwd=repo_path)
        for n_line in numstat_raw.splitlines():
            if not n_line.strip():
                continue
            n_parts = n_line.split(maxsplit=2)
            if len(n_parts) == 3:
                ins_str, del_str, path = n_parts
                if path in files_data:
                    files_data[path]["insertions"] = int(ins_str) if ins_str.isdigit() else 0
                    files_data[path]["deletions"] = int(del_str) if del_str.isdigit() else 0

        # Calculate overall commit modifications
        total_insertions = sum(f["insertions"] for f in files_data.values())
        total_deletions = sum(f["deletions"] for f in files_data.values())

        commits.append({
            "hash": full_hash,
            "short_hash": short_hash,
            "message": message,
            "author_name": author_name,
            "author_email": author_email.strip().lower(),
            "committer_name": committer_name,
            "timestamp": timestamp,
            "parent_hashes": parent_hashes,
            "insertions": total_insertions,
            "deletions": total_deletions,
            "changed_files": list(files_data.values())
        })

    return commits
