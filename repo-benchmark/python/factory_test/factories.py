from models import Client, OtherClient

class ClientFactory:
    @staticmethod
    def create():
        return Client()

    @staticmethod
    def create_ambiguous(flag: bool):
        if flag:
            return Client()
        return OtherClient()

    @staticmethod
    def create_unannotated_constructor():
        # Direct constructor call in return statement
        return Client()

    @staticmethod
    def create_unresolved():
        # Returns call to something unannotated or external
        return get_external()

def get_external():
    pass
