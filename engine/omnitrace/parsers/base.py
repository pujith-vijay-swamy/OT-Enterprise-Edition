from abc import ABC, abstractmethod
from typing import List
from omnitrace.ir import ServiceContract

class BaseParser(ABC):
    """
    Abstract Base Class for language & framework AST Parsers.
    """

    @abstractmethod
    def parse_directory(self, root_dir: str, service_name: str = "") -> ServiceContract:
        """
        Parse an entire source code directory tree and return a unified ServiceContract.
        """
        pass
