# Engineering Workflow — Branch Policy, CI Triggers, and Future Delivery

This document defines the recommended Git branch strategy, CI trigger rules,
and staged delivery plan for this repository.

It is intentionally lighter than a full enterprise Git Flow because the
project is currently maintained by one developer. The goal is to build good
habits without adding process that slows down day-to-day work.

---

## Goals

- Keep `main` stable and releasable.
- Use `dev` as the primary integration branch.
- Use short-lived feature branches for changes.
- Run CI automatically on the branches where it adds signal.
- Add deployment stages only when environments are ready.

---

## Branch Policy

### Primary Branches

#### `main`
- Purpose: production-ready code only.
- Stability: highest.
- Merge source: pull requests from `dev`.
- Direct commits: avoid.
- Protection recommendation:
  - require pull request before merge
  - require CI to pass
  - require branch to be up to date before merge

#### `dev`
- Purpose: active integration branch for current work.
- Stability: should stay healthy and always testable.
- Merge source: pull requests from `feature/*` branches.
- Direct commits: avoid when possible, even as a solo developer.

### Working Branches

#### `feature/*`
- Purpose: short-lived branches for one feature, fix, or refactor.
- Branch from: `dev`.
- Merge into: `dev`.
- Naming examples:
  - `feature/e2-session-service`
  - `feature/e10-manychat-adapter`
  - `feature/fix-ci-session-repo`

#### `feat/*`
- Allowed because the current CI workflow already watches this pattern.
- Recommendation: prefer `feature/*` for consistency and keep `feat/*` only if
  it is already part of your personal habit.

### Optional Future Branches

#### `release/*`
- Purpose: prepare a production release while other development continues.
- Use only when deployment becomes more formal.
- Branch from: `dev`.
- Merge into: `main` and back into `dev`.

#### `hotfix/*`
- Purpose: urgent production fixes after `main` is already deployed.
- Use only once there is a real production environment.
- Branch from: `main`.
- Merge into: `main` and back into `dev`.

---

## Solo Developer Workflow

For this repository, the recommended day-to-day flow is:

1. Create a branch from `dev` using `feature/*`.
2. Commit small, focused changes.
3. Push the branch and let CI run.
4. Open a pull request into `dev`.
5. Merge into `dev` only when CI is green.
6. Periodically open a pull request from `dev` into `main`.
7. Tag releases from `main` when deployment starts.

This keeps the workflow simple while still teaching branch isolation,
integration discipline, and release hygiene.

---

## CI Trigger Rules

The current workflow should focus on three categories of branch activity:

1. pushes to active development branches
2. pull requests into integration or stable branches
3. future deployment events from stable branches

### Current Recommended Triggers

#### Push
Run CI on pushes to:

- `feature/**`
- `feat/**`

Reasoning:
- `feature/*` and `feat/*` get early feedback before a pull request.
- `dev` and `main` are intended to be protected PR-only branches.
- fast push checks help catch issues before opening a pull request.

#### Pull Request
Run CI on pull requests targeting:

- `dev`
- `main`

Reasoning:
- pull requests into `dev` validate integration quality
- pull requests into `main` validate release readiness
- full integration CI is concentrated here, where merge decisions are made

### Current CI Jobs

The current GitHub Actions workflow is split into two jobs:

#### Unit and Lint
- installs Python and `uv`
- syncs dependencies
- runs `make ci`

This job runs on:
- pushes to `feature/**`
- pushes to `feat/**`
- pull requests targeting `dev`
- pull requests targeting `main`

`make ci` currently runs:
- `make lint`
- `make test-unit`

#### Integration
- waits for the unit job
- provisions Postgres as a GitHub Actions service
- installs PostgreSQL client tools
- syncs dependencies
- runs `make ci-integration`

This job runs on:
- pull requests targeting `dev`
- pull requests targeting `main`

`make ci-integration` currently runs:
- `make db-migrate`
- `make test-integration`

This split matches the current repository well:
- fast checks fail quickly
- database-backed checks are isolated
- local commands and CI commands stay aligned through `Makefile`

---

## Branch Protection Recommendations

When branch protection is enabled, use these rules first:

### Protect `main`
- require pull requests before merging
- require status checks to pass
- require conversation resolution if review comments are used
- disallow force pushes

### Protect `dev`
- require pull requests before merging
- require status checks to pass
- disallow force pushes

For a solo-maintained repository, reviewer requirements are optional. The more
important discipline is requiring CI to pass before merge.

---

## Future Development Plan

CI is already useful now. CD should be added in stages.

### Stage 1 — Current State
- CI only
- no automatic deployments
- `main` represents stable code
- `dev` represents integrated development code

### Stage 2 — Add Staging Deployment
Trigger deployment from:
- merges into `dev`

Purpose:
- create a safe environment for end-to-end webhook tests
- validate infrastructure, environment variables, and adapter behavior
- test Epic E10 integrations outside local development

Recommended staging checks:
- app boots successfully
- database connection works
- webhook endpoint responds
- migrations apply cleanly

### Stage 3 — Add Production Deployment
Trigger deployment from:
- merges into `main`, or
- version tags created from `main`

Purpose:
- deploy only stable, already-integrated code
- keep production changes explicit and auditable

Recommended production gates:
- unit and integration CI must pass
- staging deployment must be healthy
- production secrets configured
- rollback path documented

### Stage 4 — Add Release and Hotfix Paths
Use this only when delivery becomes more formal.

Release path:
1. branch `release/*` from `dev`
2. stabilize and test
3. merge into `main`
4. tag release
5. merge back into `dev`

Hotfix path:
1. branch `hotfix/*` from `main`
2. fix urgent issue
3. run CI
4. merge into `main`
5. merge back into `dev`

---

## Recommended Near-Term Rules

Use these rules now:

1. Do not commit directly to `main`.
2. Prefer not to commit directly to `dev`.
3. Branch from `dev` for every meaningful change.
4. Keep feature branches short-lived.
5. Require CI to pass before merging to `dev` or `main`.
6. Treat failing integration tests as blockers, not optional warnings.
7. Use pull requests as the only merge path into `dev` and `main`.

---

## Practical Examples

### Example 1 — New Feature
1. Start from `dev`
2. Create `feature/e4-category-browser`
3. Push commits as work progresses
4. Open PR into `dev`
5. Merge after CI passes

### Example 2 — Stabilize for Release
1. Confirm `dev` is green
2. Open PR from `dev` into `main`
3. Merge after CI passes
4. Create a version tag from `main`

### Example 3 — Future Production Fix
1. Branch `hotfix/session-timeout-bug` from `main`
2. Fix and test
3. Merge into `main`
4. Merge the same fix back into `dev`

---

## Current Repository Alignment

This document aligns with the current repository setup:

- GitHub Actions workflow: `.github/workflows/ci.yml`
- local and CI task entry points: `Makefile`
- integration schema bootstrap: `migrations/001_sessions.sql`

If branch names or CI jobs change later, update this document together with the
workflow file so the policy and implementation stay in sync.
