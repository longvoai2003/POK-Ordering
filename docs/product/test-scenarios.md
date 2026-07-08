# Test Scenarios — PureOrganic Meal Builder

Each scenario is a concrete conversation test case that QA and engineering can
execute or automate. Scenarios are grouped by Use Case.

## Status Legend

| Marker | Meaning |
|---|---|
| ✅ | Implemented test exists |
| 🔨 | Scenario valid, test not yet written |
| ⏸ | Scenario deferred (feature not implemented) |
| ⏭ | Not started |

---

## UC1 — Start Meal Conversation ✅

### TS-1.1 — First Message from New Customer ✅
```
Input:  "Hi, I want to order a custom bowl"
Expect: Session created, session_status = "active"
        Maya classifies intent as bowl_order
        Maya asks about allergies, goal, or menu browsing
```

### TS-1.2 — Resume Active Session ✅
```
Setup:  Existing session with intake in progress
Input:  "My allergies are peanuts"
Expect: Existing session loaded (not new)
        allergies extracted and merged into session
        Maya asks next intake question
```

### TS-1.3 — Resume Expired Session ✅
```
Setup:  Session last active 45 minutes ago
Input:  "I want to continue my order"
Expect: Old session detected as expired
        Old session NOT used
        New session created
        Maya treats as fresh conversation
```

### TS-1.4 — Duplicate Message Dropped ✅
```
Setup:  Message with platform_message_id "msg-123" already processed
Input:  Same platform_message_id "msg-123" arrives again
Expect: Event dropped silently
        No session mutation
        No reply sent
```

---

## UC2 — Browse Ingredient Category (Sequential) ✅

When the customer asks for the full menu, the system shows each category
**one at a time, in a fixed order**, using a **2-exchange per category**
paradigm: pick ingredient → enter portion → auto-advance.

**Category display order:**
1. Base
2. Protein
3. Cooked Vegetables
4. Sauce
5. Toppings
6. Eggs
7. Cooking Oils

---

### TS-2.1 — Full Menu Request Shows First Category (Base) ✅
```
Input:  "Show me the menu"
Expect: Maya routes to show_category_menu
        System loads Base components
        System replies with only Base options (names only, no grams):
          1. Brown Rice
          2. Quinoa
          3. Sweet Potato
        Reply length < 1500 characters
        Session state = browsing
        Session awaiting_portion = false
        Session current_category = "base"
        Session next_category = "protein"
```

### TS-2.2 — Customer Picks Ingredient, Then Enters Portion, Then Auto-Advances ✅
```
Setup:  Session state = browsing, awaiting_portion = false
        current_category = "base", next_category = "protein"
        Base options shown (names only)
Input:  "2"  (selects option 2)
Expect: Selection saved to selected_meal["base"]
        Session awaiting_portion = true
        System replies with portion prompt:
          "Sweet Potato — how much?
           50.0g, 75.0g, 100.0g, 125.0g, 150.0g, 175.0g, 200.0g, 225.0g, 250.0g, 275.0g, 300.0g
           (min 150.0g, max 300.0g, step 25.0g)
           Reply with the amount (e.g. 150)."
        Session still on current_category = "base" (not advanced yet)
---
Input:  "200"
Expect: Portion saved to selected_meal["base"][0]["portion"] = 200
        Session awaiting_portion = false
        System auto-advances and shows Protein options:
          1. Beef
          2. Chicken Breast
          3. ...
        Reply length < 1500 characters
        Session current_category = "protein"
        Session next_category = "cooked_vegetable"
```

### TS-2.3 — Customer Skips Optional Category ✅
```
Setup:  current_category = "topping"
Input:  "Skip" or "No topping" or "None"
Expect: topping set as empty in selected_meal
        System auto-advances to next category (Eggs) — no portion prompt
        Optional categories (topping, egg, cooking_oil) can all be skipped
```

### TS-2.4 — Customer Cannot Skip Required Category ✅
```
Setup:  current_category = "protein" (required)
Input:  "Skip"
Expect: System replies: "Protein is required. Please pick one:"
        Re-shows protein options
        Session stays on current_category = "protein"
        Does NOT advance
```

### TS-2.5 — Full Sequential Walkthrough (Happy Path) ✅
```
Step 1:  Customer: "Show me menu"
         System: shows Base options (names only)
Step 2:  Customer: "1" (Brown Rice)
         System: "Brown Rice — how much? 100g,125g,...,300g"
Step 3:  Customer: "150" (150g)
         System: shows Protein options
Step 4:  Customer: "2" (Beef)
         System: "Beef — how much? 100g,...,250g"
Step 5:  Customer: "200" (200g)
         System: shows Cooked Vegetable options
Step 6:  Customer: "1" (Broccoli)
         System: "Broccoli — how much? 25g,...,200g"
Step 7:  Customer: "80" (80g)
         System: shows Sauce options
Step 8:  Customer: "1" (Fish Sauce)
         System: "Fish Sauce — how much? 0ml,...,50ml"
Step 9:  Customer: "20" (20ml)
         System: shows Topping options (or skip)
Step 10: Customer: "Skip"
         System: shows Egg options (or skip)
Step 11: Customer: "Skip"
         System: shows Cooking Oil options (or skip)
Step 12: Customer: "Skip"
         System: "Here's your bowl:" (meal draft)
Expect: selected_meal has all required categories filled with portions
        Optional categories are empty
        Session state = draft
```

### TS-2.6 — All Required Categories Completed, Auto-Finalize ✅
```
Setup:  current_category = "sauce" (last required)
        Customer selected base, protein, vegetable already (all with portions)
Input:  "1" (selects sauce) → portion prompt → "30" (portion entered)
Expect: Sauce portion saved
        System shows remaining optional categories
        All required filled, optional offered
        After all 7 handled → shows complete meal draft
        Session state = draft
```

### TS-2.7 — Go Back to Previous Category ✅
```
Setup:  current_category = "sauce", awaiting_portion = false
        Customer already selected Chicken (200g) for protein
Input:  "Go back" or "Change protein" or "Previous"
Expect: System navigates back to previous category (protein)
        awaiting_portion = false (reset to ingredient-pick step)
        Re-shows protein options
        current_category = "protein"
        Customer can change selection (and then enter new portion)
```

### TS-2.8 — No Components Available for Category ✅
```
Setup:  No egg options in Components sheet
        current_category would advance to "egg"
Expect: System skips egg automatically
        Reply: "No eggs options available. Skipped."
        Session advances to cooking_oil
        selected_meal["egg"] = []
```

### TS-2.9 — Category with Only One Option (Auto-Select, Prompt Portion) ✅
```
Setup:  Only one sauce available
        current_category = "sauce"
Expect: System auto-selects the only option
        Reply: "Only one sauce option available: Teriyaki. Auto-selected."
        System shows portion prompt for that ingredient
        Does NOT skip the portion step
        After portion entered → auto-advances to next category
```

### TS-2.10 — Category Reply Does NOT Exceed Character Limit ✅
```
Setup:  Protein category has 25 options
        current_category = "protein"
Expect: Reply is truncated under 1500 chars
        "...and N more options" hint shown
```

### TS-2.11 — Customer Asks Unrelated Question During Browsing ✅
```
Setup:  current_category = "sauce"
Input:  "What are your opening hours?"
Expect: Maya re-routes to ask_question or handoff_to_support
        Session state goes to active
        current_category and next_category preserved in session
        When customer says "continue" or "back to menu", resumes from sauce
```

### TS-2.12 — Rapidfuzz Fuzzy Matching (Conversational) ✅
```
Setup:  current_category = "protein"
        Options: [Chicken Breast, Beef Steak, Tofu, Salmon]
Test cases:
  Input: "I want bown rice" (typo) → matches Brown Rice
  Input: "can I get the chicken one" (partial+filler) → matches Chicken Breast
  Input: "I would like to choose the teriyaki sauce" (filler words) → matches Teriyaki
  Input: "give me rice brown" (word reorder) → matches Brown Rice
  Input: "I'll go with the salmon today" (casual) → matches Salmon
  Input: "hmm do you have anything exotic like dragon fruit" → UNRECOGNIZED
Expect: Rapidfuzz max(partial_ratio, token_set_ratio) with cutoff 70 handles all
```

---

## UC3 — Personalized Recommendations (Deferred) ⏭

All UC3 scenarios are deferred. Optional future enhancement (E5). Not tested.

### TS-3.1 through TS-3.5 ⏭
Keto filtering, allergy exclusions, avoided ingredients, hardcore macros, guided macros.
Deferred until E5 is activated.

---

## UC4 — Ingredient Selection (Absorbed into UC2) ✅

Selection parsing is handled by E4's deterministic `parse_player_input()`.
No separate selection test scenarios needed. See TS-2.12 for fuzzy matching tests.

### TS-4.1 through TS-4.9 — Covered by UC2
Numeric selection → TS-2.2. Name matching → TS-2.12. Skip/required → TS-2.3/2.4.
"Chef choice" and multi-category selection are deferred to E5.

---

## UC5 — Edit Bowl Draft (Targeted Single-Category) 🔨

Domain logic exists. Being wired through E8 `edit_bowl` Maya action + pipeline guard.

### TS-5.1 through TS-5.6 🔨
Single-category edit, highlight current, keep current, multi-edit.
Scenarios valid; end-to-end tests pending E8 wiring.

### TS-5.7 — Full edit_bowl Flow 🔨
```
Setup:  Session in draft with selections across all categories
Step 1: Customer: "Customize"
        System: "Which category would you like to change?
                Base, Protein, Cooked Vegetables, Sauce, Toppings, Eggs, Cooking Oils"
Step 2: Customer: "protein"
        System: "Protein — choose your protein:
                 1. Chicken Breast (current)
                 2. Beef
                 3. Tofu
                 Type 'skip' to keep your current selection."
Step 3: Customer: "2"
        System: "Beef — how much? 50 g, 75 g, 100 g, ..."
Step 4: Customer: "150"
        System: "Here's your updated bowl: ..." (draft with beef replacing chicken)
Expect: selected_meal["protein"] updated
        Session state = draft
```

---

## UC6 — View Meal Draft ✅

### TS-6.1 — Guided Customer Draft (No Macros) ✅
```
Setup:  customer_type = "guided_custom"
        selected_meal complete with portions
Expect: Reply shows all 7 categories with ingredient names and portions
        Empty categories as "-"
        Prompt: "Reply 'Customize' to adjust portions, or 'Confirm' to proceed."
```

### TS-6.2 — Hardcore Customer Draft (With Macros) ⏸
Deferred with E7-F (macro calculation).

---

## UC6b — Customize Portions ❌ *(discarded)*

Discarded — E7.2. Superseded by UC5 single-category edit (see TS-5.7).

### TS-6b.1 through TS-6b.14 ❌
All UC6b scenarios are discarded. Portions are set during E4 browsing.
Post-draft portion walkthrough replaced by single-category redo.

---

## UC7 — Collect Final Details 🔨

### TS-7.1 — Full Details Collected Successfully 🔨
```
Setup:  draft → customer confirms
Expect: ManyChat collect-details flow sent (stub needs wiring)
        Fields merged into collected_fields
        Session moves to reviewing
```
Webhook handling ✅. Flow trigger 🔨.

### TS-7.2 — Partial Details 🔨
### TS-7.3 — Session Not Found for Final Details ✅

---

## UC8 — Confirm Order 🔨

### TS-8.1 — Confirm Goes to Chef Request ⏭
Webhook handling ✅. Chef request creation ⏭ (E9).

### TS-8.2 — Confirm Without Details ⏭
### TS-8.3 — Confirm Without Meal ⏭
### TS-8.4 — Edit Bowl from Review ⏸
### TS-8.5 — Edit Personal Info from Review ⏸

---

## UC10 — Chef Request ⏭

### TS-10.1 — Complete Chef Request Record ⏭
### TS-10.2 — Chef Request Persisted to Sheets ⏭

---

## UC11 — Session Timeout ✅

### TS-11.1 — Expired Session Detected (Flow Restarted) ✅
### TS-11.2 — Active Session Within TTL ✅

---

## Cross-Cutting Scenarios

### TS-X.1 — Fallback on Agent Parse Failure ✅
### TS-X.2 — Maya Routing to Handoff 🔨
### TS-X.3 — Message Without Session Context ✅
### TS-X.4 — Concurrent Messages from Same Session 🔨
### TS-X.5 — Sheets Read Failure 🔨
### TS-X.6 — ManyChat API Failure on Reply 🔨

---

## Priority Test Scenarios

### E4 — Sequential Category Menu ✅ (All P0/P1/P2 done)

| Priority | Scenario | Status |
|---|---|---|
| P0 | TS-2.1 — Full menu shows first category (Base) | ✅ |
| P0 | TS-2.2 — Select + portion + auto-advance (2-exchange) | ✅ |
| P0 | TS-2.5 — Full sequential walkthrough | ✅ |
| P0 | TS-2.12 — Rapidfuzz fuzzy matching | ✅ |
| P1 | TS-2.3 — Skip optional category | ✅ |
| P1 | TS-2.4 — Cannot skip required category | ✅ |
| P1 | TS-2.6 — All required done, auto-finalize | ✅ |
| P1 | TS-2.7 — Go back to previous category | ✅ |
| P2 | TS-2.8 — No components available (auto-skip) | ✅ |
| P2 | TS-2.9 — Single option (auto-select) | ✅ |
| P2 | TS-2.10 — Category reply under char limit | ✅ |

### E4 — Single-Category Edit 🔨

| Priority | Scenario | Status |
|---|---|---|
| P0 | TS-5.4 — See options with current highlighted | 🔨 Domain logic done |
| P0 | TS-5.5 — Select new ingredient, return to draft | 🔨 Domain logic done |
| P0 | TS-5.7 — Full edit_bowl flow: "Customize" → pick category → redo → back to draft | 🔨 E8 wiring in progress |
| P1 | TS-5.3 — Pick which category to edit | 🔨 Domain logic done |
| P1 | TS-5.6 — Keep current ingredient (cancel) | 🔨 Domain logic done |
