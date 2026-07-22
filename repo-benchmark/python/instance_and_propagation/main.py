from models import UserRepository, ClientA, ClientB
from factories import get_repository
from services import Service

class App:
    def __init__(self):
        self.repo = UserRepository()
        self.service = Service()
        
        # Conflicting assignment
        if 1 > 2:
            self.conflict = ClientA()
        else:
            self.conflict = ClientB()

    def execute(self):
        # 1. Instance attribute resolution
        self.repo.save()

        # 2. Chained attributes resolution
        self.service.client.send()

        # 3. Return propagation
        repo = get_repository()
        repo.save()

        # 4. Conflicting instance types (should be unresolved)
        self.conflict.send()

        # 5. Unknown chain segment (should be unresolved)
        self.service.unknown.send()
