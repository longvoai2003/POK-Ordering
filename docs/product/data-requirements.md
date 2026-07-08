# Data Requirements — PureOrganic Meal Builder

## Purpose

Define the data models, fields, types, and constraints needed to implement
the Python migration. This document is the single source of truth for data
shape before engineering starts.

## Implementation Status Legend

| Marker | Meaning |
|---|---|
| ✅ | Implemented |
| 🔨 | Partially implemented |
| ⏸ | Deferred (E7.2, E7-F) |
| ⏭ | Not started (E5, E9) |

---

## Component (Ingredient) Data Model ✅

Each ingredient in the Components sheet / database must have the following
fields.

| Field | Type | Required | Description |
|---|---|---|---|
| `component_id` | `string` | Yes | Unique identifier |
| `component_name` | `string` | Yes | Display name (e.g. "Brown Rice") |
| `category` | `string` | Yes | One of: base, protein, cooked_vegetable, sauce, topping, egg, cooking_oil |
| `is_available` | `boolean` | Yes | Whether this ingredient is currently in stock |
| `default_portion` | `number` | Yes | Default serving size (g or count) |
| `unit` | `string` | Yes | Typically "g", "ml", or "count" |
| `calories` | `number` | Yes | Calories per `default_portion` (absolute, not per-gram) |
| `protein` | `number` | Yes | Protein (g) per `default_portion` |
| `carbs` | `number` | Yes | Carbs (g) per `default_portion` |
| `fat` | `number` | Yes | Fat (g) per `default_portion` |
| `fiber` | `number` | Yes | Fiber (g) per `default_portion` |
| `cost` | `number` | No | Ingredient cost (VND) |
| `dietary_tags` | `array<string>` | No | Tags: "vegan", "keto", "paleo", "gluten-free", etc. |
| `allergen_tags` | `array<string>` | No | Tags: "peanuts", "shellfish", "dairy", "soy", etc. |
| `min_portion` | `number` | Yes | Minimum allowed portion (0 = not customizable) |
| `max_portion` | `number` | Yes | Maximum allowed portion |
| `portion_step` | `number` | Yes | Increment step (0 = not customizable) |
| `description` | `string` | No | Human-readable description |
| `kitchen_notes` | `string` | No | Internal kitchen notes |

**Nutrition values** are stored as absolute amounts per `default_portion`,
normalized from the sheet's `portion` column on load:
`sheet_value × (default_portion / portion)`.

**Customizability** is inferred: `min_portion > 0 and max_portion > min_portion`
implies the ingredient is customizable. No separate `is_customizable` or
`portion_type` fields needed.

### ComponentRepo Interface ✅

```python
class ComponentRepo(ABC):
    async def get_all(self) -> list[Component]: ...
    async def get_by_category(self, category: str) -> list[Component]: ...
    async def get_available(self) -> list[Component]: ...
    async def refresh(self) -> None: ...
```

---

## Session Data Model ✅

| Field | Type | Status | Description |
|---|---|---|---|
| `session_id` | `string` | ✅ | Unique session identifier |
| `customer_id` | `string` | ✅ | Customer identifier |
| `sender_id` | `string` | ✅ | Platform sender ID (ManyChat subscriber ID) |
| `channel` | `string` | ✅ | `"manychat"` or `"instagram"` |
| `session_status` | `SessionStatus` | ✅ | One of the state machine states (StrEnum, 14 values) |
| `intake_status` | `IntakeStatus` | ✅ | `"in_progress"` or `"complete"` |
| `customer_type` | `CustomerType` | ✅ | `"unknown"`, `"guided_custom"`, `"hardcore_macro_custom"` |
| `intent` | `string` | ✅ | Current classified intent |
| `collected_fields` | `dict` | ✅ | Customer profile fields (JSON) |
| `missing_fields` | `list[string]` | ✅ | Fields not yet collected |
| `selected_meal` | `dict[str, list[dict]]` | ✅ | Current meal per category: `{category: [{component_id, component_name, portion, unit}]}` |
| `recommended_ingredients` | `dict[str, list[dict]]` | ✅ | Shown options per category (reserved for E5) |
| `total_macros` | `Macros` | ✅ | Calculated totals: `{calories, protein, carbs, fat}` (defaults to 0) |
| `last_message_text` | `string` | ✅ | Last inbound message text |
| `last_reply_text` | `string` | ✅ | Last reply sent to customer |
| `last_message_id` | `string` | ✅ | Last inbound message ID |
| `last_message_timestamp` | `string` | ✅ | ISO-8601 timestamp |
| `next_action` | `string` | ✅ | Routing action from Maya |
| `created_at` | `string` | ✅ | ISO-8601 |
| `updated_at` | `string` | ✅ | ISO-8601 |

### Sequential browsing fields (E4) ✅

| Field | Type | Description |
|---|---|---|
| `current_category` | `string \| None` | Category currently being viewed |
| `next_category` | `string \| None` | Next category in display order |
| `category_position` | `int \| None` | Zero-based position in CATEGORY_DISPLAY_ORDER |
| `handled_categories` | `list[string]` | Categories already processed |
| `category_browse_mode` | `BrowseMode \| None` | `"sequential_full"` or `"single_edit"` |
| `awaiting_portion` | `boolean` | When `true`, session is in the portion-input step for the current category (2-exchange browsing) |

### Portion customization fields (E7.2 discarded) ❌

| Field | Type | Description |
|---|---|---|
| `customize_position` | `int \| None` | Zero-based position tracker during customization loop |
| `customize_current` | `string \| None` | Category currently being customized |

Both fields exist in the Session model but are unused. E7.2 was discarded in
favor of E8 `editing_bowl` single-category redo. These fields may be removed
in a future cleanup.

---

## Inbound Message Data Model ✅

| Field | Type | Description |
|---|---|---|
| `channel` | `string` | `"manychat"` or `"instagram"` |
| `sender_id` | `string` | Platform sender ID |
| `customer_id` | `string` | Customer ID |
| `session_id` | `string` | Session ID |
| `message_text` | `string` | Customer's message |
| `message_type` | `string` | `"text"`, `"button"`, etc. |
| `platform_message_id` | `string` | Unique per message (dedup key) |
| `timestamp` | `string` | ISO-8601 |
| `action` | `string` | ManyChat action (e.g. `"confirm_order"`) |
| `raw_payload` | `dict` | Full original payload |

---

## Maya Output Data Model (E3) ✅

| Field | Type | Description |
|---|---|---|
| `next_action` | `NextAction` | One of: `ask_question`, `show_category_menu`, `review_draft`, `edit_bowl`, `send_collect_details_flow`, `handoff_to_support`, `fallback` |
| `intent` | `string` | Classified intent |
| `reply_text` | `string` | Free-text reply (used for ask_question/fallback) |
| `routing_reason` | `string` | Why Maya chose this route |
| `customer_type` | `string` | `"unknown"` only (guided/hardcore deferred) |
| `extracted_fields` | `ExtractedFields` | Profile fields Maya extracted |
| `routing_signals` | `RoutingSignals` | Boolean flags from Maya |

---

## Chef Request Data Model ⏭

Model defined in `src/models/chef_request.py`. Implementation deferred to E9.

| Field | Type | Description |
|---|---|---|
| `request_id` | `string` | Unique request ID |
| `created_at` | `string` | ISO-8601 |
| `customer_id` | `string` | Customer ID |
| `channel` | `string` | Source channel |
| `customer_type` | `string` | Customer classification |
| `selected_base` | `string` | Base ingredient name |
| `base_grams` | `number` | Base portion in grams |
| `selected_protein` | `string` | Protein ingredient name |
| `protein_grams` | `number` | Protein portion in grams |
| `selected_cooked_vegetable` | `string` | Vegetable name |
| `cooked_vegetable_grams` | `number` | Vegetable portion |
| `selected_sauce` | `string` | Sauce name |
| `sauce_grams` | `number` | Sauce portion |
| `selected_topping` | `string` | Topping name (optional) |
| `topping_grams` | `number` | Topping portion |
| `target_calories` | `number` | Target calories |
| `target_protein` | `number` | Target protein (g) |
| `target_carbs` | `number` | Target carbs (g) |
| `target_fat` | `number` | Target fat (g) |
| `total_calories` | `number` | Actual calories |
| `total_protein` | `number` | Actual protein (g) |
| `total_carbs` | `number` | Actual carbs (g) |
| `total_fat` | `number` | Actual fat (g) |
| `macro_match_score` | `number` | Distance from targets |
| `allergies` | `string` | Customer allergies |
| `ingredients_to_avoid` | `string` | Avoided ingredients |
| `customer_notes` | `string` | Customer notes |
| `chef_notes` | `string` | Chef notes |
| `status` | `string` | `"pending"`, `"in_progress"`, `"completed"` |

---

## Constants ✅

```python
CATEGORY_DISPLAY_ORDER = [
    "base",
    "protein",
    "cooked_vegetable",
    "sauce",
    "topping",
    "egg",
    "cooking_oil",
]

REQUIRED_CATEGORIES = ["base", "protein", "cooked_vegetable", "sauce"]

OPTIONAL_CATEGORIES = ["topping", "egg", "cooking_oil"]

CATEGORY_LABELS = {
    "base": "Base",
    "protein": "Protein",
    "cooked_vegetable": "Cooked Vegetables",
    "sauce": "Sauce",
    "topping": "Toppings",
    "egg": "Eggs",
    "cooking_oil": "Cooking Oils",
}

SESSION_TTL_MS = 30 * 60 * 1000   # 30 minutes

MAX_REPLY_CHARS = 1500

FUZZY_SCORE_CUTOFF = 70           # rapidfuzz matching threshold
```
