from src.adapters.chef_request_sheets import GoogleSheetsChefRequestRepo
from src.adapters.component_repo import GoogleSheetsComponentRepo
from src.adapters.order_repo import PostgresOrderRepo
from src.config import GOOGLE_SHEET_ID

_component_repo = GoogleSheetsComponentRepo(sheet_id=GOOGLE_SHEET_ID)
_chef_request_repo = GoogleSheetsChefRequestRepo(sheet_id=GOOGLE_SHEET_ID)
_order_repo = PostgresOrderRepo()


def get_component_repo() -> GoogleSheetsComponentRepo:
    return _component_repo


def get_chef_request_repo() -> GoogleSheetsChefRequestRepo:
    return _chef_request_repo


def get_order_repo() -> PostgresOrderRepo:
    return _order_repo
