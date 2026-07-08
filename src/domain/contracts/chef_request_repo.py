from abc import ABC, abstractmethod
from src.models import ChefRequest
from src.models.order import Order


class ChefRequestRepo(ABC):
    @abstractmethod
    async def create(self, request: "ChefRequest") -> None: ...

    @abstractmethod
    async def create_order_audit(self, order: "Order") -> None: ...
