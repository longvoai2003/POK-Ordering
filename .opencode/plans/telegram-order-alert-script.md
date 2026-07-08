# Script: Send Test Order Alert to Telegram

## Goal
Create `scripts/send_test_order_alert.py` — a standalone script that sends real Telegram messages to verify all 8 dish categories appear correctly in the order alert.

## File
`scripts/send_test_order_alert.py` (NEW — `scripts/` already exists with `test_instagram.py`)

## What it does
- Constructs `ChefRequest` objects directly (no session needed)
- Formats alerts using the same layout as `_send_order_alert` in `src/services/reviewing.py`
- Calls `send_telegram_alert()` from `src/adapters/telegram.py` to actually hit the Telegram API

## Two test cases
1. **Full bowl**: All 8 categories populated (Rice, Beef, Broccoli, Cucumber, Teriyaki, Parmigiano, Egg, Olive Oil) + customer details, 185,000 VND
2. **Minimal bowl**: Only 4 required categories (Sweet Potato, Chicken, Carrots, Chili), empty optionals show `—`, 95,000 VND

## Dependencies
- `src.models.chef_request.ChefRequest`
- `src.adapters.telegram.send_telegram_alert`
- No source code changes needed

## Usage
```bash
.venv/bin/python scripts/send_test_order_alert.py
```
Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`.

## Edge cases
- If env vars not set, `send_telegram_alert` is a silent no-op (prints to console only)
- Unicode emoji (🛒) and HTML bold tags — Telegram `parse_mode: "HTML"` handles both
- Empty optional fields render as em-dash `—`
