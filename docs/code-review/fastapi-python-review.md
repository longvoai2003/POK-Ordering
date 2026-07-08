# FastAPI/Python Code Review

Review date: 2026-07-04 (updated 2026-07-04)

Scope: `src/`, `migrations/002_sessions_index.sql`, and current order/session pipeline behavior.

## Summary

The recent order-completion lifecycle is now consistent: `touch_interaction()` is only called on new session creation, `mark_ordering_complete()` turns `is_ordering` off after confirmation, and active session lookup excludes `done` sessions so repeat orders create fresh sessions.

**6 bugs + 1 security issue resolved** in this review. Remaining items center on webhook hardening, external API hardening, and performance.

| Severity | Open |
|---|---:|
| Critical | 0 |
| High | 4 |
| Medium | 10 |
| Low | 5 |

## Resolved Bugs (this review)

### ✅ B1. State machine validation now enforced at all transition sites

All 14 direct `session.session_status =` assignments replaced with `set_session_status(session, target)` in `src/domain/state_machine.py:67-69`, which calls `validate_transition()` before assigning. Covered files: `reviewing.py`, `browsing.py`, `dispatch.py`, `pipeline.py`, `session_service.py`. `EXPIRED` is allowed from any state for TTL safety.

### ✅ B2. PAYMENT state machine mismatch fixed

`REVIEWING → PAYMENT → DONE` now explicitly allowed in the transition table. Tests updated to assert final `DONE` state, matching production flow.

### ✅ B3. Final-details persists before sending reply

`pipeline.py:232-235` now sets `REVIEWING` status and saves the session before `send_reply()` and `send_reply_flow()`. If the save fails, no reply is sent.

### ✅ B4. PAYMENT pipeline guard restored

`pipeline.py:128-142` has an active `SessionStatus.PAYMENT` guard that replies deterministically ("Your order is being processed…") without routing to Maya, covering the crash window between PAYMENT save and DONE.

### ✅ B5. ChefRequest idempotency via session-stored request_id

`reviewing.py:61-79`: first confirmation stores `chef_request_id` + `order_total` in `session.collected_fields`. Replayed confirm reads cached values, skips chef-request creation, component load, and QR generation, then calls shared `_finalize_order()`. Protects against duplicate webhook deliveries and repeated "confirm" messages.

### ✅ B6. `start_single_edit` validates actual session state

`browsing.py:55` now calls `set_session_status(session, SessionStatus.BROWSING)` which validates the real `session.session_status`, replacing the old hardcoded `validate_transition(SessionStatus.EDITING_BOWL, SessionStatus.BROWSING)`.

### ✅ S1. ManyChat webhook authentication via shared secret

`main.py:45-50` defines `authenticate_webhook()` dependency that validates `X-ManyChat-Secret` header with `secrets.compare_digest()` against `MANYCHAT_WEBHOOK_SECRET` env var. Returns 401 before any processing. Both webhook endpoints at lines 55 and 70 have `Depends(authenticate_webhook)`. Empty secret = skip auth (dev convenience).

## Open Items

### B7. Debug prints remain in request path

File/line: `src/services/gate.py:34`, `src/services/session_service.py:50`

Severity: Low

Why it's a problem: These writes go directly to stdout in production request paths. They can leak identifiers and make logs noisy. `print()` is also synchronous I/O.

Concrete fix: Remove them or replace with `logger.debug()` with structured metadata.

### B8. Duplicate configuration assignments can hide future config mistakes

File/line: `src/config.py:9-11`, `src/config.py:54-59`

Severity: Low

Why it's a problem: `MANYCHAT_REPLY_FLOW_NS` and `FUZZY_SCORE_CUTOFF` are assigned twice. Today the values are identical, but future edits can silently be overwritten.

Concrete fix: Delete the duplicate assignment at `src/config.py:11` and one of the `FUZZY_SCORE_CUTOFF` assignments.

## Security Risks

### S2. Payment QR endpoint is path-traversal prone

File/line: `src/main.py:73-78`

Severity: High

Why it's a problem: `request_id` is directly interpolated into a filesystem path. Values containing `../` can escape `static/qr`. Even though the `.png` suffix reduces some impact, path traversal can still expose unintended PNG files or behave unexpectedly with symlinks.

Concrete fix: Validate `request_id` as UUID before building the path, or resolve and verify the path stays under the QR directory.

Example:

```python
from uuid import UUID

UUID(request_id)
path = QR_DIR / f"{request_id}.png"
if not path.resolve().is_relative_to(QR_DIR.resolve()):
    return JSONResponse({"error": "not found"}, 404)
```

### S3. Bank account details are committed in source code

File/line: `src/config.py:61-65`

Severity: Medium

Why it's a problem: Bank account metadata is not an API secret, but it is operationally sensitive and environment-specific. Committing it makes rotation and environment separation harder.

Concrete fix: Move `BANK_NAME`, `BANK_BIN`, `BANK_ACCOUNT`, and `BANK_ACCOUNT_NAME` to environment variables and fail fast when required payment config is missing.

### S4. External API exception logging may expose sensitive headers or payloads

File/line: `src/adapters/manychats.py:31-32`, `src/adapters/manychats.py:47-50`, `src/adapters/manychats.py:75-80`, `src/adapters/manychats.py:96-100`, `src/adapters/manychats.py:116-117`, `src/adapters/manychats.py:132-135`, `src/adapters/manychats.py:150-153`, `src/adapters/manychats.py:168-169`, `src/adapters/manychats.py:186-190`, `src/services/llm_service.py:35-43`

Severity: Medium

Why it's a problem: `logger.exception()` emits tracebacks. Some HTTP client exceptions can include request context. If headers or request bodies are included by a library or wrapper, bearer tokens and customer data can leak to logs.

Concrete fix: Log sanitized error fields only. Avoid logging raw request/response objects, and redact `Authorization` headers if included.

### S5. No rate limiting on public webhook endpoints

File/line: `src/main.py:43-65`

Severity: Medium

Why it's a problem: Attackers or buggy integrations can flood endpoints, creating LLM spend, ManyChat API calls, Google Sheets quota usage, and DB writes.

Concrete fix: Add rate limiting keyed by subscriber/customer ID and source IP. For example, use middleware with per-minute limits and separate stricter limits for invalid payloads.

## Reliability Risks

### R1. In-memory dedup set grows unbounded and is process-local

File/line: `src/domain/dedup.py:1-10`

Severity: High

Why it's a problem: `_seen` grows forever, causing memory growth in long-running processes. It also does not deduplicate across multiple workers or restarts.

Concrete fix: Use a TTL cache with a bounded max size for local protection, or move deduplication to Postgres/Redis with a unique key and expiry.

### R2. Postgres pool is never closed on app shutdown

File/line: `src/adapters/session_repo.py:28-31`, `src/adapters/session_repo.py:81-84`, `src/main.py:23-28`

Severity: High

Why it's a problem: `PostgresSessionRepo.close()` exists but is not wired to FastAPI lifespan/shutdown. Connections can be abandoned on reloads or shutdowns.

Concrete fix: Add a FastAPI lifespan context or shutdown event that calls `await _repo.close()`.

### R3. External ManyChat HTTP calls lack explicit timeouts and retries

File/line: `src/adapters/manychats.py:22`, `src/adapters/manychats.py:38`, `src/adapters/manychats.py:56`, `src/adapters/manychats.py:86`, `src/adapters/manychats.py:107`, `src/adapters/manychats.py:123`, `src/adapters/manychats.py:141`, `src/adapters/manychats.py:159`, `src/adapters/manychats.py:175`

Severity: High

Why it's a problem: Each integration call can delay the webhook request. Failures are swallowed after logging, so important actions such as sending replies, triggering flows, and marking order completion can silently fail.

Concrete fix: Use explicit `httpx.Timeout`, check `raise_for_status()` on all calls, and add retries with bounded exponential backoff for transient failures. For critical state flips like `mark_ordering_complete`, surface failure to the caller or queue a retry.

### R4. Session can be left in PAYMENT after partial confirmation failure

File/line: `src/services/reviewing.py:58-79`

Severity: Medium (mitigated from High)

Why it's a problem: The session is saved as PAYMENT before ChefRequest creation, component load, QR generation, and QR file write. Any exception after the PAYMENT save can leave the customer in `awaiting_payment` with no automatic recovery — only the deterministic "order is being processed" guard (B4 fix) will reply to subsequent messages.

Mitigation: The PAYMENT guard in `pipeline.py:128-142` now catches messages in this state and replies deterministically rather than routing to Maya. B5's idempotency cache (`chef_request_id` in `collected_fields`) prevents duplicate ChefRequest creation if the customer reaches "confirm" again via flow restart.

Remaining risk: No automatic recovery from PAYMENT to a workable state. If a server crash happens mid-confirmation and the webhook restarts, the customer sees "order is being processed" until staff intervention or session expiry.

Concrete fix: Wrap the confirm flow in try/except and revert to REVIEWING with a customer-facing retry message if any required step fails. Alternatively, add a staff-facing alert on unhandled PAYMENT sessions that persist beyond a threshold.

### R5. Stale ManyChat interaction restart does not stop current processing

File/line: `src/services/pipeline.py:75-79`

Severity: Medium

Why it's a problem: If `ig_last_interaction` is stale, `restart_ordering_flow()` is called but the current inbound still proceeds through the existing session and may produce replies or state changes. The user can receive both a restart flow and normal bot processing.

Concrete fix: Return immediately after restart with a dropped/stale response, or explicitly expire the session and create a fresh one before continuing.

### R6. `touch_interaction()` failure after session creation leaves ManyChat routing disabled

File/line: `src/services/session_service.py:40-42`, `src/adapters/manychats.py:53-81`

Severity: Medium

Why it's a problem: A new session is persisted before `touch_interaction()` runs. If ManyChat custom-field update fails, `is_ordering` may remain false while the backend has an active session, so subsequent messages may not route to the webhook.

Concrete fix: Make `touch_interaction()` return success/failure and have `get_or_create()` log/return a recoverable error or retry. Consider setting `is_ordering` via the ManyChat flow before webhook creation if possible.

### R7. Google Sheets operations lack retry/backoff and can fail whole request paths

File/line: `src/adapters/customer_sheets.py:37-63`, `src/adapters/component_repo.py:54-67`, `src/adapters/chef_request_sheets.py:26-30`

Severity: Medium

Why it's a problem: Google Sheets calls are network I/O and quota-limited. Failures can prevent session creation, menu loading, profile persistence, or chef request creation. No retry/backoff is applied.

Concrete fix: Wrap Sheets calls in retry/backoff for 429/5xx, and decide which calls are critical versus best-effort. For customer profile upsert during `SessionService.save()`, consider logging failure without failing the session save.

### R8. Component sheet numeric parsing can crash cache refresh

File/line: `src/adapters/component_repo.py:25-47`

Severity: Medium

Why it's a problem: Any non-numeric value such as `N/A` in fields like `portion`, `calories`, or `cost` raises `ValueError` and prevents the entire component cache from loading.

Concrete fix: Use safe parsing helpers with defaults and row-level logging. Skip invalid rows instead of failing the entire menu.

### R9. Inbound log writes are synchronous local file I/O in async request flow

File/line: `src/adapters/inbound_log.py:8-12`, call sites in `src/services/pipeline.py`

Severity: Low

Why it's a problem: `open()` and `write()` run on the event loop. Under high request volume or slow disk, webhook latency can increase.

Concrete fix: Move logging to `asyncio.to_thread()`, structured application logs, or an async queue flushed by a background worker.

## Performance Issues

### P1. New `httpx.AsyncClient` is created for every ManyChat call

File/line: `src/adapters/manychats.py:22`, `src/adapters/manychats.py:38`, `src/adapters/manychats.py:56`, `src/adapters/manychats.py:86`, `src/adapters/manychats.py:107`, `src/adapters/manychats.py:123`, `src/adapters/manychats.py:141`, `src/adapters/manychats.py:159`, `src/adapters/manychats.py:175`

Severity: Medium

Why it's a problem: Recreating clients prevents effective connection reuse and adds TLS/connection overhead to each webhook. A single user action can call several ManyChat endpoints.

Concrete fix: Use a shared app-lifetime `httpx.AsyncClient` with configured limits and timeout. Close it in FastAPI lifespan shutdown.

### P2. Customer profile upsert reads the full Google Sheet on every session save

File/line: `src/adapters/customer_sheets.py:48-60`, `src/services/session_service.py:72-96`

Severity: Medium

Why it's a problem: Every `SessionService.save()` can call `customer_store.upsert()`, and upsert calls `get_all_records()` plus header reads. This is O(n) per save and can hit Google Sheets quotas quickly.

Concrete fix: Cache customer row locations by `customer_id`, use a real database for profiles, or defer customer-store synchronization to a background job.

### P3. Component cache can stampede on concurrent expiry

File/line: `src/adapters/component_repo.py:62-68`

Severity: Low

Why it's a problem: If multiple requests hit after cache TTL expiry, each can enter `_ensure_cache()` and trigger concurrent `get_all_records()` calls because there is no lock around refresh.

Concrete fix: Protect refresh with an `asyncio.Lock` and re-check cache freshness inside the lock.

### P4. QR generation and file write are synchronous inside async confirmation flow

File/line: `src/services/reviewing.py:45-46`, `src/domain/payment.py:272-302`

Severity: Low

Why it's a problem: QR image generation and file write are CPU/disk work in the event loop. It is likely small today, but can increase confirmation latency under concurrent orders.

Concrete fix: Run `save_qr_png()` via `asyncio.to_thread()` or pre-generate/store QR assets in a background task.

## Current Order Completion Lifecycle Check

The latest code supports the intended lifecycle:

1. New inbound order creates a new session in `SessionService.get_or_create()` and calls `touch_interaction()` once at `src/services/session_service.py:41`, setting `is_ordering = True`.
2. Reviewing confirmation calls `mark_ordering_complete()` inside `_finalize_order()` at `src/services/reviewing.py:42`, setting `is_ordering = False`.
3. The pipeline reviewing guard at `src/services/pipeline.py:108-122` no longer calls `touch_interaction()`, so it does not undo completion.
4. The PAYMENT guard at `src/services/pipeline.py:128-142` catches inbound messages during the tiny PAYMENT→DONE window and replies deterministically without Maya routing.
5. ChefRequest creation is idempotent via `chef_request_id` cached in `session.collected_fields` (`src/services/reviewing.py:61-77`). Replayed confirmations skip component load, QR generation, and chef request creation.
6. Active session lookup excludes `done` at `src/adapters/session_repo.py:97`, and the partial index matches at `migrations/002_sessions_index.sql:8`.
7. A future order after completion creates a fresh session instead of reusing the done session.
