def my_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

class Parent:
    @my_decorator
    def greet(self):
        return "Hello"

    @staticmethod
    def static_method():
        return 42

    @classmethod
    def class_method(cls):
        return cls()
