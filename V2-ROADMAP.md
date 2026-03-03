# V2 Roadmap - Cook Easy Magic

## Goal
Prepare the existing Lovable-generated project for reliable long-term extension (V2) by stabilizing billing/auth flows, modularizing large features, and introducing delivery quality gates.

## Current Baseline (as of 2026-03-03)
- Stack: React + TypeScript + Vite + Supabase + Edge Functions.
- Core flows are functional: auth, recipe generation, meal planning, image generation, credits, PayPal top-up.
- Main blockers for V2: billing consistency risks, client-side non-transactional onboarding, monolithic dashboard modules, and missing automated tests.

## Guiding Principles
- Prefer server-side invariants for money/credits logic.
- Keep frontend feature modules small and composable.
- Enforce typed boundaries between UI, data-access, and domain logic.
- Introduce test and CI guardrails before major V2 features.

## Phase 0 - Immediate Hotfixes (Week 1)
### Scope
1. Fix PayPal capture payload mismatch.
2. Prevent recipe save/charge inconsistency.
3. Move signup initialization to atomic server flow.

### Tasks
1. PayPal contract alignment
- Update frontend capture call payload to match edge function (`order_id`) or vice versa.
- Add defensive parsing for both keys during transition.
- Add logging with request IDs.

2. Credit charge consistency
- Refactor `generate-recipe` charge path to avoid saved recipe on failed charge.
- Use transaction-like pattern (DB function) for insert + charge + usage logging.
- Add idempotency key support for retries.

3. Signup initialization hardening
- Replace client multi-insert initialization with one server-side function/edge function.
- Ensure all initial records are created atomically or rollback.

### Acceptance Criteria
- PayPal purchase completion adds credits in one pass, no manual recovery.
- No new recipe row exists when credit charge fails.
- New signup always has complete related records (`user_extended`, wallet, bonus, options, usage seed).

## Phase 1 - Modularization Foundation (Week 2-3)
### Scope
Split oversized dashboard modules and remove duplicated recipe-generation flow logic.

### Tasks
1. Frontend module decomposition
- Split `MealPlannerView` into:
  - `components/dashboard/meal-planner/*`
  - `hooks/useMealPlannerData.ts`
  - `hooks/useMealPlanGeneration.ts`
- Split `SettingsView` into:
  - `components/dashboard/settings/*`
  - `hooks/useUserSettings.ts`
  - `hooks/useCreditManagement.ts`

2. Shared recipe generation client
- Create one shared service/hook for `generate-recipe` invocation and error normalization.
- Reuse in landing and dashboard generate flows.

3. Data access layer
- Create feature-specific API modules (e.g. `src/features/credits/api.ts`, `src/features/recipes/api.ts`).
- Keep UI components free from raw Supabase query wiring where possible.

### Acceptance Criteria
- `MealPlannerView` and `SettingsView` each reduced to orchestration components.
- No duplicated `generate-recipe` request/response handling logic.
- New API modules are used by at least recipe + credits + meal planner features.

## Phase 2 - Data, Security, and Billing Hardening (Week 3)
### Scope
Tighten policies and operational safety around billing/admin operations.

### Tasks
1. RLS and role audit
- Review public/shared read policies (`recipe`, `recipe_image`) against product intent.
- Verify admin paths use `is_admin()` consistently.

2. Billing invariants
- Enforce purchase state transitions (`pending -> completed`) idempotently.
- Prevent duplicate capture processing for same `paypal_order_id`.
- Record immutable billing events for audit.

3. Admin operations
- Replace settings-page workaround for user lookup with proper server endpoint.
- Allow admin to search users safely (email -> user_id) with restricted output.

### Acceptance Criteria
- Repeated PayPal capture callback does not double-credit.
- Admin credit management works without manual UUID lookup.
- Security review checklist completed for RLS and admin edge functions.

## Phase 3 - Quality Gates and CI (Week 4)
### Scope
Add baseline automated quality checks and make them required.

### Tasks
1. Tooling
- Add `typecheck` and `test` scripts to `package.json`.
- Add Vitest + React Testing Library setup.
- Add edge-function test harness (unit-level where practical).

2. CI pipeline
- Run lint, typecheck, tests on PR.
- Block merge on failures.

3. Priority test coverage
- Auth state transitions.
- Recipe generation happy/error paths.
- PayPal create/capture critical flow.
- Meal planner generation and polling behavior.

### Acceptance Criteria
- CI is green on default branch.
- Minimum critical-path tests exist and run in CI.
- Regression in billing/auth is caught by automated checks.

## Phase 4 - V2 Feature Enablement (Week 5+)
### Scope
Build new V2 features on top of hardened architecture.

### Candidate V2 Features
1. Personalized weekly planning memory (history-aware suggestions).
2. Multi-provider AI fallback strategy (OpenAI/Gemini routing rules).
3. Collaborative/shared cookbooks.
4. Improved analytics and credit transparency in UI.

### Readiness Gate for Starting V2 Features
- Phase 0 and 3 complete.
- No open P0 billing/auth issues.
- Modular structure in place for at least meal planner and settings.

## Work Breakdown Structure (Backlog Seeds)
### Epic A - Payments and Credits Reliability
- A1: Fix capture payload mismatch.
- A2: Idempotent capture handling.
- A3: Atomic charge + recipe save path.
- A4: Billing event audit trail.

### Epic B - Auth and User Bootstrap
- B1: Server-side signup initialization.
- B2: Backfill script for incomplete user records.
- B3: On-login self-heal check for missing records.

### Epic C - Frontend Maintainability
- C1: Meal planner module split.
- C2: Settings module split.
- C3: Shared recipe generation service.
- C4: Feature-folder conventions doc.

### Epic D - QA and DevEx
- D1: Test harness setup.
- D2: CI setup.
- D3: Critical-path tests.
- D4: Contribution checklist + PR template.

## Risks and Mitigations
1. Risk: Refactor introduces regressions in dashboard UX.
- Mitigation: Module split with behavior snapshots and incremental PRs.

2. Risk: Billing edge cases in retries/webhooks.
- Mitigation: Idempotency keys, unique constraints, immutable event logs.

3. Risk: Slow delivery due to no current test baseline.
- Mitigation: Prioritize minimal critical-path tests before deeper refactors.

## Definition of Done for V2 Platform Prep
- Critical billing/auth issues resolved.
- Onboarding and credit updates are atomic server-side operations.
- Large dashboard modules decomposed.
- CI with lint/typecheck/tests enforced.
- Technical docs updated for future contributors.

## Suggested Delivery Cadence
- Week 1: Phase 0 hotfixes.
- Week 2-3: Phase 1 + Phase 2.
- Week 4: Phase 3 quality gates.
- Week 5+: V2 features.

## Owner Checklist (per PR)
- Includes migration notes (if schema/edge changes).
- Includes rollback notes.
- Includes test updates.
- Includes monitoring/logging impact notes.
