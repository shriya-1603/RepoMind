from models import User

def process(user: User):
    user.save()

def execute():
    item = User()
    item.save()
