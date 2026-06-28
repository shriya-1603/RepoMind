import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from uuid import uuid4
import subprocess
import shutil
import datetime
import os
import re

STORAGE_DIR = Path(__file__).resolve().parents[2] / 'storage'
REPOS_DIR = STORAGE_DIR / 'repos'
STORE_FILE = STORAGE_DIR / 'repositories.json'

IGNORED_DIRS = {'.git', 'node_modules', 'dist', 'build', '.next', 'venv', '__pycache__', 'target'}


def _ensure_dirs():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    REPOS_DIR.mkdir(parents=True, exist_ok=True)
    if not STORE_FILE.exists():
        STORE_FILE.write_text(json.dumps({}))


def _load_store() -> Dict[str, Any]:
    _ensure_dirs()
    try:
        return json.loads(STORE_FILE.read_text())
    except Exception:
        return {}


def _save_store(store: Dict[str, Any]):
    _ensure_dirs()
    STORE_FILE.write_text(json.dumps(store, indent=2))


def _safe_repo_id(owner: str, name: str) -> str:
    base = f"{owner}_{name}".lower().replace('.', '_').replace('-', '_')
    return f"{base}_{uuid4().hex[:8]}"


def _is_valid_github_url(url: str) -> Optional[re.Match]:
    # Accept patterns like https://github.com/owner/repo or with .git and optional trailing slash
    pattern = r'^https://github\.com/(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+)(?:\.git)?/?$'
    return re.match(pattern, url)


def import_repository(url: str, branch: Optional[str] = None, max_files: int = 40000) -> Dict[str, Any]:
    """Clone a public GitHub repo and compute simple metadata. Raises RuntimeError on failure."""
    m = _is_valid_github_url(url)
    if not m:
        raise RuntimeError('Invalid GitHub repository URL. Only public HTTPS github.com URLs are supported.')

    owner = m.group('owner')
    name = m.group('repo')
    repo_id = _safe_repo_id(owner, name)

    dest = REPOS_DIR / repo_id
    if dest.exists():
        shutil.rmtree(dest)

    temp_dir = STORAGE_DIR / f'tmp_{repo_id}'
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    git_cmd = ['git', 'clone', '--depth', '1']
    if branch:
        git_cmd += ['--branch', branch]
    git_cmd += [url, str(temp_dir)]

    proc = subprocess.run(git_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError(f'Git clone failed: {proc.stderr.strip()}')

    # Move into final location
    shutil.move(str(temp_dir), str(dest))

    # Walk repository to collect metadata
    file_count = 0
    total_lines = 0
    ext_counts: Dict[str, int] = {}
    for root, dirs, files in os.walk(dest):
        # prune ignored dirs in-place
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for f in files:
            # skip binary-ish files by extension blacklist
            if f.endswith(('.png', '.jpg', '.jpeg', '.gif', '.zip', '.tar', '.gz', '.jar', '.class')):
                continue
            file_count += 1
            fp = Path(root) / f
            try:
                with fp.open('r', encoding='utf-8', errors='ignore') as fh:
                    lines = fh.readlines()
                    total_lines += len(lines)
            except Exception:
                # ignore unreadable files
                continue
            ext = fp.suffix.lower() or 'txt'
            ext_counts[ext] = ext_counts.get(ext, 0) + 1

            if file_count > max_files:
                shutil.rmtree(dest, ignore_errors=True)
                raise RuntimeError('Repository too large (file count exceeded)')

    # simple primary language detection by most common extension
    primary_language = 'Unknown'
    if ext_counts:
        most = max(ext_counts.items(), key=lambda kv: kv[1])[0]
        lang_map = {'.py': 'Python', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.java': 'Java', '.go': 'Go'}
        primary_language = lang_map.get(most, most.replace('.', '').upper())

    metadata: Dict[str, Any] = {
        'repo_id': repo_id,
        'owner': owner,
        'name': name,
        'full_name': f'{owner}/{name}',
        'branch': branch or 'default',
        'local_path': str(dest.resolve()),
        'imported_at': datetime.datetime.utcnow().isoformat() + 'Z',
        'primary_language': primary_language,
        'file_count': file_count,
        'total_lines': total_lines,
    }

    # persist
    store = _load_store()
    store[repo_id] = metadata
    _save_store(store)

    return metadata


def list_repositories() -> List[Dict[str, Any]]:
    store = _load_store()
    return list(store.values())


def get_repository(repo_id: str) -> Optional[Dict[str, Any]]:
    store = _load_store()
    return store.get(repo_id)
