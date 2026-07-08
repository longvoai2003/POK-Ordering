import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from src.config import BANK_ACCOUNT, BANK_ACCOUNT_NAME, BANK_BIN, BANK_NAME
from src.deps import get_order_repo
from src.adapters.order_repo import PostgresOrderRepo
from src.adapters.telegram import send_telegram_alert
from src.domain.core.pricing import fmt_price
from src.domain.core.tokens import sign_staff_token, verify_staff_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/staff")


def _require_staff(authorization: str = Header(default="")) -> None:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.removeprefix("Bearer ").strip()
    if not verify_staff_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class LoginRequest:
    pass


class LoginResponse:
    pass


class StaffOrderItem:
    pass


class StaffOrderResponse:
    pass


class StaffOrderListResponse:
    pass


@router.post("/login")
async def staff_login(body: dict) -> dict:
    password = body.get("password", "")
    if not password:
        raise HTTPException(status_code=400, detail="Password required")
    from src.config import STAFF_PASSWORD

    if not STAFF_PASSWORD:
        raise HTTPException(status_code=500, detail="Staff password not configured")
    if password != STAFF_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"token": sign_staff_token()}


@router.get("/orders")
async def list_orders(
    status: str = Query(default="all"),
    q: str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    order_repo: PostgresOrderRepo = Depends(get_order_repo),
    _auth=Depends(_require_staff),
) -> dict:
    filters: dict[str, str] = {}
    if status != "all":
        filters["status"] = status

    rows = await order_repo.list_all(
        filters=filters,
        search=q.strip() if q else None,
        limit=limit,
        offset=offset,
    )
    total = await order_repo.count_all(
        filters=filters,
        search=q.strip() if q else None,
    )

    orders = []
    for order, total_price_vnd, items_summary in rows:
        orders.append(
            {
                "order_id": order.order_id,
                "status": order.status,
                "payment_method": order.payment_method,
                "total_price": order.total_price,
                "total_price_vnd": total_price_vnd,
                "full_name": order.full_name,
                "phone": order.phone,
                "address": order.address,
                "notes": order.notes,
                "total_calories": order.total_calories,
                "total_protein": order.total_protein,
                "total_carbs": order.total_carbs,
                "total_fat": order.total_fat,
                "items_summary": items_summary,
                "qr_url": order.qr_url,
                "paid_at": order.paid_at,
                "created_at": order.created_at,
            }
        )

    return {"orders": orders, "total": total, "limit": limit, "offset": offset}


@router.get("/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    order_repo: PostgresOrderRepo = Depends(get_order_repo),
    _auth=Depends(_require_staff),
) -> dict:
    order = await order_repo.get_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    items = []
    for item in order.items:
        comp = getattr(item, "component_name", "")
        items.append(
            {
                "category": item.category,
                "component_id": item.component_id,
                "component_name": item.component_name,
                "portion": item.portion,
                "unit": item.unit,
                "cost": item.cost,
            }
        )

    return {
        "order_id": order.order_id,
        "status": order.status,
        "payment_method": order.payment_method,
        "total_price": order.total_price,
        "total_price_vnd": fmt_price(order.total_price),
        "full_name": order.full_name,
        "phone": order.phone,
        "address": order.address,
        "notes": order.notes,
        "total_calories": order.total_calories,
        "total_protein": order.total_protein,
        "total_carbs": order.total_carbs,
        "total_fat": order.total_fat,
        "qr_url": order.qr_url,
        "paid_at": order.paid_at,
        "created_at": order.created_at,
        "items": items,
    }


@router.post("/orders/{order_id}/confirm")
async def staff_confirm_payment(
    order_id: str,
    order_repo: PostgresOrderRepo = Depends(get_order_repo),
    _auth=Depends(_require_staff),
) -> dict:
    order = await order_repo.get_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "paid":
        return {"order_id": order_id, "status": "paid", "message": "Already confirmed"}

    await order_repo.confirm_payment(order_id)

    try:
        await send_telegram_alert(
            f"<b>✅ Payment confirmed (staff)</b>\n"
            f"Order: <code>{order_id}</code>\n"
            f"Customer: {order.full_name} — {order.phone}\n"
            f"Amount: {fmt_price(order.total_price)}"
        )
    except Exception:
        logger.exception("Telegram payment confirmation alert failed")

    return {"order_id": order_id, "status": "paid", "message": "Payment confirmed"}
