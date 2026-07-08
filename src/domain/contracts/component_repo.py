from abc import ABC, abstractmethod
from src.models.component import Component


class ComponentRepo(ABC):
    @abstractmethod
    async def get_all(self) -> list[Component]: ...

    @abstractmethod
    async def get_by_category(self, category: str) -> list[Component]: ...

    @abstractmethod
    async def get_available(self) -> list[Component]: ...

    @abstractmethod
    async def refresh(self) -> None: ...
