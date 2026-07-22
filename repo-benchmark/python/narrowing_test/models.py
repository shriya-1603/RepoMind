class Client:
    def send(self):
        pass

class OtherClient:
    def run(self):
        pass

class Session:
    def send(self):
        pass

class ContextManagerWithAnnotation:
    def __enter__(self) -> Session:
        return Session()
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

class ContextManagerNoAnnotation:
    def __enter__(self):
        return Session()
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

class ContextManagerAbsentEnter:
    def send(self):
        pass
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
