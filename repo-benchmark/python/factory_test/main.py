from models import Client, OtherClient
from factories import ClientFactory

class App:
    def execute(self):
        # 1. Factory return propagation
        client1 = ClientFactory.create()
        client1.send()

        # 2. Unannotated constructor return propagation
        client2 = ClientFactory.create_unannotated_constructor()
        client2.send()

        # 3. Ambiguous multiple returns (should be unresolved)
        client3 = ClientFactory.create_ambiguous(True)
        client3.send()

        # 4. Unresolved factory method return (should be unresolved)
        client4 = ClientFactory.create_unresolved()
        client4.send()
