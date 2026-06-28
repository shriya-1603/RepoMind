# Git Metadata Pipeline & Analysis Service

This document provides a technical dive into the Git Metadata pipeline. It covers how git CLI commands are executed, how log files are parsed, and how ownership metrics are calculated.

---

## 🚀 Execution Service (`git_metadata_service.py`)

RepoMind runs directly inside the environment without a heavy database layer for Git. All computations are run on-demand using standard Git CLI commands executed through Python's `subprocess` API. This keeps the application lightweight and free of external C-bindings dependencies like GitPython.

---

## 🛠 Command Orchestration

The service executes the following commands inside the directory path of the cloned repository:

### 1. Identify Branch
```bash
git rev-parse --abbrev-ref HEAD
```
Retrieves the name of the checked-out branch (e.g., `main` or `master`).

### 2. Count Commits
```bash
git rev-list --count HEAD
```
Returns the total number of commits on the current branch.

### 3. Last Commit Date
```bash
git log -1 --format=%cI
```
Gets the ISO 8601 date of the most recent commit in the tree.

### 4. Recent Commits with Authors
```bash
git log -50 --format=%H|%s|%an|%ae|%cI --no-merges
```
Fetches the latest 50 non-merge commits. The output is structured with a custom pipe delimiter (`|`), which the backend splits into:
* SHA
* Commit Message
* Author Name
* Author Email
* Date

### 5. Files Changed per Commit
```bash
git log -50 --no-merges --name-only --format=COMMIT:%H
```
Fetches the names of files modified in each of the last 50 commits. The `COMMIT:%H` marker separates files for each commit block, enabling single-pass parsing in Python.

---

## 📊 Git Metrics Computation

### 1. Active Contributors
By collecting all unique emails from the log output:
```bash
git log --format=%ae
```
We extract the set of all active email addresses, computing the total count of developers who have contributed to the tree.

### 2. Commit Log & File Mapping
To build per-contributor ownership metrics without running slow individual commands, the engine requests a single full log mapping every commit to the files it touched:
```bash
git log --no-merges --name-only --format=COMMIT:%H|%an|%ae|%cI
```

The output is processed in a single pass:
1. Every line starting with `COMMIT:` updates the active author context (email, name, timestamp).
2. Every subsequent non-empty line (representing a file path) adds a count to that author's file records.

---

## 🧮 File Ownership & Directory Inference

### 1. File Ownership Calculation
For every file $F$ modified in the repository, we track the total commits that touched it ($C_{\text{total}}$). For each author $A$ who modified $F$, we track their commit count ($C_{A}$).
The **Ownership Score** ($S_O$) is:
$$S_O(A, F) = \frac{C_{A}(F)}{C_{\text{total}}(F)}$$

This score ranges from `0.0` to `1.0`. A score of `1.0` means the author is the sole contributor to that file, representing high ownership.

### 2. Primary Areas Inference
To determine the primary directories a developer works in:
1. We sort their touched files by commit count in descending order.
2. We extract the top-level directory names (e.g., `src`, `backend`, `tests`). If a file is in the root, it is classified as `(root)`.
3. We count the directory occurrences and return the top 5 most modified folders as their **Primary Areas**.
