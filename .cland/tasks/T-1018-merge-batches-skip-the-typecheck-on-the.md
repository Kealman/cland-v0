---
id: T-1018
kind: task
title: Merge batches skip the typecheck on the combined tree, so two green tasks broke dev
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-928
branch: t/T-1018-merge-batches-skip-the-typecheck-on-the
created: 2026-10-20T17:30:31.804Z
updated: 2026-10-24T07:37:13.940Z
---

## Summary

Merge batches run `[merge] batch_tiers = ["T1"]` (D67) and no typecheck on the combined candidate tree. On 2026-10-20 T-979 (wire module with type-level conformance) and T-978 (adds `HubStatus.web`) each passed review and their own T0 at their own heads and landed in separate green T1 batches; the combination broke `npm run typecheck` on dev (TS2344, fixed by T-1017). Every task branch that merged dev then failed its T0.

## What to build

Every merge batch runs the T0 checks (at least `npm run typecheck` and the static lints) on the candidate tree before its tiers, and a red T0 bisects like a red tier. It is cheap (about 30 s) and catches cross-task type and lint breaks that per-branch T0 cannot.

## Acceptance criteria

- [ ] C1. A batch whose candidate tree fails `npm run typecheck` is red and its members are bisected, even when its T1 tests pass (test with two members that typecheck alone but not together).
  - failed: rev-26 [reviewer] · 2026-10-24T07:37:13.940Z · note A T0-only green omission/repeat can land without runtime tiers that original red T0 prevented from running.
- [ ] C2. The batch result names the T0 step with its duration, and `docs/agents/tests.md` documents it.
  - failed: rev-26 [reviewer] · 2026-10-24T07:37:13.940Z · note Original/recovered batch green accepts absent/conflicting T0 receipts because expected-step proof is omitted.

## Comments

### impl-1018 · 2026-10-24T07:30:34.890Z

TDD seams approved by the Coordinator in topic-928. Red proof: batch plan omitted check, and a TS2344/T0 receipt held the batch as 'no failing-test receipt'. Implemented mandatory check before configured tiers, timed T0 receipts for worker/host checks, additive diagnostic step selection and receipt-backed T0 bisection. Local macOS working-tree checks: npm run check green (static lint report mode, zero refusals), verification-commands 15/15 and merge-batches 37/37 T1, suite.test.ts 18/18 T3. Remaining: remote transport/demo targeted files, final dev integration and source review. No optional real-compiler regression; C1 uses the approved semantic receipt seam and the real repository command-plan assertion.

### rev-26 · 2026-10-24T07:37:13.940Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1018-source-1
commit: 6e762430c279cc3e96bbf04f20b816de79c0250c
scope: full
findings: [{"severity":"high","text":"M1: A failed original T0 stops runtime tiers, but a passing T0-only omission or same-tree repeat is returned directly as the landing candidate. Suites filters steps to check when files=[], so no configured T1/T3 ever runs before landing. After diagnostic selection, require the remaining configured batch tiers on that exact candidate (or rerun its full batch plan); test both unique-green omission and passing-repeat paths with a later tier failure.","file":"hub/src/hub/merge-batches.ts","line":240},{"severity":"medium","text":"M2: Original-batch diagnosticResult is called without expected steps, so outcome.code=0 with no T0 receipt (or a recorded nonzero T0) is accepted green. The receipt-backed check is only applied to diagnostic jobs. Require the configured check's successful receipt for original/recovered batches too, and hold missing/conflicting evidence rather than landing or reporting an unobserved T0 pass.","file":"hub/src/hub/merge-batches.ts","line":157}]
finding_counts: {"high":1,"medium":1,"low":0}

Full audit complete at6e762430. Spec M1high merge-batches.ts:240: redT0 prevents runtime tiers, but T0-only green omission/repeat directly becomes landing candidate; require configured tiers/fullplan at selected exactcandidate before landing, cover both success paths with later-tier red. M2medium line157: original diagnosticResult omits expectedsteps so outcome0/noT0 or conflicting redT0 isgreen; require receipt-backed configuredcheck on original/recovered success and hold missing/conflicting proof. C1/C2 failed. No independent Standards findings: plan/wrapper/host receipt, docs/help/clauses/skills/wire changes otherwise align. Coordinator-approved T1 semantic+realcommandplan seam accepted, no realcompiler test demanded. A-10386 local/T3 partial provenance retained; preserve original commands/stdout/exits/timings as artifacts without transcription reruns. Fresh corrected-head review before verify. NoQA requirement orReviewer runtime. A-10393: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10393-t-1018-source-review-at-6e762430.md.

Criteria: C1 failed (A T0-only green omission/repeat can land without runtime tiers that original red T0 prevented from running.), C2 failed (Original/recovered batch green accepts absent/conflicting T0 receipts because expected-step proof is omitted.).
