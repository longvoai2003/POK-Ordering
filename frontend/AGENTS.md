# AGENTS.md — PureOrganic Frontend

## Project

A React/Next.js single-page application that lets customers build custom
organic bowls and order for delivery. Uses Tailwind CSS and framer-motion
for styling and animations.

## Stack

- React 19, Next.js 16 (Turbopack), TypeScript
- Tailwind CSS v4, framer-motion
- Deployed as a static SPA (no server-side rendering needed)
- API calls to FastAPI backend at `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`)

## Routes

| Path | Page | Purpose |
|---|---|---|
| `/` | Landing page | CTA → `/build` |
| `/build` | Bowl builder | 8 categories, snapping sliders, pricing |
| `/details` | Delivery form | Name, phone, address, payment method |
| `/review` | Order review | Summary + confirm → POST /api/orders |
| `/payment` | Payment | VietQR / COD, confirmation |

## Component Tree

```
layout.tsx
├── page.tsx                      # Landing
├── build/page.tsx                # Builder
│   ├── CategorySection.tsx       # One per category
│   │   ├── IngredientCard.tsx    # One per ingredient
│   │   └── SnappingSlider.tsx    # Portion slider (non-fixed)
│   └── BowlSummary.tsx           # Sticky bottom/sidebar
├── details/page.tsx              # Delivery form
├── review/page.tsx               # Order review
└── payment/page.tsx              # Payment
```

## Data Flow

### Menu Loading

```
/build mounts
  → fetchMenu() → GET /api/menu
  → Success: setMenuData(response.categories)
  → Failure: fallback to MOCK_COMPONENTS (offline mode)
```

### Order Creation

```
/build: Continue
  → saves meal + totalPrice to localStorage (transitional)

/details: Submit delivery form
  → saves DeliveryDetails to localStorage (transitional)

/review: Confirm Order
  → build CreateOrderPayload from localStorage
  → createOrder(payload) → POST /api/orders
  → success: router.push(`/payment?order_id=${response.order_id}`)

/payment: Mount
  → read order_id from URL params
  → getOrder(order_id) → GET /api/orders/{order_id}
  → display QR or COD screen
  → "I have paid": confirmPayment(order_id) → POST /confirm-payment
```

### LocalStorage (Transitional)

The `order-storage.ts` module is a **transitional** cache. It's kept so:
- Users can navigate between `/build`, `/details`, `/review` without losing state.
- If the API is unavailable, mock data still works.

Eventually, when the backend has a proper order draft endpoint, localStorage
can be removed entirely.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/types.ts` | `Component`, `SelectedIngredient`, `Meal`, `Macros` |
| `src/lib/constants.ts` | `CATEGORY_DISPLAY_ORDER`, `CATEGORY_LABELS`, etc. |
| `src/lib/mock-data.ts` | Fallback menu data |
| `src/lib/pricing.ts` | `calculateIngredientPrice`, `formatVnd` |
| `src/lib/api-client.ts` | Base fetch wrapper with error handling |
| `src/lib/api.ts` | Typed API functions (`fetchMenu`, `createOrder`, etc.) |
| `src/lib/order-storage.ts` | localStorage cache (transitional) |

## Design Tokens

- **Background:** `#fbf7ea` (cream/warm off-white)
- **Card background:** `#fffdf6` (warm white)
- **Primary green:** `#2f6f2d` (deep organic green)
- **Primary text:** `#1f321b` (dark forest)
- **Secondary text:** `#536342` (olive)
- **Border:** `#cfc39f` (warm beige)
- **Accent yellow:** `#fff8da` (pale gold, for price highlights)
- **Roundness:** `rounded-2xl` / `rounded-3xl` (soft, organic)

## Rules

1. **All API calls go through `src/lib/api.ts`** — never raw `fetch()`.
2. **Use `NEXT_PUBLIC_API_BASE`** env var for the backend URL.
3. **Mock data is fallback only** — always try the API first.
4. **Keep client components lean.** Extract pure logic to `src/lib/`.
5. **No auth.** The website is guest-only. No login, no sessions.
6. **Follow existing patterns.** CategorySection, IngredientCard, and
   SnappingSlider are the component templates to follow.
