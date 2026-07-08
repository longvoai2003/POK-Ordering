# Use Cases — PureOrganic Meal Builder

Each use case is a complete business-level interaction.
They are derived from the n8n workflow branches in `json_workflow/debug.json`.

## Status Legend

| Marker | Meaning |
|---|---|
| ✅ | Implemented and tested |
| 🔨 | Partially implemented |
| ⏸ | Deferred |
| ⏭ | Not started (future) |

---

## UC1 — Start Meal Conversation ✅

| Field | Value |
|---|---|
| **Actor** | Customer (Instagram / ManyChat) |
| **Trigger** | Customer sends first message ("hi", "I want a bowl", etc.) |
| **Pre-condition** | No active session exists, or an old session exists |
| **Main Flow** | 1. System normalizes inbound message<br>2. System looks up active session — none found<br>3. System builds agent input from message only<br>4. Maya classifies intent, extracts any profile hints<br>5. Maya returns `next_action`:<br>&nbsp;&nbsp;&nbsp;— `ask_question` if intake is incomplete<br>&nbsp;&nbsp;&nbsp;— `show_category_menu` if intake is complete<br>6. System saves new session |
| **Post-condition** | Active session created, customer receives reply |

---

## UC2 — Browse Ingredient Category (Sequential) ✅

| Field | Value |
|---|---|
| **Actor** | Customer |
| **Trigger** | Customer asks to see menu ("show menu", "I want to build a bowl") |
| **Pre-condition** | Active session exists |
| **Main Flow** | 1. Maya routes to `show_category_menu`<br>2. System sets `current_category = "base"` (first in order)<br>3. System loads Components for all categories<br>4. **2-exchange per category:** Show ingredient options (names only, no grams)<br>5. Customer picks ingredient → portion prompt shown<br>6. Customer enters portion → saved, auto-advance to next<br>7. Repeat steps 5–6 until all categories exhausted<br>8. After last category handled, system shows meal draft |
| **Category Order** | Base → Protein → Cooked Vegetables → Sauce → Toppings → Eggs → Cooking Oils |
| **Required Categories** | Base, Protein, Cooked Vegetables, Sauce — customer must select one from each |
| **Optional Categories** | Toppings, Eggs, Cooking Oils — customer can skip with "skip" / "none" |
| **Alternate Flow 5a** | Customer skips optional category → saved as empty, auto-advance (no portion prompt) |
| **Alternate Flow 5b** | Customer tries to skip required category → blocked, must select |
| **Alternate Flow 6a** | Only one option in category → auto-selected, still prompted for portion |
| **Alternate Flow 6b** | No options available for category → skipped with notice, auto-advance |
| **Alternate Flow 6c** | Customer says "go back" / "previous" → returns to earlier category, re-shows ingredient options |
| **Parsing** | Deterministic 4-tier parser (skip → back → numeric → rapidfuzz fuzzy). No LLM needed. |
| **Post-condition** | All categories processed, `selected_meal` built with portions, ready for meal draft |

---

## UC3 — Request Personalized Bowl ⏭

Deferred. Optional future enhancement (E5). Not needed for initial production.

| Field | Value |
|---|---|
| **Actor** | Customer |
| **Trigger** | Customer gives preferences ("I'm keto", "high protein", "no dairy") |
| **Pre-condition** | Active session with intake fields partially or fully collected |
| **Post-condition** | Recommended ingredients saved, ready for selection |

---

## UC4 — Select Ingredients ✅ (Absorbed into UC2)

Selection parsing is handled by E4's deterministic `parse_player_input()` function.
No separate selection UC needed. The 4-tier parser handles:
- Numeric selection ("2" → option 2)
- Fuzzy name match ("I want chicken" → "Chicken Breast")
- Skip phrases ("skip", "none")
- Back phrases ("go back", "previous")

Ambiguous name matches and "chef choice" features are deferred to E5 (personalized
recommendations path, if ever implemented).

---

## UC5 — Edit Bowl Draft (Targeted Single-Category) 🔨

Domain logic exists (`init_single_edit`, `exit_single_edit`). Now being wired
through E8 `edit_bowl` Maya action + pipeline guard.

| Field | Value |
|---|---|
| **Actor** | Customer |
| **Trigger** | Customer types "Customize" from meal draft, or says "change sauce" etc. |
| **Pre-condition** | `selected_meal` exists, session state = `draft` |
| **Main Flow** | 1. Maya routes to `edit_bowl`<br>2. System asks "Which category would you like to change?"<br>3. Customer picks a category (by name, number, or label — fuzzy matched)<br>4. System enters `editing_bowl`, then `browsing` with `browse_mode = "single_edit"`<br>5. System shows only that category's options with current selection highlighted as `(current)`<br>6. Customer picks a new option (by number or name) → 2-exchange: portion prompt → enter portion<br>7. System updates `selected_meal[category]`<br>8. System returns to `draft` and shows updated draft |
| **Alternate Flow 3a** | Customer changes their mind / says "never mind" — return to draft, no changes |
| **Alternate Flow 6a** | Customer says "skip" / "keep current" — return to draft, no change |
| **Post-condition** | Updated `selected_meal`, session back at `draft` |

---

## UC6 — View Meal Draft ✅

| Field | Value |
|---|---|
| **Actor** | Customer |
| **Trigger** | All categories exhausted in E4 browsing |
| **Pre-condition** | `selected_meal` complete with portions |
| **Main Flow** | 1. System formats meal by category with ingredient names and portions<br>2. System shows empty categories as `-`<br>3. System includes prompt: "Reply 'Customize' to adjust portions, or 'Confirm' to proceed."<br>4. System moves session to `draft` |
| **Alternate Flow 4a** | Customer chooses "Confirm" → proceed to `collecting` (UC7, 🔨 partially wired) |
| **Alternate Flow 4b** | Customer chooses "Customize" → single-category edit (UC5, 🔨) |
| **Post-condition** | Customer sees draft with options to customize or proceed |

---

## UC7 — Collect Final Details 🔨

| Field | Value |
|---|---|
| **Actor** | Customer |
| **Trigger** | System routes to `send_collect_details_flow` after meal draft confirmation |
| **Pre-condition** | `selected_meal` complete, session active |
| **Main Flow** | 1. System sends ManyChat collect-details flow<br>2. Customer fills name, address, phone<br>3. ManyChat webhook sends final details to system ✅<br>4. System normalizes final details ✅<br>5. System looks up active session ✅<br>6. System merges final details into session ✅<br>7. System moves session to `reviewing` ✅ |
| **Remaining** | Step 1 (trigger ManyChat flow from `_handle_collect_details` stub) |
| **Post-condition** | Delivery details collected, ready for review |

---

## UC8 — Confirm Order 🔨

| Field | Value |
|---|---|
| **Actor** | Customer |
| **Trigger** | Customer clicks "Confirm Order" in ManyChat review flow |
| **Pre-condition** | Session in `reviewing` state |
| **Main Flow** | 1. ManyChat sends `confirm_order` webhook ✅<br>2. System normalizes action ✅<br>3. System loads active session ✅<br>4. Validates: session active + selected meal complete + final details present<br>5. All valid → system proceeds to chef request creation (UC10, ⏭ E9)<br>6. System replies with confirmation and request ID |
| **Remaining** | Steps 4–6 (validation + chef request creation) |
| **Post-condition** | Order confirmed, chef request created |

---

## UC9 — Handoff to Support 🔨

| Field | Value |
|---|---|
| **Actor** | Customer / Support |
| **Trigger** | Customer asks something outside bot scope or Maya routes `handoff_to_support` |
| **Pre-condition** | Active session |
| **Main Flow** | 1. Maya routes to `handoff_to_support` ✅<br>2. System builds admin support message with session context<br>3. System notifies admin<br>4. System replies to customer with handoff message |
| **Remaining** | Steps 2–4 (`_handle_support` dispatch stub) |
| **Post-condition** | Support loop engaged, session preserved for context |

---

## UC10 — Chef Receives Request ⏭

Not started. Deferred to E9.

| Field | Value |
|---|---|
| **Actor** | Chef / Admin |
| **Trigger** | Order confirmed (UC8) and chef request created |
| **Pre-condition** | All validations passed |
| **Post-condition** | Chef request visible to kitchen team |

---

## UC11 — Session Inactivity Timeout ✅

| Field | Value |
|---|---|
| **Actor** | System |
| **Trigger** | Session `last_message_timestamp` exceeds 30 min TTL |
| **Pre-condition** | Existing session |
| **Main Flow** | 1. Customer sends new message after >30 min<br>2. System fetches subscriber's `ig_last_interaction` from ManyChat<br>3. System detects session expired (last interaction > TTL)<br>4. System fires `restart_ordering_flow` to restart the ManyChat ordering UI<br>5. System treats message as new conversation start (UC1) |
| **Post-condition** | ManyChat ordering flow restarted, new session created |

---

## UC12 — Customize Portions ❌ *(discarded)*

Discarded — E7.2. Superseded by UC5 (Edit Bowl Draft — single-category redo).
When the customer wants to change their bowl, the system now asks which category
to change and re-runs ingredient + portion selection for that one category.

*Original scope kept below for audit trail.*

| Field | Value |
|---|---|
| **Actor** | Customer |
| **Trigger** | Meal draft shown, system prompts "Customize" or "Confirm" |
| **Pre-condition** | `selected_meal` complete with portions, session state = `draft` |
| **Main Flow** | (See user-stories.md E7-S4 through E7-S6) |
| **Post-condition** | Updated `selected_meal` with custom portions, back at `draft` |

---

## Use Case Mapping to Epics (with Status)

| Use Case | Epic | Status |
|---|---|---|
| UC1 — Start Meal Conversation | E1, E2, E3 | ✅ |
| UC2 — Browse Ingredient Category | E4 | ✅ |
| UC3 — Request Personalized Bowl | E5 | ⏭ Deferred |
| UC4 — Select Ingredients | E4 (absorbed) | ✅ Absorbed |
| UC5 — Edit Bowl Draft | E4, E8 (single_edit mode + edit_bowl wiring) | 🔨 Wired via edit_bowl |
| UC6 — View Meal Draft | E7.1 | ✅ |
| UC7 — Collect Final Details | E8 | 🔨 Partially wired |
| UC8 — Confirm Order | E8, E9 | 🔨 Webhook done, E9 pending |
| UC9 — Handoff to Support | E3, E10 | 🔨 Dispatch stub |
| UC10 — Chef Receives Request | E9 | ⏭ Not started |
| UC11 — Session Timeout | E2 | ✅ |
| UC12 — Customize Portions | E7.2 | ❌ Discarded |
