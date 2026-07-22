#!/usr/bin/env python3
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.git_history_service import is_git_repository, extract_git_history
from app.services.graph_service import GraphService
from app.graph.neo4j_client import get_neo4j_client
from app.api.routes import get_repository_commits

class GitHistoryServiceTests(unittest.TestCase):
    def test_current_repo_is_git(self):
        repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.assertTrue(is_git_repository(repo_path))
        self.assertFalse(is_git_repository("/invalid/path/that/does/not/exist"))

    def test_extract_git_history(self):
        repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        commits = extract_git_history(repo_path, max_commits=5)
        self.assertTrue(len(commits) > 0)
        c = commits[0]
        self.assertTrue("hash" in c)
        self.assertTrue("short_hash" in c)
        self.assertTrue("message" in c)
        self.assertTrue("author_name" in c)
        self.assertTrue("author_email" in c)
        self.assertTrue("committer_name" in c)
        self.assertTrue("timestamp" in c)
        self.assertTrue("parent_hashes" in c)
        self.assertTrue("insertions" in c)
        self.assertTrue("deletions" in c)
        self.assertTrue("changed_files" in c)

class GitHistoryPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.client = get_neo4j_client()
        self.graph_svc = GraphService(client=self.client)
        self.analysis_id = "test-git-analysis-id"
        self.repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self._clear_test_nodes()

    def tearDown(self):
        self._clear_test_nodes()
        self.client.close()

    def _clear_test_nodes(self):
        self.client.run_write_query(
            "MATCH (n) WHERE n.analysis_id = $analysis_id OR n.id STARTS WITH $prefix DETACH DELETE n",
            {"analysis_id": self.analysis_id, "prefix": f"file:{self.analysis_id}"}
        )

    def test_git_persistence_and_idempotency(self):
        # 1. Ingest Git History first time
        self.graph_svc.store_git_history(self.analysis_id, self.repo_path)

        commits_res = self.client.run_query(
            "MATCH (r:Repository {id: $repo_id})-[:HAS_COMMIT]->(c:Commit) RETURN count(c) as count",
            {"repo_id": f"repo:{self.analysis_id}"}
        )
        first_count = commits_res[0]["count"]
        self.assertTrue(first_count > 0)

        devs_res = self.client.run_query(
            "MATCH (r:Repository {id: $repo_id})-[:HAS_COMMIT]->(c:Commit)-[:AUTHORED_BY]->(d:Developer) RETURN count(d) as count",
            {"repo_id": f"repo:{self.analysis_id}"}
        )
        self.assertTrue(devs_res[0]["count"] > 0)

        # Verify File node with exists_in_current_snapshot = false was created for changed files
        files_res = self.client.run_query(
            "MATCH (f:File {analysis_id: $analysis_id}) RETURN count(f) as count, all(x IN collect(f) WHERE x.exists_in_current_snapshot = false) as all_false",
            {"analysis_id": self.analysis_id}
        )
        self.assertTrue(files_res[0]["count"] > 0, "No File nodes stored for Git history")
        self.assertTrue(files_res[0]["all_false"], "Files should have exists_in_current_snapshot = false since AST parser wasn't run")

        # 2. Ingest again (Idempotency check)
        self.graph_svc.store_git_history(self.analysis_id, self.repo_path)
        commits_res_2 = self.client.run_query(
            "MATCH (r:Repository {id: $repo_id})-[:HAS_COMMIT]->(c:Commit) RETURN count(c) as count",
            {"repo_id": f"repo:{self.analysis_id}"}
        )
        self.assertEqual(first_count, commits_res_2[0]["count"])

class GitHistoryAPITests(unittest.TestCase):
    def setUp(self):
        self.neo_client = get_neo4j_client()
        self.graph_svc = GraphService(client=self.neo_client)
        self.analysis_id = "test-api-analysis-id"
        self.repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self._clear_test_nodes()
        self.graph_svc.store_git_history(self.analysis_id, self.repo_path)

        res = self.neo_client.run_query(
            "MATCH (r:Repository {id: $repo_id})-[:HAS_COMMIT]->(c:Commit) RETURN c LIMIT 1",
            {"repo_id": f"repo:{self.analysis_id}"}
        )
        self.test_commit = res[0]["c"]

    def tearDown(self):
        self._clear_test_nodes()
        self.neo_client.close()

    def _clear_test_nodes(self):
        self.neo_client.run_write_query(
            "MATCH (n) WHERE n.analysis_id = $analysis_id OR n.id STARTS WITH $prefix DETACH DELETE n",
            {"analysis_id": self.analysis_id, "prefix": f"file:{self.analysis_id}"}
        )

    def test_get_commits_basic(self):
        # Call route function directly
        data = get_repository_commits(self.analysis_id, limit=5)
        self.assertTrue("commits" in data)
        self.assertTrue("total" in data)
        self.assertTrue(len(data["commits"]) > 0)
        
        c = data["commits"][0]
        self.assertTrue("short_hash" in c)
        self.assertTrue("changed_files" in c)

    def test_get_commits_message_search(self):
        full_msg = self.test_commit["message"]
        sub_msg = full_msg[:10]
        data = get_repository_commits(self.analysis_id, q=sub_msg)
        self.assertTrue(len(data["commits"]) > 0)
        self.assertTrue(sub_msg.lower() in data["commits"][0]["message"].lower())

    def test_get_commits_author_search(self):
        author_name = self.test_commit["author_name"]
        sub_author = author_name[:5]
        data = get_repository_commits(self.analysis_id, author=sub_author)
        self.assertTrue(len(data["commits"]) > 0)
        self.assertTrue(sub_author.lower() in data["commits"][0]["author_name"].lower())

    def test_get_commits_hash_search(self):
        full_hash = self.test_commit["hash"]
        data = get_repository_commits(self.analysis_id, commit_hash=full_hash)
        self.assertEqual(len(data["commits"]), 1)
        self.assertEqual(data["commits"][0]["hash"], full_hash)

        short_hash = self.test_commit["short_hash"]
        data = get_repository_commits(self.analysis_id, commit_hash=short_hash)
        self.assertEqual(len(data["commits"]), 1)
        self.assertEqual(data["commits"][0]["hash"], full_hash)

    def test_get_commits_combined_filters(self):
        full_hash = self.test_commit["hash"]
        author_name = self.test_commit["author_name"]
        data = get_repository_commits(self.analysis_id, commit_hash=full_hash, author=author_name)
        self.assertEqual(len(data["commits"]), 1)

        data = get_repository_commits(self.analysis_id, commit_hash=full_hash, author="nonexistent_author")
        self.assertEqual(len(data["commits"]), 0)
        self.assertEqual(data["total"], 0)

if __name__ == "__main__":
    unittest.main()
