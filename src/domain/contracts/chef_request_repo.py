from abc import ABC, abstractmethod
from src.models import ChefRequest


class ChefRequestRepo(ABC):
    @abstractmethod
    async def create(self, request: "ChefRequest") -> None: ...
