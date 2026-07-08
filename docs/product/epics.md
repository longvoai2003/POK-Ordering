# Epics — PureOrganic Meal Builder Migration

## Overview

This document defines the top-level work packages for migrating the PureOrganic
Instagram Deterministic Meal Builder from n8n to a scalable, testable Python
backend.

Each epic is a self-contained deliverable that can be planned, sized, and
delivered incrementally.

---

## Epic Status Summary

| Epic | Name | Status | Primary Files |
|---|---|---|---|
| E1 | Inbound Message Handling | ✅ Done | `normalizer.py`, `dedup.py`, `staleness.py`, `gate.py` |
| E2 | Session Management | ✅ Done | `session_service.py`, `session_repo.py`, `customer_store.py` |
| E3 | AI Intake Routing (Maya) | ✅ Done | `routing.py`, `llm_service.py`, `agent.py`, `dispatch.py` |
| E4 | Category-Based Menu Browsing | ✅ Done | `category_browser.py`, `reply_formatter.py`, `browsing.py` |
| E5 | Personalized Recommendations | ⏭ Deferred | Not started — optional future enhancement |
| E6 | Ingredient Selection Parsing | ✅ Absorbed into E4 | rapidfuzz fuzzy matching in `parse_player_input()` |
| E7.1 | Meal Draft Display | ✅ Done | `format_meal_draft()` in `reply_formatter.py` |
| E7.2 | Post-Draft Portion Customization | ❌ Discarded | Replaced by E8 single-category edit flow |
| E7-F | Macro Calculation | ⏸ Deferred | Listed as future enhancement in E7 scope |
| E8 | Order Review & Final Details | 🔨 In Progress | Dispatch stubs exist, flow not wired |
| E9 | Chef Request Creation | 🔨 Not Started | `chef_request.py` model exists, no logic |
| E10 | Integrations Layer | 🔨 In Progress | `manychats.py` partial, `component_repo.py` stub |
| E11 | Observability | 🔨 Partial | Structured logging exists, replay tool not started |
| E12 | Testing | 🔨 Partial | 203 unit tests, 0 contract tests, 0 conversation tests |

---

## Completed Epics

### Epic E1 — Inbound Message Handling ✅

**Goal:** Normalize incoming ManyChat / Instagram webhook payloads into a
single canonical event format and eliminate duplicates before they enter the
system.

**Scope (done):**
- Two inbound webhooks: new message, final-details & order-confirmation.
- Normalize ManyChat fields into `InboundMessage`.
- Deduplicate by `platform_message_id`.
- Handle stale sessions: when an inbound message arrives after the session
  TTL has elapsed, restart the ManyChat ordering flow. The stale event itself
  is still processed — it triggers a flow restart rather than being silently dropped.
- Append to inbound message log.

**Key files:** `src/domain/normalizer.py`, `src/domain/dedup.py`, `src/domain/staleness.py`, `src/services/gate.py`

**Dependencies:** None (entry point).

---

### Epic E2 — Session Management ✅

**Goal:** Create, read, update, expire, and resume customer meal-building
sessions consistently.

**Scope (done):**
- Load active session by `session_id` or `customer_id`.
- Detect expired sessions (30 min TTL).
- Merge incoming profile data into session.
- Persist session after every decision branch.
- Support session lookup for order review and final-details flows.

**Key files:** `src/services/session_service.py`, `src/adapters/session_repo.py`, `src/domain/customer_store.py`, `src/adapters/customer_sheets.py`

**Dependencies:** E1.

---

### Epic E3 — AI Intake Routing (Maya Agent) ✅

**Goal:** Use an LLM to classify customer intent, extract profile fields, and
choose exactly one deterministic `next_action`.

**Scope (done):**
- Build `agent_input` from normalized message + session state.
- Call Anthropic Claude (Haiku 4.5) with structured output parser.
- Enforce intake parser schema.
- Extract `customer_type`, `intent`, `extracted_fields`, `next_action`,
  `reply_text`, `routing_reason`, `routing_signals`.
- Validate agent output (fallback on parse failure).

**Key files:** `src/domain/routing.py`, `src/services/llm_service.py`, `src/models/agent.py`, `src/services/dispatch.py`

**Boundary:**
Maya is a routing/intake agent **only**.
It does NOT build recommendations, format menus, parse ingredient selections,
or call tools.

**Dependencies:** E1, E2.

---

### Epic E4 — Category-Based Menu Browsing ✅

**Goal:** Show each ingredient category one at a time in a fixed sequential
order (Base → Protein → Cooked Vegetables → Sauce → Toppings → Eggs →
Cooking Oils), with a 2-exchange per category paradigm: customer picks
ingredient → customer picks portion → auto-advance.

**Scope (done):**
- `parse_player_input` — 4-tier deterministic parser (skip → back → numeric
  → rapidfuzz fuzzy name match). No LLM needed.
- Sequential full browsing with `awaiting_portion` toggle.
- Portion input per category during browsing (2-exchange flow).
- Optional categories can be skipped. Required categories cannot.
- "Go back" navigates to previous category.
- Auto-select when only one option exists. Auto-skip when zero options.
- All categories exhausted → transition to `draft` + `format_meal_draft()`.
- Single-category edit mode (`single_edit`) for targeted edits from draft.

**Key files:** `src/domain/category_browser.py` (13 pure functions), `src/domain/reply_formatter.py` (9 functions), `src/services/browsing.py` (5 functions)

**Dependencies:** E2, E3.

---

### Epic E6 — Ingredient Selection Parsing (Absorbed into E4)

E6 was fully absorbed into E4 during implementation. The 4-tier deterministic
parser in `parse_player_input()` handles all selection parsing:
1. Skip phrases (`"skip"`, `"none"`, `"no thanks"`)
2. Back phrases (`"back"`, `"go back"`)
3. Numeric index (`"2"`)
4. Rapidfuzz fuzzy name match with conversational text (`"I want chicken please"`)

No separate selection LLM or multi-category parsing layer is needed.
LLM-based multi-category parsing is deferred to E5 if recommendations are
ever implemented.

---

---

## Current Epics — In Progress

### Epic E7.1 — Meal Draft Display ✅ *(completed subset)*

**Goal:** Build a `selected_meal` object from validated choices and display
a readable meal draft.

**Scope (done):**
- `selected_meal` constructed per-category during E4 browsing (2-exchange flow).
- `format_meal_draft()` shows all 7 categories with ingredient names and portions.
- Prompt includes "Customize" and "Confirm" options.
- Empty categories shown as `-`.

**Key files:** `src/domain/reply_formatter.py` (`format_meal_draft`)

---

### Epic E7.2 — Post-Draft Portion Customization ❌ *(discarded)*

**Status:** Discarded. Superseded by E8 single-category redo flow. When the
customer types "Customize" from the meal draft, the system now asks which
category to change and re-runs ingredient + portion selection for that category
only — a cleaner, simpler UX than walking through all categories adjusting
portion numbers.

*Original scope kept below for audit trail.*

**Scope (discarded):**
- Enter `customizing` state when customer says "Customize" from draft.
- Walk categories in display order, stopping only at `is_customizable = true`
  ingredients.
- Show current portion, min, max, step.
- Accept new portion, keep current, or skip.
- Non-customizable categories auto-skipped with notice.
- After all processed → recalculate macros, return to `draft`.

---

### Epic E7-F — Macro Calculation ⏸ *(deferred)*

Future enhancement per original E7 scope. Not started.

**Scope (deferred):**
- Calculate total calories, protein, carbs, fat.
- Optimize portion weights toward macro targets (hardcore customers).
- Recalculate macros after portion customization.

---

### Epic E8 — Order Review and Final Details

**Goal:** Collect delivery details, show the order summary, let the customer
confirm, edit the bowl via single-category redo, or edit personal information.

**Scope (done):**
- Final-details webhook normalization and parsing.
- Order-confirmation webhook normalization and parsing.
- `handle_final_details()` merges collected fields into session.
- `handle_order_confirm()` validates and routes confirm/edit/edit_info actions.

**Scope (remaining):**
- Wire `_handle_collect_details` dispatch stub → send ManyChat collect-details flow.
- Parse "Default"/"Confirm" reply from meal draft → trigger collect-details.
- **"Customize" from draft:** Add `edit_bowl` to Maya's NextAction + system prompt.
- **`_handle_edit_bowl` dispatch handler:** Set `EDITING_BOWL`, ask which category.
- **EDITING_BOWL pipeline guard:** Parse category name → `init_single_edit` → `browsing`(single_edit).
- **Single-edit completion → draft:** Portion entry, skip (keep current), or go back all return to `draft`.
- Full `draft → collecting → reviewing → done` chain.
- Order summary reply (meal draft + collected fields).
- Handle `confirm_order`, `edit_custom_bowl`, `edit_personal_info` actions
  from order review webhook.

**Dependencies:** E2, E7.1, E10 stubs.

---

### Epic E9 — Chef Request Creation

**Goal:** Create a structured chef request record after explicit customer
order confirmation and all details are collected.

**Scope (done):**
- `ChefRequest` Pydantic model defined.
- `ChefRequestRepo` ABC interface placeholder.

**Scope (remaining):**
- Validate request readiness (session, meal, final details all present).
- Build chef request record with all fields.
- Append to Chef Requests sheet.
- Reply with request ID to customer.

**Gate:** Chef request MUST only be created after explicit `confirm_order`.

**Dependencies:** E2, E7.1, E8.

---

### Epic E10 — Integrations Layer

**Goal:** Encapsulate all external service calls behind clean adapters so
domain logic never touches transport details.

**Scope (done):**
- `send_reply(subscriber_id, reply_text)` — ManyChat setCustomFields for AI Reply.
- `touch_interaction(subscriber_id)` — set is_ordering + last_interaction_at.
- `restart_ordering_flow(subscriber_id)` — restart ManyChat ordering flow.
- `get_last_interaction_at(subscriber_id)` — query subscriber info.
- `PostgresSessionRepo` — create, get_by_id, get_by_customer_id, update.
- `GoogleSheetsCustomerStore` — get, upsert, delete.
- `GoogleSheetsComponentRepo` — ABC interface + Google Sheets impl (lazy `_sheet` property needs completion).
- Anthropic chat adapter (via langchain).

**Scope (remaining):**
- Wire dispatch stubs to adapters:
  - `_handle_question` → `send_reply(subscriber_id, maya.reply_text)`.
  - `_handle_fallback` → `send_reply(subscriber_id, maya.reply_text)`.
  - `_handle_collect_details` → trigger ManyChat detail-collection flow.
  - `_handle_support` → admin notification + handoff reply.
- Complete `GoogleSheetsComponentRepo._sheet` lazy gspread initialization
  (same pattern as `customer_sheets.py`).
- ManyChat sendFlow adapter for collect-details.
- Chef request Google Sheets adapter.

**Dependencies:** None (plumbing, built alongside domain epics).

---

### Epic E11 — Observability and Admin Debugging

**Goal:** Provide enough logging, tracing, and replay to debug production
conversations without needing the n8n canvas.

**Scope (done):**
- Structured JSON logging via `logging_config.py`.
- LLM prompt and response logging with session context.
- Error tracking with session context.

**Scope (remaining):**
- Session state snapshots per step.
- Agent output debug fields in structured format.
- Replay tool: resubmit a message against a saved session state.

**Dependencies:** E1–E4 (minimal) for useful traces.

---

### Epic E12 — Testing and Quality Gates

**Goal:** Build a test suite that runs without n8n.

**Scope (done):**
- 203 unit tests covering domain functions, services, models, and adapters.
- State machine transition tests.
- Macro model tests.
- LLM routing tests (mocked).
- Pipeline gate tests (normalize + dedup).

**Scope (remaining):**
- Contract tests for inbound/outbound payload schemas.
- Conversation scenario tests (simulate full paths: TS-2.5, TS-6b.12, etc.).
- Chef request creation tests.
- Portion customization tests (when E7.2 is enabled).
- Macro calculation correctness tests (when E7-F is enabled).

**Dependencies:** E1–E9 (test as each epic lands).

---

---

## Future Development

Epics in this section are optional and deferred. They may be implemented
later based on customer demand or business needs.

### Epic E5 — Personalized Ingredient Recommendations (Deferred)

**Goal:** Build ingredient recommendations filtered by customer goals,
allergies, dietary style, avoided ingredients, preferences, customer type,
and macro visibility.

**Status:** Not started. Marked optional in original epics.md. The initial
ordering flow ships using E4 deterministic category browsing without
personalized recommendation ranking.

**Scope (future):**
- Load live Components.
- Filter by constraints.
- Rank options.
- Return `recommended_ingredients` per category.
- Save for deterministic validation.

**Boundary:**
The Recommendation Agent owns filtering/ranking, not Maya.
Maya only routes to `next_action = show_ingredient_choices`.

**Dependencies:** E2, E3.

### Epic E7.2 — Post-Draft Portion Customization ❌ *(discarded)*

See description under Current Epics. Superseded by E8 single-category edit flow.

### Epic E7-F — Macro Calculation & Optimization (Deferred)

See description under Current Epics. Listed as future enhancement in original E7 scope.

---

## Epic Dependency Graph

```
Completed:
  E1 (Inbound Handling) ─► E2 (Session Mgmt)
                                └─► E3 (AI Routing)
                                     └─► E4 (Category Browsing) + E6 (absorbed)
                                          └─► E7.1 (Meal Draft) ✅

In Progress:
  E7.1 ─► E10 stubs ─► E8 (Order Review + edit_bowl wiring)
                             └─► E9 (Chef Request)
  E10 (Integrations) ──── built alongside E1–E9
  E11 (Observability) ── built alongside E1+
  E12 (Testing) ──────── built alongside E1+

Deferred:
  E5 (Recommendations)
  E7-F (Macro Calculation)
```

---

## Implementation Order

```
Now  → E10 dispatch stubs          (wire _handle_question, _handle_fallback,
                                     _handle_collect_details, _handle_support)
       │
Then → E10 _sheet fix              (GoogleSheetsComponentRepo lazy gspread)
       │
Then → E8 edit_bowl wiring          (draft → editing_bowl → browsing(single_edit) → draft,
                                     Maya edit_bowl action, pipeline guard)
       │
Then → E8 Order Review              (draft→collecting→reviewing→done chain,
                                     confirm/edit/edit_info)
       │
Then → E9 Chef Request             (validate, build, persist, reply)
       │
Never→ E5 Recommendations          (optional enhancement)
```
