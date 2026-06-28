"""Neo4j client – thin wrapper around the official neo4j Python driver."""

import logging
import os
from typing import Any, Dict, List, Optional

from neo4j import GraphDatabase, Driver, exceptions as neo4j_exc

logger = logging.getLogger(__name__)


class Neo4jClient:
    """
    Manages a connection to a Neo4j instance.

    Configuration is read from the following environment variables:
        NEO4J_URI       – bolt / neo4j URI  (default: bolt://localhost:7687)
        NEO4J_USERNAME  – database username (default: neo4j)
        NEO4J_PASSWORD  – database password (default: password)
    """

    def __init__(self) -> None:
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        username = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")

        try:
            self._driver: Driver = GraphDatabase.driver(
                uri, auth=(username, password)
            )
            logger.info("Neo4j driver created for URI: %s", uri)
        except neo4j_exc.ConfigurationError as exc:
            logger.error("Invalid Neo4j configuration: %s", exc)
            raise
        except Exception as exc:
            logger.error("Failed to create Neo4j driver: %s", exc)
            raise

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def test_connection(self) -> bool:
        """
        Verify that the database is reachable.

        Returns:
            True if the server responds, False otherwise.
        """
        try:
            self._driver.verify_connectivity()
            logger.info("Neo4j connectivity verified.")
            return True
        except neo4j_exc.ServiceUnavailable as exc:
            logger.error("Neo4j is unavailable: %s", exc)
            return False
        except neo4j_exc.AuthError as exc:
            logger.error("Neo4j authentication failed: %s", exc)
            return False
        except Exception as exc:
            logger.error("Neo4j connection test failed: %s", exc)
            return False

    def close(self) -> None:
        """Close the underlying driver and release all connections."""
        try:
            self._driver.close()
            logger.info("Neo4j driver closed.")
        except Exception as exc:
            logger.warning("Error while closing Neo4j driver: %s", exc)

    # ------------------------------------------------------------------
    # Query execution helpers
    # ------------------------------------------------------------------

    def run_query(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute a Cypher query and return the results as a list of dicts.

        Args:
            query:      Cypher query string.
            parameters: Optional dict of query parameters.
            database:   Target database name (None → driver default).

        Returns:
            List of records represented as plain dicts.

        Raises:
            RuntimeError: On any Neo4j or driver error.
        """
        params = parameters or {}
        try:
            with self._driver.session(database=database) as session:
                result = session.run(query, params)
                return [record.data() for record in result]
        except (
            neo4j_exc.CypherSyntaxError,
            neo4j_exc.CypherTypeError,
        ) as exc:
            logger.error("Cypher error – %s\nQuery: %s", exc, query)
            raise RuntimeError(f"Cypher error: {exc}") from exc
        except neo4j_exc.ServiceUnavailable as exc:
            logger.error("Neo4j service unavailable: %s", exc)
            raise RuntimeError(f"Neo4j service unavailable: {exc}") from exc
        except Exception as exc:
            logger.error("Unexpected Neo4j error: %s", exc)
            raise RuntimeError(f"Neo4j error: {exc}") from exc

    def run_write_query(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute a Cypher write query inside an explicit write transaction.

        Prefer this over run_query for all CREATE / MERGE / DELETE statements
        so that the driver can handle retries correctly on clustered setups.
        """
        params = parameters or {}
        try:
            with self._driver.session(database=database) as session:
                result = session.execute_write(
                    lambda tx: list(tx.run(query, params))
                )
                return [record.data() for record in result]
        except (
            neo4j_exc.CypherSyntaxError,
            neo4j_exc.CypherTypeError,
        ) as exc:
            logger.error("Cypher write error – %s\nQuery: %s", exc, query)
            raise RuntimeError(f"Cypher write error: {exc}") from exc
        except neo4j_exc.ServiceUnavailable as exc:
            logger.error("Neo4j service unavailable during write: %s", exc)
            raise RuntimeError(f"Neo4j service unavailable: {exc}") from exc
        except Exception as exc:
            logger.error("Unexpected Neo4j write error: %s", exc)
            raise RuntimeError(f"Neo4j write error: {exc}") from exc


# ---------------------------------------------------------------------------
# Module-level singleton (lazy initialised)
# ---------------------------------------------------------------------------

_client: Optional[Neo4jClient] = None


def get_neo4j_client() -> Neo4jClient:
    """Return the module-level Neo4j client, creating it on first call."""
    global _client
    if _client is None:
        _client = Neo4jClient()
    return _client


def close_neo4j_client() -> None:
    """Close and discard the module-level Neo4j client."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
