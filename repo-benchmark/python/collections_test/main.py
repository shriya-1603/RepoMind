from typing import List, Union
from models import User, Admin

def process_param(users: list[User]):
    for user in users:
        user.save()

def process_local():
    users: List[User] = []
    for user in users:
        user.save()

def process_nested(groups: list[list[User]]):
    for group in groups:
        for user in group:
            user.save()

def process_union(users: list[Union[User, Admin]]):
    for user in users:
        user.save()
