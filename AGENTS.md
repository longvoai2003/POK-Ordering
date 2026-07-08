# AGENTS.md — PureOrganic Meal Builder

## Project

A Python backend (FastAPI) + React/Next.js frontend that lets customers
build custom organic bowls through a web interface and order for delivery.

**Architecture:**
1. Customer visits the React SPA at `/build`.
2. Menu data loaded from backend `GET /api/menu` (sourced from Google Sheets).
3. Customer builds bowl by selecting ingredients and portions across 8 categories.
4. Delivery details collected, payment method chosen (VietQR or COD).
5. Order created via `POST /api/orders` → persisted to Postgres + Google Sheets.
6. Payment page shows VietQR code (NAPAS-compliant) or COD confirmation.
7. Telegram staff alert sent on each new order.

**Key architecture rules:**
- The website is stateless request/response — no session state machine.
- No LLM/AI agent involved in the website flow.
- All menu/ingredient data is deterministic, sourced from Google Sheets.
- Google Sheets remains the admin-friendly menu management UI.

---

## Implementation Status

| Epic | Name | Status |
|---|---|---|
| W1 | Website Frontend (React/Next.js) | ✅ Done |
| W2 | Menu API (`GET /api/menu`) | ✅ Done |
| W3 | Order Creation API (`POST /api/orders`) | ✅ Done |
| W4 | Order Status + Payment Confirmation API | ✅ Done |
| W5 | Frontend ↔ Backend Integration | ✅ Done |
| W6 | Postgres Orders Schema | 🔨 Next |
| W7 | Testing & Hardening | 🔨 Partial |

**Deprecated / Removed:**
| Epic | Name | Status |
|---|---|---|
| E1–E12 | ManyChat/Instagram Chatbot Pipeline | 🗑 Removed |
| — | Session state machine | 🗑 Removed |
| — | LLM/Maya intake routing | 🗑 Removed |
| — | ManyChat webhooks | 🗑 Removed |
| — | Instagram webhooks | 🗑 Removed |

---

## Tech Stack

- **Backend:** Python 3.13+, FastAPI
- **Frontend:** React 19, Next.js 16, TypeScript, Tailwind CSS, framer-motion
- **Typing:** Pydantic v2 for all backend data models
- **Persistence:** Postgres (primary) / Google Sheets (menu source + audit log)
- **Integrations:** Google Sheets API, Telegram Bot API
- **Payment:** VietQR (NAPAS-compliant QR generation, CRC-16 checksum)
- **Testing:** pytest, pytest-asyncio, httpx (backend) / Next.js build (frontend)

---

## Database

### Postgres (Primary)

#### Active tables

**`orders`** — website order records (new, replacing in-memory dict)

```
orders
├── order_id            TEXT PK        (PO-XXXXXX-ABCD)
├── channel             TEXT           DEFAULT 'website'
├── status              TEXT           DEFAULT 'pending'  (pending | paid | cancelled)
├── payment_method      TEXT           DEFAULT 'vietqr'   (vietqr | cod)
├── total_price         NUMERIC(12,0)
├── full_name           TEXT
├── phone               TEXT
├── address             TEXT
├── notes               TEXT           DEFAULT ''
├── total_calories      NUMERIC(8,1)
├── total_protein       NUMERIC(8,1)
├── total_carbs         NUMERIC(8,1)
├── total_fat           NUMERIC(8,1)
├── qr_url              TEXT           nullable
├── paid_at             TIMESTAMPTZ    nullable
├── created_at          TIMESTAMPTZ    DEFAULT now()
└── updated_at          TIMESTAMPTZ    DEFAULT now()
```

**`order_items`** — one row per selected category per order

```
order_items
├── order_id        TEXT           FK → orders(order_id)
├── category         TEXT           (base, protein, cook_veg, ...)
├── component_id     TEXT
├── component_name   TEXT           denormalized for queries
├── portion          NUMERIC(6,1)
├── unit             TEXT           DEFAULT 'g'
├── cost             NUMERIC(12,0)
└── PRIMARY KEY (order_id, category)
```

Indexes: `idx_orders_status`, `idx_orders_created`, `idx_order_items_order`

#### Deprecated tables

**`sessions`** — chatbot state machine sessions. Kept for historical audit.
Not used by the website. No new rows inserted. May be dropped in a future
migration after confirming no active chatbot sessions remain.

### Google Sheets (Menu + Audit)

The menu source of truth lives in a Google Sheet. The backend caches
component data (TTL 60s) via `GoogleSheetsComponentRepo`.

**`Components` tab** — one row per ingredient. Fields:

| Column | Example | Notes |
|---|---|---|
| `component_id` | `base_brown_rice` | Stable key |
| `component_name` | `Brown Rice` | Display name |
| `category` | `base` | One of 8 categories |
| `available` | `TRUE` | Toggle on/off |
| `default_portion` | `200` | Default serving |
| `portion` | `200` | Base portion for nutrition calc |
| `unit` | `g` | g, ml, or count |
| `calories`, `protein`, `carbs`, `fat`, `fiber` | per `portion` | Absolute values |
| `cost` | `8000` | Base price in VND |
| `min_portion`, `max_portion`, `step` | customizable range | 0 if fixed |
| `skip_portion` | `FALSE` | TRUE for fixed-price items |
| `description`, `kitchen_notes` | Free text | |
| `dietary_tags` | `vegan,gluten-free` | Comma-separated |
| `active` | `TRUE` | Must be TRUE to appear |

**`Chef_Requests` tab** — order audit log. Every website order also writes
a row here via `GoogleSheetsChefRequestRepo.create()`. Used as a secondary
backup and for kitchen staff review.

**`Customers` tab** — customer profiles. Currently read-only for the website
(potential future use for returning customers).

---

## API Endpoints

All website endpoints are in `src/api/website.py` (mounted at `/api`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/menu` | All components grouped by category |
| `GET` | `/api/menu/{category}` | Components for one category |
| `POST` | `/api/orders` | Create order (validate, price, persist, QR, alert) |
| `GET` | `/api/orders/{order_id}` | Order status + payment info |
| `POST` | `/api/orders/{order_id}/confirm-payment` | Mark order as paid |
| `GET` | `/health` | Health check |
| `GET` | `/payment/qr/{request_id}` | Serve QR PNG image |
| `GET` | `/docs` | OpenAPI docs |

### Order Creation Flow

```
POST /api/orders
  → Validate meal (required categories, portions in range)
  → Look up component prices from GoogleSheetsComponentRepo
  → Calculate total price (portion-scaled from component.cost)
  → Calculate macros (portion-scaled from component nutrition)
  → Build ChefRequest model
  → Persist to Google Sheets (audit log) via GoogleSheetsChefRequestRepo
  → If vietqr: generate VietQR code + save PNG to static/qr/
  → Store in-memory (will be replaced by Postgres orders table)
  → Send Telegram staff alert
  → Return {order_id, total_price, qr_url, bank_details, status}
```

---

## Project Structure

```
chatbot/
├── AGENTS.md
├── pyproject.toml
├── Makefile
├── .env.example
├── frontend/                              # React/Next.js SPA
│   ├── .env.local
│   ├── next.config.ts
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   ├── page.tsx                   # Landing page
│       │   ├── build/page.tsx             # Bowl builder
│       │   ├── details/page.tsx           # Delivery form
│       │   ├── review/page.tsx            # Order review
│       │   └── payment/page.tsx           # VietQR / COD
│       ├── components/
│       │   ├── CategorySection.tsx
│       │   ├── IngredientCard.tsx
│       │   ├── SnappingSlider.tsx
│       │   └── BowlSummary.tsx
│       └── lib/
│           ├── types.ts
│           ├── constants.ts
│           ├── mock-data.ts               # Fallback when API unavailable
│           ├── pricing.ts
│           ├── order-storage.ts           # localStorage cache (transitional)
│           ├── api-client.ts              # Base fetch wrapper
│           └── api.ts                     # Typed API functions
├── migrations/
│   ├── 001_sessions.sql                   # [DEPRECATED] chatbot sessions
│   ├── 002_optional_menu.sql              # [DEPRECATED]
│   ├── 002_sessions_index.sql             # [DEPRECATED]
│   └── 003_website_orders.sql             # [ACTIVE] orders + order_items
├── docs/product/                          # Historical product docs (preserved)
├── apps/instagram/                        # [DEPRECATED] IG webhook stubs
├── json_workflow/                         # [DEPRECATED] n8n reference
└── src/
    ├── main.py                            # FastAPI app, CORS, health, QR serve
    ├── config.py                          # env vars, constants
    ├── logging_config.py
    ├── api/
    │   ├── __init__.py
    │   └── website.py                     # All /api/* website endpoints
    ├── models/
    │   ├── __init__.py
    │   ├── component.py                   # Component (shared)
    │   ├── chef_request.py                # ChefRequest (shared, from_session + to_row)
    │   ├── website.py                     # Website request/response models
    │   ├── order.py                        # [NEW] Order + OrderItem models
    │   └── [DEPRECATED] session.py, message.py, agent.py, customer.py
    ├── domain/
    │   ├── contracts/
    │   │   ├── component_repo.py          # ComponentRepo ABC (shared)
    │   │   ├── chef_request_repo.py       # ChefRequestRepo ABC (shared)
    │   │   └── order_repo.py              # [NEW] OrderRepo ABC
    │   └── core/
    │       ├── payment.py                 # VietQR generation (shared)
    │       ├── pricing.py                 # calculate_order_price, fmt_price (shared)
    │       └── [DEPRECATED] state_machine.py, routing.py, category_browser.py, reply_formatter.py
    ├── adapters/
    │   ├── component_repo.py              # GoogleSheetsComponentRepo (shared)
    │   ├── chef_request_sheets.py         # GoogleSheetsChefRequestRepo (shared)
    │   ├── telegram.py                    # send_telegram_alert (shared)
    │   ├── order_repo.py                   # [NEW] PostgresOrderRepo
    │   └── [DEPRECATED] manychat.py, session_repo.py, customer_sheets.py, inbound_log.py
    ├── services/                          # [DEPRECATED] chatbot pipeline
    │   └── [DEPRECATED] pipeline.py, session_service.py, llm_service.py, ...
    └── [DEPRECATED] domain/guards/        # [DEPRECATED] chatbot validation
```

---

## Constants

All defined in `src/config.py`:

```python
# Categories
CATEGORY_DISPLAY_ORDER = [
    "base", "protein", "cook_veg", "sauce",
    "raw_veg", "topping", "egg", "cooking_oil",
]

REQUIRED_CATEGORIES = ["base", "protein", "cook_veg", "sauce"]
OPTIONAL_CATEGORIES = ["raw_veg", "topping", "egg", "cooking_oil"]

CATEGORY_LABELS = {
    "base": "Base", "protein": "Protein",
    "cook_veg": "Cooked Vegetables", "raw_veg": "Raw Vegetables",
    "sauce": "Sauce", "topping": "Toppings",
    "egg": "Eggs", "cooking_oil": "Cooking Oils",
}

CATEGORIES_WITH_FIXED_PRICE = {"topping", "sauce", "cooking_oil"}

# Google Sheets
GOOGLE_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS  # from env

# Postgres
DATABASE_URL = "postgresql://pureorganic:pureorganic@localhost:5432/pureorganic"

# Payment (VietQR / NAPAS)
BANK_NAME, BANK_BIN, BANK_ACCOUNT, BANK_ACCOUNT_NAME  # from env

# Staff alerts (Telegram)
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  # from env
```

---

## Data Models (Pydantic)

### Component (`src/models/component.py`) — Shared

```python
class Component(BaseModel):
    component_id: str
    component_name: str
    category: str
    is_available: bool = True
    default_portion: float
    unit: str                         # "g", "ml", "count"
    calories: float                   # absolute per default_portion
    protein: float
    carbs: float
    fat: float
    fiber: float
    dietary_tags: list[str]
    min_portion: float
    max_portion: float
    portion_step: float
    description: str
    cost: float                       # base price in VND
    kitchen_notes: str
    skip_portion: bool
```

Nutrition values are stored as absolute amounts per `default_portion`,
normalized from the sheet on load: `sheet_value × (default_portion / portion)`.

### ChefRequest (`src/models/chef_request.py`) — Shared

8 ingredient+portion pairs, macros, customer info, delivery details.
`from_session(session)` factory method (used by chatbot, preserved).
`to_row()` serializes for Google Sheets "Chef_Requests" tab.

### Website Models (`src/models/website.py`) — Website Only

- `ComponentResponse` — menu API response model
- `MealItem` — `{component_id, portion}`
- `DeliveryInfo` — `{full_name, phone, address, notes, payment_method}`
- `CreateOrderRequest` / `CreateOrderResponse`
- `OrderStatusResponse`

### Order Models (`src/models/order.py`) — New

- `Order` — maps to `orders` table
- `OrderItem` — maps to `order_items` table, one per category

---

## Business Rules

### Category Structure

8 categories in fixed display order:
1. **Base** (required) — rice, quinoa, cauliflower
2. **Protein** (required) — chicken, tofu, salmon, beef
3. **Cooked Vegetables** (required) — broccoli, spinach, zucchini
4. **Sauce** (required, fixed price) — teriyaki, peanut, soy ginger
5. **Raw Vegetables** (optional) — avocado, cucumber
6. **Toppings** (optional, fixed price) — sesame seeds, almonds
7. **Eggs** (optional) — soft-boiled, poached
8. **Cooking Oils** (optional, fixed price) — olive oil

### Pricing

- Adjustable categories (base, protein, cook_veg, raw_veg, egg):
  `price = component.cost × (selected_portion / default_portion)`
- Fixed-price categories (sauce, topping, cooking_oil):
  `price = component.cost` (one-tap, no slider)
- Total displayed in VND, formatted via `fmt_price()`.

### Portion Validation

- Required categories must have a selection.
- Portion must be within `[min_portion, max_portion]` when `min_portion > 0`.
- Fixed-price items (min_portion = 0, max_portion = 0) use default_portion.

### Payment Methods

- **VietQR:** QR code generated via NAPAS spec (EMVCo QR, TLV encoding, CRC-16).
  PNG saved to `static/qr/{order_id}.png`. Customer scans with banking app.
- **COD:** Cash on delivery. No QR generated. Customer pays on arrival.

### Staff Alerts

Every new order and payment confirmation sends a formatted Telegram message
to the configured `TELEGRAM_CHAT_ID`. Uses `send_telegram_alert()` from
`src/adapters/telegram.py`.

---

## Test Commands

```bash
# Run all backend tests
.venv/bin/pytest tests/ -v

# Unit tests only (pure functions + services with mocks, no I/O)
.venv/bin/pytest tests/unit/ -v

# Integration tests (real Postgres + Google Sheets)
.venv/bin/pytest tests/integration/ -v

# With coverage
.venv/bin/pytest --cov=src --cov-report=term-missing

# Frontend build verification
cd frontend && npm run build
```

---

## Rules for AI Coding Agents

1. **Never resurrect deprecated chatbot code.** The ManyChat/Instagram/LLM
   pipeline is permanently removed. Do not re-import or re-create it.
2. **Website is stateless.** No session machine. No LLM. No ManyChat flows.
3. **Domain logic must be pure functions** — no HTTP calls, no DB calls,
   no file I/O inside `src/domain/`.
4. **All I/O goes through `src/adapters/`** with clear interfaces
   (defined in `src/domain/contracts/`).
5. **Use Pydantic models** for all data crossing boundaries.
6. **Google Sheets is the menu source of truth.** Components are cached
   (60s TTL) and refreshed on demand.
7. **Postgres is the orders source of truth.** Every order goes to `orders`
   + `order_items` tables (and Google Sheets as audit backup).
8. **Nutrition values are absolute per `default_portion`**, not per-gram.
   Multiply by `portion / default_portion` when calculating macros.
9. **Log structured events** — every step logs order_id, action, and result.
10. **All port numbers and module names must not conflict.**
    Check existing code before adding new files.
11. **Frontend API calls go through `src/lib/api.ts`** — never raw `fetch()`.
12. **Do NOT modify deprecated files** — they exist for historical reference only.
    New code goes in new files or in the shared infrastructure files listed above.
