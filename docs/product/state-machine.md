# Session State Machine — PureOrganic Meal Builder

## Purpose

Define every allowed session state, the events that cause transitions, and
which states are valid for each deterministic branch of the workflow.

This is the **source of truth** that the Python implementation must enforce.

## Implementation Status Legend

| Marker | Meaning |
|---|---|
| ✅ | Implemented and tested |
| 🔨 | Enum exists, transition logic not fully wired |
| ⏸ | State and transitions deferred (E7.2) |
| ⏭ | State unused (reserved for future) |

---

## States

| State | Status | Description | Allowed while in this state |
|---|---|---|---|
| `new` | ✅ | Session has never been created | n/a (entry state) |
| `active` | ✅ | Session exists, no current branch active | Any new message triggers routing |
| `browsing` | ✅ | System showing one category at a time (2-step per category: pick ingredient → pick portion). Sub-field `awaiting_portion` tracks which step. | Customer selects ingredient, enters portion, skips (optional), goes back |
| `selecting` | ⏭ | Personalized recommendations shown (optional future path) | Customer can select ingredients |
| `draft` | ✅ | Full meal selected, draft ready for review | Customer can customize (single-category redo), confirm, or edit |
| `customizing` | ❌ | Post-draft portion size walkthrough | Discarded — superseded by `editing_bowl` single-category redo |
| `collecting` | 🔨 | Collect-details flow sent | Waiting for ManyChat final-details webhook |
| `reviewing` | 🔨 | Order summary shown, review action requested | Waiting for confirm/edit/edit_info webhook |
| `editing_bowl` | 🔨 | Customer chose to edit a category from draft | Wiring via `edit_bowl` Maya action + pipeline guard (E8) |
| `editing_info` | ⏸ | Customer chose to edit personal info | Customer can update delivery details |
| `done` | ⏭ | Chef request successfully created | Terminal state — session can be archived |
| `support` | 🔨 | Support loop engaged | Admin handling, session preserved |
| `fallback` | ✅ | Agent output invalid or session mismatch | Recovery reply sent, session preserved |
| `expired` | ✅ | Session exceeded 30 min TTL | Next message starts fresh session |

---

## State Transition Diagram (text)

```
[new] ── first_message ─► [active]
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
      ✅ [browsing]      ⏭ [selecting]      🔨 [support]
              │
              │ (all categories exhausted)
              ▼
          ✅ [draft]
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
⏸ [customizing]  ⏸ [editing_bowl]  ⏸ [editing_info]
   │               │                    │
   ▼               ▼                    ▼
✅ [draft]      ✅ [draft]          🔨 [collecting]
                                          │
                                          ▼
                                     🔨 [reviewing]
                                          │
                                          ▼
                                     ⏭ [done]

[any] ── session_timeout ─► ✅ [expired]
[any] ── agent_mismatch  ─► ✅ [fallback] ─► ✅ [active]
```

Legend: ✅ implemented, 🔨 partial, ⏸ deferred, ⏭ not started.

---

## Transition Table

| From | Event / Condition | To | Status | Notes |
|---|---|---|---|---|
| `new` | First message received | `active` | ✅ | Create session |
| `active` | `next_action = show_category_menu` | `browsing` | ✅ | Start sequential category browsing from first category (base) |
| `active` | `next_action = show_ingredient_choices` | `selecting` | ⏭ | Personalized recs shown (optional future path) |
| `active` | `next_action = ask_question` | `active` | ✅ | Stay in active, intake in progress |
| `active` | `next_action = handoff_to_support` | `support` | 🔨 | Support handoff (handler is stub) |
| `active` | `next_action = fallback` | `fallback` | ✅ | Recovery |
| `browsing` | Customer selects ingredient from current category | `browsing` | ✅ | Save selection, prompt for portion (`awaiting_portion = true`) |
| `browsing` | Customer enters valid portion | `browsing` | ✅ | Save portion, auto-advance to next category (`awaiting_portion = false`) |
| `browsing` | Customer skips optional category | `browsing` | ✅ | Mark empty, auto-advance |
| `browsing` | Customer tries to skip required category | `browsing` | ✅ | Blocked, re-show same category |
| `browsing` | All categories exhausted (last handled) | `draft` | ✅ | Build meal draft |
| `browsing` | Customer says "go back" / "previous" | `browsing` | ✅ | Navigate to previous category, re-show (reset `awaiting_portion = false`) |
| `browsing` | Customer sends unrelated msg | `active` | ✅ | Re-route via Maya, preserve position |
| `browsing` | Only one option in category | `browsing` | ✅ | Auto-select, prompt for portion |
| `browsing` | No options in category | `browsing` | ✅ | Skip with notice, auto-advance |
| `selecting` | Selection complete | `draft` | ⏭ | Build meal draft |
| `selecting` | Selection incomplete | `selecting` | ⏭ | Ask for missing |
| `draft` | Customer chooses "Confirm" / "Default" | `collecting` | 🔨 | Keep defaults, proceed (dispatch partially wired) |
| `draft` | Customer chooses "Customize Portions" | `customizing` | ❌ | Discarded — superseded by `editing_bowl` single-category redo |
| `draft` | Customer edits bowl / "Customize" | `editing_bowl` | 🔨 | Maya routes to `edit_bowl`, system asks which category, then single_edit (E8) |
| `customizing` | Customer enters valid portion | `customizing` | ❌ | Discarded |
| `customizing` | Customer says "skip" / "keep current" | `customizing` | ❌ | Discarded |
| `customizing` | All customizable categories exhausted | `draft` | ❌ | Discarded |
| `customizing` | Customer sends unrelated msg | `active` | ❌ | Discarded |
| `editing_bowl` | Customer picks a category to edit | `browsing` | 🔨 | Set `browse_mode = "single_edit"`, jump to that category (domain exists, now being wired via edit_bowl) |
| `editing_bowl` | Customer cancels edit / "never mind" | `draft` | 🔨 | No change, show draft again |
| `browsing` (single_edit) | Customer selects new ingredient | `draft` | ✅ | Save, update draft, return to draft |
| `browsing` (single_edit) | Customer says "keep current" / "skip" | `draft` | ✅ | No change, show draft again |
| `browsing` (single_edit) | Customer enters valid portion → exit | `draft` | 🔨 | Save portion, `exit_single_edit`, return to draft (E8 wiring) |
| `collecting` | Final details received | `reviewing` | ✅ | Merge + review (webhook wired) |
| `collecting` | Session not found | `expired` | ✅ | Restart message |
| `reviewing` | `action = confirm_order` | `done` | 🔨 | Validates + creates (flow partially wired) |
| `reviewing` | `action = edit_custom_bowl` | `editing_bowl` | ⏸ | Go edit (deferred) |
| `reviewing` | `action = edit_personal_info` | `editing_info` | ⏸ | Go edit (deferred) |
| `reviewing` | Validation fails | `active` | 🔨 | Restart |
| `editing_bowl` | Bowl changes saved | `draft` | ⏸ | Go back to draft |
| `editing_info` | Details collected | `collecting` | ⏸ | Send collect form |
| `done` | n/a | n/a | ⏭ | Terminal (for now) |
| `fallback` | Next message received | `active` | ✅ | Recover and continue |
| `any` | Session TTL exceeded | `expired` | ✅ | Next msg → new session |

---

## Implementation Rules

1. **State is authoritative.** Every handler must check that the current state
   allows the requested operation. Reject invalid transitions.

2. **State is persisted.** After every state change, persist the session (plus
   the new state) before sending any reply.

3. **State is single-source.** Only one place in code sets `session_status`.
   Use constants, not magic strings.

4. **State is testable.** Every transition must have at least one unit test
   verifying it.

5. **Fallback is safe.** If state cannot be determined, default to `active` and
   re-route through Maya. Never lose a message.

6. **Expiry is checked early.** Before any processing, check TTL. If expired,
   start a new session. Never mutate an expired session.

---

## Sequential Category Browsing — Session Tracking Fields ✅

When the session enters `browsing` for sequential browsing,
the following session fields control the flow:

| Field | Type | Description |
|---|---|---|
| `current_category` | `string \| None` | The category currently shown to the customer (e.g. "base", "protein") |
| `next_category` | `string \| None` | The category that will be shown after current one is handled |
| `category_position` | `int \| None` | Zero-based index into `CATEGORY_DISPLAY_ORDER` |
| `handled_categories` | `list[string]` | Categories already processed (selected, skipped, or auto-advanced) |
| `category_browse_mode` | `BrowseMode \| None` | `"sequential_full"` (initial build, auto-advance through all) or `"single_edit"` (edit bowl, one category at a time, return to draft) |
| `awaiting_portion` | `boolean` | 2-exchange toggle: `false` = show ingredient options, `true` = show portion prompt |

**Category display order (constant):**
```
["base", "protein", "cooked_vegetable", "sauce", "topping", "egg", "cooking_oil"]
```

**2-exchange per category flow:**
```
1. Show ingredient options (names only, no grams)
2. Customer picks ingredient → saved, awaiting_portion = true
3. Show portion prompt (min, max, step)
4. Customer enters portion → saved, awaiting_portion = false, advance
```

---

## Single-Category Edit Mode (`editing_bowl`) ✅

Domain logic exists in `category_browser.py` (`init_single_edit`, `exit_single_edit`).
Not yet wired from review/draft UI flows (E8 deferred).

When the customer is editing their bowl after seeing the meal draft, the
system reuses `browsing` but in `"single_edit"` mode.
Unlike the sequential full build, the system does **not** auto-advance
through all categories — it shows just the targeted category and returns
to `draft`.

**Difference from sequential_full:**

| Behavior | sequential_full | single_edit |
|---|---|---|
| Entry point | `active` (via Maya) | `editing_bowl` |
| Shows | All categories in order | Only the chosen category |
| After selection | Auto-advance to next | Return to `draft` |
| Skip allowed? | Optional categories only | Yes (="keep current") |
| Go back? | Yes (to previous) | N/A (only one category) |
| Required/optional rules | Enforced | Not enforced (already has a selection) |

---

## Portion Customization Mode (`customizing`) ❌ *(discarded)*

Discarded — E7.2. Superseded by `editing_bowl` single-category redo (E8).
When the customer wants to change their bowl, the system asks which category
to change and re-runs ingredient + portion selection for that one category
via `browse_mode = "single_edit"`.

*Original scope kept below for audit trail.*

Deferred — E7.2. Will be implemented later if customer feedback shows demand
for post-draft portion adjustment. Portions are already set during E4 2-exchange
browsing.

When activated, the system walks through categories in display order, stopping
only at customizable ingredients. See `docs/product/user-stories.md` E7-S4
through E7-S6 for full acceptance criteria.
