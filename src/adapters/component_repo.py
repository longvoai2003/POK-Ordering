from src.models.component import Component
from src.domain.contracts.component_repo import ComponentRepo
import time
import asyncio
import logging

logger = logging.getLogger(__name__)


class GoogleSheetsComponentRepo(ComponentRepo):
    def __init__(self, sheet_id, worksheet="Components", cache_ttl_seconds=60):
        self._sheet_id = sheet_id
        self._worksheet = worksheet
        self._cache_ttl = cache_ttl_seconds
        self._cache: list[Component] | None = None
        self._loaded_at: float = 0.0
        self._init_ok: bool | None = None

    @property
    def _sheet(self):
        if not hasattr(self, "_sheet_ws"):
            import gspread
            from src.config import GOOGLE_APPLICATION_CREDENTIALS

            if not GOOGLE_APPLICATION_CREDENTIALS:
                raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS not configured")
            gc = gspread.service_account(filename=GOOGLE_APPLICATION_CREDENTIALS)
            self._sheet_ws = gc.open_by_key(self._sheet_id).worksheet(self._worksheet)
        return self._sheet_ws

    def _row_to_component(self, row: dict) -> Component:
        portion = float(row["portion"] or 100)
        default_portion = float(row["default_portion"] or portion)
        scale = default_portion / portion if portion > 0 else 1.0

        return Component(
            component_id=str(row["component_id"]),
            component_name=str(row["component_name"]),
            category=str(row["category"]),
            is_available=str(row["available"]).upper() == "TRUE",
            default_portion=default_portion,
            unit=str(row.get("unit", "g")),
            calories=float(row["calories"] or 0) * scale,
            protein=float(row["protein"] or 0) * scale,
            carbs=float(row["carbs"] or 0) * scale,
            fat=float(row["fat"] or 0) * scale,
            fiber=float(row["fiber"] or 0) * scale,
            cost=float(row["cost"] or 0) * scale,
            dietary_tags=[
                t.strip() for t in str(row["dietary_tags"]).split(",") if t.strip()
            ],
            min_portion=float(row["min_portion"] or 0),
            max_portion=float(row["max_portion"] or 0),
            portion_step=float(row["step"] or 0),
            description=str(row.get("description", "")),
            kitchen_notes=str(row.get("kitchen_notes", "")),
            # allergen_tags=[],
            skip_portion=str(row["skip_portion"]).upper() == "TRUE",
        )

    def _load_sync(self) -> list[Component]:
        if self._init_ok is False:
            return []
        try:
            records = self._sheet.get_all_records()
            self._init_ok = True
        except Exception:
            logger.exception("Failed to load components from Google Sheets")
            self._init_ok = False
            return []
        return [
            self._row_to_component(r)
            for r in records
            if str(r.get("active", "TRUE")).upper() == "TRUE"
        ]

    async def _ensure_cache(self) -> list[Component]:
        if self._cache is None or (
            time.monotonic() - self._loaded_at > self._cache_ttl
        ):
            self._cache = await asyncio.to_thread(self._load_sync)
            self._loaded_at = time.monotonic()
        return self._cache

    async def get_all(self) -> list[Component]:
        return await self._ensure_cache()

    async def get_by_category(self, category: str) -> list[Component]:
        return [c for c in await self._ensure_cache() if c.category == category]

    async def get_available(self) -> list[Component]:
        return [c for c in await self._ensure_cache() if c.is_available]

    async def refresh(self) -> None:
        self._cache = None
        await self._ensure_cache()
