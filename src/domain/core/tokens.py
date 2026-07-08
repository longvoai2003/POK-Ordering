import hashlib
import hmac
import time
from src.config import STAFF_PASSWORD, STAFF_TOKEN_TTL_SEC


def sign_staff_token() -> str:
    now = int(time.time())
    ts = str(now)
    expiry = str(now + STAFF_TOKEN_TTL_SEC)
    payload = f"{ts}:{expiry}"
    sig = hmac.new(
        STAFF_PASSWORD.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{sig}"


def verify_staff_token(token: str) -> bool:
    if not STAFF_PASSWORD:
        return False
    parts = token.rsplit(":", 1)
    if len(parts) != 2:
        return False
    payload, sig = parts
    expected_sig = hmac.new(
        STAFF_PASSWORD.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return False
    payload_parts = payload.split(":")
    if len(payload_parts) != 2:
        return False
    expiry = int(payload_parts[1])
    return int(time.time()) < expiry
