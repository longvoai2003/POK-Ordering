# User Stories — PureOrganic Meal Builder

Each story maps to an Epic and a Use Case. Stories are sized so one can be
developed and tested in a sprint.

## Status Legend

| Marker | Meaning |
|---|---|
| ✅ | Implemented and tested |
| 🔨 | Partially implemented |
| ⏸ | Deferred |
| ⏭ | Not started |

---

## Epic E1 — Inbound Message Handling ✅

### E1-S1 — Normalize ManyChat Webhook ✅
Normalize incoming ManyChat webhook payloads into `InboundMessage`.
- `sender_id`, `customer_id`, `session_id` extracted.
- `message_text`, `message_type`, `channel` normalized.
- `platform_message_id` preserved. `timestamp` in ISO-8601.
- `raw_payload` attached for debugging.

### E1-S2 — Deduplicate Messages ✅
Drop duplicate inbound messages by `platform_message_id`.
- If already seen → drop silently.
- If missing → generate from `sender_id + timestamp`.

### E1-S3 — Handle Stale Sessions (Restart Flow) ✅
Detect stale sessions (>30 min TTL) and restart ManyChat ordering flow.
- Fire-and-forget `restart_ordering_flow`.
- Inbound message still processed normally.

---

## Epic E2 — Session Management ✅

### E2-S1 — Create Session ✅
Create new session when no active session found.
- `session_id` generated from subscriber ID.
- All fields initialized with defaults.

### E2-S2 — Load Active Session ✅
Load existing session by `session_id` or `customer_id`.
- Query by `session_id` first, fallback to `customer_id`.
- Pick most recent active one.

### E2-S3 — Detect Expired Session ✅
Mark sessions expired when `last_message_timestamp` > 30 min.
- Never mutate an expired session.

### E2-S4 — Persist Session After Every Branch ✅
Save session after routing, menu display, selection, draft, review.
- All session fields saved including `selected_meal`, timestamps.

### E2-S5 — Session ID Propagation ✅
Propagate `session_id` and `customer_id` through all pipeline stages.

---

## Epic E3 — AI Intake Routing ✅

### E3-S1 — Build Agent Input ✅
Build structured `agent_input` from normalized message + session state.

### E3-S2 — Call Anthropic Chat Model ✅
Send `agent_input` to Claude Haiku 4.5 with Maya system prompt.

### E3-S3 — Parse Agent Output ✅
Parse LLM response into `MayaOutput` structured schema.
- On parse failure → `next_action = fallback`.

### E3-S4 — Validate Agent State ✅
Validate agent output consistency with session context.

---

## Epic E4 — Category-Based Menu Browsing (Sequential) ✅

### E4-S1 — Start Sequential Category Flow ✅
Show ingredient categories one at a time in fixed order.
- `show_category_menu` starts at Base (position 0).
- Reply shows only current category options (names only, no grams).
- Reply < 1500 chars. Session state = `browsing`.

### E4-S2 — Ingredient Selection Prompts Portion, Then Auto-Advances ✅
**2-exchange per category:** pick ingredient → portion prompt → enter portion → advance.
- `awaiting_portion` toggles between steps.
- Selection saved with default portion, then validated portion saved.
- `category_position` increments, `handled_categories` grows.
- Rapidfuzz fuzzy matching handles typos, partial names, word reordering, filler text.

### E4-S2b — Portion Validation During Browsing ✅
Validate portion input against min, max, and step constraints.
- Below min → error. Above max → error. Wrong step → error with valid options.
- Non-numeric → error. Invalid input → re-show, don't advance.

### E4-S3 — Skip Optional Categories ✅
Skip topping, egg, oil with "skip"/"none"/"no thanks".
- Saved empty in `selected_meal`. Auto-advance.

### E4-S4 — Block Skip on Required Categories ✅
Required: base, protein, cooked_vegetable, sauce — cannot be skipped.
- "X is required. Please pick one:" — re-show same category.

### E4-S5 — Go Back to Previous Category ✅
"go back"/"previous"/"change X" → navigate to previous category.
- Reset `awaiting_portion`, re-show ingredient options.

### E4-S6 — Auto-Select Single-Option Categories ✅
Exactly 1 available → auto-select, then prompt for portion.
- "Only one {category} available: {name}. Auto-selected."

### E4-S7 — Auto-Skip Empty Categories ✅
0 available → skip with notice, auto-advance. Applies to both req/optional.

### E4-S8 — Detect All Categories Exhausted ✅
After last category → `draft`, show `format_meal_draft()`.

### E4-S9 — Resume After Interruption ✅
If Maya reroutes mid-browse → session goes `active`, position preserved.
- "continue"/"back to my bowl" → resume from saved position.

### E4-S10 — Targeted Single-Category Edit (from Meal Draft) ✅
Domain logic exists; not yet wired from draft UI (E8 pending).
- `browse_mode = "single_edit"`, shows one category with `(current)` marker.
- New selection → update `selected_meal[category]`, return to `draft`.
- "keep current"/"cancel" → no change, return to `draft`.

---

## Epic E5 — Personalized Recommendations ⏭

Deferred. Optional future enhancement. Not needed for initial production.

See original `epics.md` for full stories (E5-S1 through E5-S4).

---

## Epic E6 — Ingredient Selection Parsing ✅ (Absorbed into E4)

All selection parsing is handled by E4's deterministic `parse_player_input()`:

| Original E6 Story | How it's handled |
|---|---|
| E6-S1 (Build parser input) | `parse_player_input(text, options, session)` — options from `get_current_options` |
| E6-S2 (Parse by number) | Tier 3: `re.search(r"\d+", cleaned)` → index - 1 |
| E6-S3 (Parse by name) | Tier 4: rapidfuzz `max(partial_ratio, token_set_ratio)` with cutoff 70 |
| E6-S4 (Chef choice) | Deferred to E5 |
| E6-S5 (Validate against options) | Implicit — `parse_player_input` only matches within provided `options` list |
| E6-S6 (Detect complete selection) | `is_browsing_complete()` + `_show_current_or_draft()` |

No separate selection LLM or multi-category parser is needed.

---

## Epic E7 — Meal Draft and Portion Customization

### E7-S1 — Build Selected Meal Object ✅
Build `selected_meal` from chosen indexes during E4 browsing.
- Each category has `[{component_id, component_name, portion, unit}]`.
- All categories present (even if empty).

### E7-S2 — Build Meal Draft Reply ✅
`format_meal_draft()` shows all 7 categories with ingredient names and portions.
- Empty categories shown as `-`.
- Reply < 1500 chars.
- Includes prompt: "Reply 'Customize' to adjust portions, or 'Confirm' to proceed."

### E7-S3 — Prompt Customize vs Default After Draft ✅
Included in `format_meal_draft()` output.
- "Default"/"Confirm" → proceed to `collecting` (🔨 partially wired).
- "Customize" → enter `editing_bowl` (E8 single-category redo).

### E7-S4 — Sequential Portion Customization ❌
Discarded — E7.2. Superseded by E8 single-category redo flow.

### E7-S5 — Portion Validation ❌
Discarded — E7.2.

### E7-S6 — Finalize Customization ❌
Discarded — E7.2.

---

## Future Enhancement — Macro Calculation ⏸

### E7-F1 — Calculate Total Macros ⏸
`total_calories = sum(component.calories * (portion / default_portion))`.
Deferred with E7.2.

### E7-F2 — Optimize Portions Toward Macro Targets ⏸
Hardcore macro customer optimization. Deferred.

### E7-F3 — Finalize Customization and Recalculate ⏸
Recalculate macros once at the end. Deferred.

---

## Epic E8 — Order Review and Final Details 🔨

### E8-S1 — Build Order Summary 🔨
Show full order summary (ingredients + delivery details).
- Can reuse `format_meal_draft()` + collected fields.

### E8-S2 — Send ManyChat Review Fields 🔨
Push order summary to ManyChat via `setCustomFields`.
- `send_reply()` exists and can be reused.

### E8-S3 — Collect Final Delivery Details 🔨
ManyChat collect-details form flow.
- `_handle_collect_details` dispatch stub needs wiring to ManyChat sendFlow.

### E8-S4 — Handle Final Details Webhook ✅
Normalize, load session, merge fields, move to `reviewing`.

### E8-S5 — Handle Order Review Actions 🔨
- `confirm_order` → validate, create chef request (E9).
- `edit_custom_bowl` → `editing_bowl` (domain logic exists, not wired).
- `edit_personal_info` → re-send collect form (⏸ deferred).

### E8-S6 — Maya Routes "Customize" to edit_bowl 🔨
Add `edit_bowl` to `NextAction` literal and Maya's system prompt.
- Maya recognizes "Customize", "change protein", "swap sauce", "I want different base", etc.
- `reply_text` empty — the system handles the prompt.
- `routing_signals.asks_to_change_selection = true`.

### E8-S7 — _handle_edit_bowl Asks Which Category 🔨
Dispatch handler sets `session_status = EDITING_BOWL`, replies:
"Which category would you like to change?
Base, Protein, Cooked Vegetables, Sauce, Toppings, Eggs, Cooking Oils"

### E8-S8 — Pipeline Routes EDITING_BOWL → Single-Edit 🔨
Pipeline guard for `EDITING_BOWL` state:
- Parse customer's category name (numeric index, fuzzy name, fuzzy label).
- If unrecognized → re-ask "Which category?".
- If recognized → `init_single_edit(session, category)`, `validate_transition(EDITING_BOWL, BROWSING)`, `session_status = BROWSING`.
- Show category options with `(current)` marker, "skip" means "keep current".

### E8-S9 — Single-Edit Completion Returns to Draft 🔨
After browsing in `single_edit` mode:
- Portion entry → `exit_single_edit` → `session_status = DRAFT` → show revised draft.
- "Skip" / "keep current" → `exit_single_edit` → `DRAFT` (no change).
- "Go back" → `exit_single_edit` → `DRAFT` (no change, treated as cancel).
- Hide "Type 'back'" hint in single_edit mode (`format_category_options`).
- Change skip hint to "Type 'skip' to keep your current selection." for single_edit.

---

## Epic E9 — Chef Request Creation ⏭

Not started. Full scope in original `epics.md`.

### E9-S1 — Validate Request Readiness ⏭
### E9-S2 — Build Chef Request Record ⏭
### E9-S3 — Persist Chef Request to Sheets ⏭
### E9-S4 — Reply with Confirmation ⏭

---

## Epic E10 — Integrations 🔨

### E10-S1 — ManyChat Set Custom Fields Adapter ✅
`send_reply(subscriber_id, reply_text)` — fire-and-forget setCustomFields.
`touch_interaction(subscriber_id)` — set is_ordering + last_interaction_at.

### E10-S2 — ManyChat Send Flow Adapter 🔨
`restart_ordering_flow()` exists. `send_collect_details_flow()` not yet implemented.

### E10-S3 — Google Sheets Read/Write Adapter 🔨
`GoogleSheetsCustomerStore` ✅. `GoogleSheetsComponentRepo` (missing `_sheet` lazy init).

### E10-S4 — Anthropic Chat Adapter ✅
Via langchain `ChatAnthropic` with structured output parser.

### E10-S5 — Session Repository (Persistence Adapter) ✅
`PostgresSessionRepo` — create, get_by_id, get_by_customer_id, update.

---

## Epic E11 — Observability 🔨

### E11-S1 — Structured Event Logging ✅
JSON logging via `logging_config.py`. Session ID in every log entry.

### E11-S2 — LLM Prompt and Response Logging ✅
Logged with session context in `llm_service.py`.

### E11-S3 — Session State Snapshots 🔨
Not yet implemented. Replay tool not started.

---

## Epic E12 — Testing 🔨

### E12-S1 — Unit Tests for Pure Domain Functions ✅
203 tests covering all domain functions, services, models, and adapters.

### E12-S2 — Contract Tests for Payloads 🔨
Not yet implemented. Inbound payload validation tested via normalizer tests.

### E12-S3 — Conversation Scenario Tests 🔨
Not yet implemented. Integration webhook tests exist but need `_sheet` fix.

---

## Story-Epic Mapping Summary (with Status)

| Epic | Status | Stories | Done |
|---|---|---|---|
| E1 | ✅ | S1, S2, S3 | 3/3 |
| E2 | ✅ | S1, S2, S3, S4, S5 | 5/5 |
| E3 | ✅ | S1, S2, S3, S4 | 4/4 |
| E4 | ✅ | S1, S2, S2b, S3, S4, S5, S6, S7, S8, S9, S10 | 11/11 |
| E5 | ⏭ | S1, S2, S3, S4 | 0/4 (deferred) |
| E6 | ✅ | Absorbed into E4 | n/a |
| E7.1 | ✅ | S1, S2, S3 | 3/3 |
| E7.2 | ❌ | S4, S5, S6 | 0/3 (discarded) |
| E7-F | ⏸ | F1, F2, F3 | 0/3 (deferred) |
| E8 | 🔨 | S1, S2, S3, S4, S5, S6, S7, S8, S9 | 1/9 (webhook done) |
| E9 | ⏭ | S1, S2, S3, S4 | 0/4 |
| E10 | 🔨 | S1, S2, S3, S4, S5 | 3/5 (stubs remaining) |
| E11 | 🔨 | S1, S2, S3 | 2/3 |
| E12 | 🔨 | S1, S2, S3 | 1/3 |
