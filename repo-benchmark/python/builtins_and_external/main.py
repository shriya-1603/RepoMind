import json
import sys

def do_work(data):
    size = len(data)
    print(f"Data size is {size}")
    formatted = json.dumps(data)
    return formatted
