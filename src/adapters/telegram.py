import logging
import httpx
from src.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"

_test_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    if _test_client is not None:
        return _test_client
    return httpx.AsyncClient(timeout=httpx.Timeout(10.0))


def set_test_client(client: httpx.AsyncClient) -> None:
    global _test_client
    _test_client = client


def reset_test_client() -> None:
    global _test_client
    _test_client = None


async def send_telegram_alert(text: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    try:
        client = _get_client()
        await client.post(
            f"{TELEGRAM_API}/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
        )
    except Exception:
        logger.exception("telegram_alert_failed")
