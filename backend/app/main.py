from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(router)


@app.get('/')
def root() -> dict[str, str]:
    return {'message': 'RepoMind backend is running.'}


@app.get('/health')
def health() -> dict[str, str]:
    import redis
    from app.graph.neo4j_client import Neo4jClient
    
    # Check Neo4j
    try:
        client = Neo4jClient()
        if not client.test_connection():
            return {'status': 'unhealthy', 'reason': 'Neo4j connection failed'}
    except Exception as e:
        return {'status': 'unhealthy', 'reason': f'Neo4j error: {e}'}
        
    # Check Redis
    try:
        r = redis.from_url(settings.redis_url)
        r.ping()
    except Exception as e:
        return {'status': 'unhealthy', 'reason': f'Redis error: {e}'}

    return {'status': 'healthy'}
