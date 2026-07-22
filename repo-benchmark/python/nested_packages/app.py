from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .core.utils import process_data

from .core import process_data

def run():
    process_data(5)
