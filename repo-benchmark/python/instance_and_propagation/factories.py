from models import UserRepository

def get_repository() -> UserRepository:
    return UserRepository()
