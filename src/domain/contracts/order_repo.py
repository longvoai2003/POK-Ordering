from abc import ABC, abstractmethod
from typing import Optional
from src.models.order import Order


class OrderRepo(ABC):
    @abstractmethod
    async def create(self, order: Order) -> Order | None:
        """Insert order. Returns Order on success, None if order_id already exists."""

    @abstractmethod
    async def get_by_id(self, order_id: str) -> Order | None: ...

    @abstractmethod
    async def confirm_payment(self, order_id: str) -> Order | None: ...

    @abstractmethod
    async def update_status(self, order_id: str, status: str) -> Order | None: ...

    @abstractmethod
    async def list_all(
        self,
        filters: dict[str, str],
        search: str | None,
        limit: int,
        offset: int,
    ) -> list[tuple[Order, str, str]]:
        """List orders with pagination. Returns (Order, formatted_price, items_summary)."""

    @abstractmethod
    async def count_all(
        self,
        filters: dict[str, str],
        search: str | None,
    ) -> int: ...

    @abstractmethod
    async def close(self) -> None: ...
