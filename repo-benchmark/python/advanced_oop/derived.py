from base import Parent

class Child(Parent):
    def greet(self):
        parent_greet = super().greet()
        return f"{parent_greet} from Child"
