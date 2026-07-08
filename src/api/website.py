import logging
import os
import secrets
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from src.adapters.chef_request_sheets import GoogleSheetsChefRequestRepo
from src.adapters.component_repo import GoogleSheetsComponentRepo
from src.adapters.order_repo import PostgresOrderRepo
from src.adapters.telegram import send_telegram_alert
from src.deps import get_chef_request_repo, get_component_repo, get_order_repo
from src.config import (
    BANK_ACCOUNT,
    BANK_ACCOUNT_NAME,
    BANK_BIN,
    BANK_NAME,
    CATEGORY_DISPLAY_ORDER,
    CATEGORY_LABELS,
    CATEGORIES_WITH_FIXED_PRICE,
    REQUIRED_CATEGORIES,
)

from src.domain.core.payment import generate_vietqr, save_qr_png
from src.domain.core.pricing import fmt_price
from src.models.component import Component
from src.models.order import Order, OrderItem
from src.models.website import (
    ComponentResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    DeliveryInfo,
    MealItem,
    OrderStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ── Component helpers ──────────────────────────────────────────────────


def _component_to_response(c: Component) -> ComponentResponse:
    return ComponentResponse(
        component_id=c.component_id,
        component_name=c.component_name,
        category=c.category,
        is_available=c.is_available,
        default_portion=c.default_portion,
        unit=c.unit,
        calories=c.calories,
        protein=c.protein,
        carbs=c.carbs,
        fat=c.fat,
        fiber=c.fiber,
        min_portion=c.min_portion,
        max_portion=c.max_portion,
        portion_step=c.portion_step,
        description=c.description,
        cost=c.cost,
        skip_portion=c.skip_portion,
    )


# ── Menu endpoints ─────────────────────────────────────────────────────


@router.get("/menu")
async def get_menu(
    repo: GoogleSheetsComponentRepo = Depends(get_component_repo),
) -> dict:
    components = await repo.get_all()
    grouped: dict[str, list[ComponentResponse]] = {}
    for cat in CATEGORY_DISPLAY_ORDER:
        items = [_component_to_response(c) for c in components if c.category == cat]
        grouped[cat] = items
    return {"categories": grouped}


@router.get("/menu/{category}")
async def get_menu_category(
    category: str,
    repo: GoogleSheetsComponentRepo = Depends(get_component_repo),
) -> list[ComponentResponse]:
    if category not in CATEGORY_DISPLAY_ORDER:
        raise HTTPException(status_code=404, detail=f"Unknown category: {category}")
    components = await repo.get_by_category(category)
    return [_component_to_response(c) for c in components]


# ── Order helpers ──────────────────────────────────────────────────────


def _generate_order_id() -> str:
    ts = str(int(time.time()))[-6:]
    suffix = secrets.token_hex(2).upper()
    return f"PO-{ts}-{suffix}"


def _validate_meal(
    meal: dict[str, Optional[list[MealItem]]],
    lookup: dict[str, Component],
) -> list[str]:
    errors: list[str] = []
    for cat in REQUIRED_CATEGORIES:
        items = meal.get(cat)
        if items is None or len(items) == 0:
            errors.append(f"Missing required category: {cat}")
    for cat, items in meal.items():
        if items is None:
            continue
        for item in items:
            comp = lookup.get(item.component_id)
            if comp is None:
                errors.append(f"Unknown component_id: {item.component_id}")
                continue
            if comp.category != cat:
                errors.append(
                    f"Component {comp.component_name!r} belongs to "
                    f"{CATEGORY_LABELS.get(comp.category, comp.category)!r}, "
                    f"not {CATEGORY_LABELS.get(cat, cat)!r}"
                )
                continue
            if not comp.is_available:
                errors.append(f"Component not available: {comp.component_name}")
            if cat in CATEGORIES_WITH_FIXED_PRICE:
                continue
            if comp.min_portion > 0 and item.portion < comp.min_portion:
                errors.append(
                    f"Portion {item.portion}{comp.unit} below minimum "
                    f"{comp.min_portion}{comp.unit} for {comp.component_name}"
                )
            if comp.max_portion > 0 and item.portion > comp.max_portion:
                errors.append(
                    f"Portion {item.portion}{comp.unit} above maximum "
                    f"{comp.max_portion}{comp.unit} for {comp.component_name}"
                )
    return errors


def _normalize_fixed_price_portions(
    meal: dict[str, Optional[list[MealItem]]],
    lookup: dict[str, Component],
) -> None:
    for cat in CATEGORIES_WITH_FIXED_PRICE:
        items = meal.get(cat)
        if items is None:
            continue
        for item in items:
            comp = lookup.get(item.component_id)
            if comp is not None and comp.default_portion > 0:
                item.portion = comp.default_portion


def _calculate_price(
    meal: dict[str, Optional[list[MealItem]]],
    lookup: dict[str, Component],
) -> float:
    total = 0.0
    for cat, items in meal.items():
        if items is None:
            continue
        for item in items:
            comp = lookup.get(item.component_id)
            if comp is None or comp.default_portion <= 0:
                continue
            if cat in CATEGORIES_WITH_FIXED_PRICE:
                total += comp.cost
            else:
                total += comp.cost * (item.portion / comp.default_portion)
    return total


def _format_telegram_message(
    order_id: str,
    meal: dict[str, Optional[list[MealItem]]],
    delivery: DeliveryInfo,
    lookup: dict[str, Component],
    total_price: float,
) -> str:
    lines = [
        "<b>New website order</b>",
        f"Order: <code>{order_id}</code>",
        f"Customer: {delivery.full_name} — {delivery.phone}",
        f"Address: {delivery.address}",
        f"Payment: {delivery.payment_method.upper()}",
        f"Total: {fmt_price(total_price)}",
        "",
        "<b>Bowl:</b>",
    ]
    for cat in CATEGORY_DISPLAY_ORDER:
        items = meal.get(cat)
        if items is None or len(items) == 0:
            continue
        label = CATEGORY_LABELS.get(cat, cat)
        cat_lines = []
        for item in items:
            comp = lookup.get(item.component_id)
            if comp is None:
                continue
            if cat in CATEGORIES_WITH_FIXED_PRICE:
                cat_lines.append(f"{comp.component_name} ({comp.unit})")
            else:
                cat_lines.append(
                    f"{comp.component_name} — {item.portion}{comp.unit}"
                )
        if cat_lines:
            lines.append(f"  {label}: {', '.join(cat_lines)}")
    if delivery.notes:
        lines.append(f"\nNotes: {delivery.notes}")
    return "\n".join(lines)


# ── Order endpoints ────────────────────────────────────────────────────


@router.post("/orders")
async def create_order(
    request: CreateOrderRequest,
    component_repo: GoogleSheetsComponentRepo = Depends(get_component_repo),
    chef_request_repo: GoogleSheetsChefRequestRepo = Depends(get_chef_request_repo),
    order_repo: PostgresOrderRepo = Depends(get_order_repo),
) -> CreateOrderResponse:
    order_id = _generate_order_id()

    components = await component_repo.get_all()
    lookup: dict[str, Component] = {c.component_id: c for c in components}

    errors = _validate_meal(request.meal, lookup)
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    _normalize_fixed_price_portions(request.meal, lookup)

    total_price = int(round(_calculate_price(request.meal, lookup)))
    total_calories = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0

    for items in request.meal.values():
        if items is None:
            continue
        for item in items:
            comp = lookup.get(item.component_id)
            if comp is None or comp.default_portion <= 0:
                continue
            ratio = item.portion / comp.default_portion
            total_calories += comp.calories * ratio
            total_protein += comp.protein * ratio
            total_carbs += comp.carbs * ratio
            total_fat += comp.fat * ratio

    order_items: list[OrderItem] = []
    for cat in CATEGORY_DISPLAY_ORDER:
        items = request.meal.get(cat)
        if items is None:
            continue
        for item in items:
            comp = lookup.get(item.component_id)
            if comp is None:
                continue
            order_items.append(
                OrderItem(
                    order_id=order_id,
                    category=cat,
                    component_id=comp.component_id,
                    component_name=comp.component_name,
                    portion=item.portion,
                    unit=comp.unit,
                    cost=comp.cost * (item.portion / comp.default_portion)
                    if comp.default_portion > 0
                    else comp.cost,
                )
            )

    qr_url: Optional[str] = None
    bank_details: Optional[dict[str, str]] = None

    if request.delivery.payment_method == "vietqr":
        qr_url = f"/payment/qr/{order_id}"
        bank_details = {
            "bank_name": BANK_NAME,
            "account_number": BANK_ACCOUNT,
            "account_name": BANK_ACCOUNT_NAME,
        }

    order = Order(
        order_id=order_id,
        channel="website",
        status="pending",
        payment_method=request.delivery.payment_method,
        total_price=total_price,
        full_name=request.delivery.full_name,
        phone=request.delivery.phone,
        address=request.delivery.address,
        notes=request.delivery.notes,
        total_calories=total_calories,
        total_protein=total_protein,
        total_carbs=total_carbs,
        total_fat=total_fat,
        qr_url=qr_url,
        items=order_items,
    )

    try:
        persisted = await order_repo.create(order)
    except Exception:
        logger.exception("Failed to persist order to Postgres")
        raise HTTPException(
            status_code=503, detail="Unable to create order. Please try again."
        )

    if persisted is None:
        existing = await order_repo.get_by_id(order_id)
        if existing is None:
            logger.error("Order conflict resolved but order not found: %s", order_id)
            raise HTTPException(
                status_code=503, detail="Unable to create order. Please try again."
            )
        bank_details = None
        if existing.payment_method == "vietqr":
            bank_details = {
                "bank_name": BANK_NAME,
                "account_number": BANK_ACCOUNT,
                "account_name": BANK_ACCOUNT_NAME,
            }
        return CreateOrderResponse(
            order_id=existing.order_id,
            total_price=existing.total_price,
            qr_url=existing.qr_url,
            bank_details=bank_details,
            status=existing.status,
        )

    if request.delivery.payment_method == "vietqr":
        try:
            qr_code = generate_vietqr(
                amount=total_price,
                bank_bin=BANK_BIN,
                account=BANK_ACCOUNT,
                note=order_id,
            )
            filename = f"{order_id}.png"
            os.makedirs("static/qr", exist_ok=True)
            save_qr_png(qr_code, "static/qr", filename)
        except Exception:
            logger.exception("VietQR generation failed")

    try:
        await chef_request_repo.create_order_audit(order)
    except Exception:
        logger.exception("Failed to persist order audit to sheets")

    try:
        alert_text = _format_telegram_message(
            order_id, request.meal, request.delivery, lookup, total_price
        )
        await send_telegram_alert(alert_text)
    except Exception:
        logger.exception("Telegram order alert failed")

    return CreateOrderResponse(
        order_id=order_id,
        total_price=total_price,
        qr_url=qr_url,
        bank_details=bank_details,
        status="pending",
    )


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    order_repo: PostgresOrderRepo = Depends(get_order_repo),
) -> OrderStatusResponse:
    order = await order_repo.get_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    meal: dict[str, Optional[list[MealItem]]] = {}
    for item in order.items:
        cat_items = meal.get(item.category)
        if cat_items is None:
            cat_items = []
            meal[item.category] = cat_items
        cat_items.append(
            MealItem(
                component_id=item.component_id,
                portion=item.portion,
            )
        )

    delivery = DeliveryInfo(
        full_name=order.full_name,
        phone=order.phone,
        address=order.address,
        notes=order.notes,
        payment_method=order.payment_method,  # type: ignore[arg-type]
    )

    bank_details = None
    if order.payment_method == "vietqr":
        bank_details = {
            "bank_name": BANK_NAME,
            "account_number": BANK_ACCOUNT,
            "account_name": BANK_ACCOUNT_NAME,
        }

    return OrderStatusResponse(
        order_id=order.order_id,
        status=order.status,
        total_price=order.total_price,
        qr_url=order.qr_url,
        bank_details=bank_details,
        delivery=delivery,
        meal=meal,
    )


@router.post("/orders/{order_id}/confirm-payment")
async def confirm_payment_endpoint(
    order_id: str,
    order_repo: PostgresOrderRepo = Depends(get_order_repo),
):
    order = await order_repo.get_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "paid":
        return {"order_id": order_id, "status": "paid", "message": "Already confirmed"}
    if order.status == "payment_pending":
        return {
            "order_id": order_id,
            "status": "payment_pending",
            "message": "Already submitted for verification",
        }

    if order.payment_method == "vietqr":
        await order_repo.update_status(order_id, "payment_pending")
        try:
            await send_telegram_alert(
                f"<b>💰 Customer claims payment</b>\n"
                f"Order: <code>{order_id}</code>\n"
                f"Customer: {order.full_name} — {order.phone}\n"
                f"Amount: {fmt_price(order.total_price)}\n"
                f"Status: <b>payment_pending</b> — verify and confirm"
            )
        except Exception:
            logger.exception("Telegram payment claim alert failed")
        return {
            "order_id": order_id,
            "status": "payment_pending",
            "message": "Payment submitted for verification. We'll confirm within 15 minutes.",
        }

    await order_repo.confirm_payment(order_id)
    try:
        await send_telegram_alert(
            f"<b>✅ COD order confirmed</b>\nOrder: <code>{order_id}</code>"
        )
    except Exception:
        logger.exception("Telegram COD confirmation alert failed")

    return {"order_id": order_id, "status": "paid", "message": "Order confirmed"}
