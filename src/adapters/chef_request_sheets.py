import logging
import gspread
import asyncio
from src.config import GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_SHEET_ID
from src.domain.contracts.chef_request_repo import ChefRequestRepo
from src.models.chef_request import ChefRequest

logger = logging.getLogger(__name__)


class GoogleSheetsChefRequestRepo(ChefRequestRepo):
    def __init__(
        self,
        sheet_id: str = GOOGLE_SHEET_ID,
        worksheet: str = "Chef_Requests",
    ):
        self._sheet_id = sheet_id
        self._worksheet_name = worksheet
        self._ok: bool = True

    @property
    def _sheet(self):
        if not hasattr(self, "_sheet_ws"):
            if not GOOGLE_APPLICATION_CREDENTIALS:
                raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS not configured")
            gc = gspread.service_account(filename=GOOGLE_APPLICATION_CREDENTIALS)
            self._sheet_ws = gc.open_by_key(self._sheet_id).worksheet(
                self._worksheet_name
            )
        return self._sheet_ws

    async def create(self, request: ChefRequest) -> None:
        if not self._ok:
            return
        try:
            await asyncio.to_thread(self._create_sync, request)
        except Exception:
            self._ok = False
            logger.exception("Failed to write chef request to sheets")

    def _create_sync(self, request: ChefRequest) -> None:
        self._sheet.append_row(request.to_row())
