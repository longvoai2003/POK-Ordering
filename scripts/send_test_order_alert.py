#!/usr/bin/env python3
"""Send test order alerts to Telegram to verify all dishes appear correctly.

Usage: .venv/bin/python scripts/send_test_order_alert.py

Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.models.chef_request import ChefRequest
from src.adapters.telegram import send_telegram_alert


def format_order_alert(chef_request: ChefRequest, total: float) -> str:
    def _opt(name: str, portion: float) -> str:
        return f"{name} ({portion}g)" if name else "\u2014"

    return (
        f"<b>\U0001f6d2 New Order (Test)</b>\n\n"
        f"<b>ID:</b> {chef_request.request_id[:8]}\n"
        f"<b>Customer:</b> {chef_request.full_name}\n"
        f"<b>Phone:</b> {chef_request.phone_number}\n"
        f"<b>Address:</b> {chef_request.delivery_address}\n"
        f"<b>Time:</b> {chef_request.delivery_time}\n\n"
        f"<b>Base:</b> {chef_request.selected_base} ({chef_request.base_portion}g)\n"
        f"<b>Protein:</b> {chef_request.selected_protein} ({chef_request.protein_portion}g)\n"
        f"<b>Veg:</b> {chef_request.selected_cook_veg} ({chef_request.cook_veg_portion}g)\n"
        f"<b>Raw Veg:</b> {_opt(chef_request.selected_raw_veg, chef_request.raw_veg_portion)}\n"
        f"<b>Sauce:</b> {chef_request.selected_sauce} ({chef_request.sauce_portion}ml)\n"
        f"<b>Topping:</b> {_opt(chef_request.selected_topping, chef_request.topping_portion)}\n"
        f"<b>Egg:</b> {_opt(chef_request.selected_egg, chef_request.egg_portion)}\n"
        f"<b>Oil:</b> {_opt(chef_request.selected_cooking_oil, chef_request.cooking_oil_portion)}\n"
        f"\n<b>Total:</b> {int(total):,} VND"
    )


async def main() -> None:
    # ── Test 1: Full bowl — every category populated ──

    full_order = ChefRequest(
        full_name="Test Customer",
        phone_number="555-1234",
        delivery_address="123 Test St, District 1, HCMC",
        delivery_time="Today 7:00 PM",
        selected_base="Steamed Rice",
        base_portion=200.0,
        selected_protein="Grass-fed Ground Beef",
        protein_portion=200.0,
        selected_cook_veg="Steamed Broccoli",
        cook_veg_portion=150.0,
        selected_raw_veg="Organic Cucumber",
        raw_veg_portion=100.0,
        selected_sauce="Teriyaki Sauce",
        sauce_portion=30.0,
        selected_topping="Parmigiano Reggiano",
        topping_portion=15.0,
        selected_egg="Boiled Egg",
        egg_portion=1.0,
        selected_cooking_oil="Extra Virgin Olive Oil",
        cooking_oil_portion=12.0,
    )

    alert1 = format_order_alert(full_order, 185000)
    print("── Sending FULL bowl alert ──")
    print(alert1)
    print()
    await send_telegram_alert(alert1)
    print("Sent!\n")

    # ── Test 2: Minimal bowl — only required categories ──

    minimal_order = ChefRequest(
        full_name="Minimal Customer",
        phone_number="555-0000",
        delivery_address="999 Nowhere Ln",
        delivery_time="Tomorrow 12:00 PM",
        selected_base="Sweet Potato",
        base_portion=100.0,
        selected_protein="Chicken Breast",
        protein_portion=150.0,
        selected_cook_veg="Steamed Carrots",
        cook_veg_portion=100.0,
        selected_sauce="Chili Sauce",
        sauce_portion=30.0,
    )

    alert2 = format_order_alert(minimal_order, 95000)
    print("── Sending MINIMAL bowl alert (empty optionals → —) ──")
    print(alert2)
    print()
    await send_telegram_alert(alert2)
    print("Sent!\n")

    print("Done — check your Telegram chat.")


if __name__ == "__main__":
    asyncio.run(main())
