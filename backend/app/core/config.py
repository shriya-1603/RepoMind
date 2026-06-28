from typing import List
import os


class Settings:
    def __init__(self):
        self.app_name = os.getenv('APP_NAME', 'RepoMind Backend')
        self.redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
        self.cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
        self.debug = os.getenv('DEBUG', 'true').lower() == 'true'

        # Neo4j graph database
        self.neo4j_uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
        self.neo4j_username = os.getenv('NEO4J_USERNAME', 'neo4j')
        self.neo4j_password = os.getenv('NEO4J_PASSWORD', 'password')


settings = Settings()
