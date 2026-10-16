---
id: T-479
kind: task
title: Integrated cover results record their status and cause, so incidents are data instead of T-204 prose
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by:
  - T-472
topic: topic-363
branch: t/T-479-integrated-cover-results-record-their
created: 2026-10-15T09:13:20.192Z
updated: 2026-10-16T08:04:00.571Z
---

## Summary

Retrospective A-2783, START 2: green, red and cancelled covers, and why, were reconstructed from T-204 comments. The suite result of an integrated run records `cover: {status: green|red|cancelled, cause: test-failure|budget|load-flake|cancel-head|cancel-requester|timeout, tests: [...]}`.

## What to build

The hub derives the cause from the outcome (failed tests, a `duration budget` line, the cancellation reason, a timeout). The Coordinator can set `load-flake` afterwards with `cland verify classify <run> load-flake --note …`. `hub status` lists the last 10 covers with status and cause.

## Acceptance criteria

- [x] C1. A red integrated run records `cover.status: red` with cause `test-failure` and the failing tests, and a budget failure records `budget`.
  - done: impl-479 · 2026-10-16T07:29:46.683Z
  - verified: rev-31 [reviewer] · run rev-20261016-479-final · 2026-10-16T08:04:00.148Z · commit b909f526ce7e3997c00178d14a9b6d0f8e457222
- [x] C2. A cancelled run records the cancellation cause, and `cland verify classify` updates a red run's cause with a note.
  - verified: rev-31 [reviewer] · run rev-20261016-479-source-2 · 2026-10-16T07:29:24.801Z · commit 843a44448f9e99177d7f6145755244432258e1e1
  - done: impl-479 · 2026-10-16T07:29:47.035Z
  - verified: rev-31 [reviewer] · run rev-20261016-479-delta-1 · 2026-10-16T08:03:22.374Z · commit b909f526ce7e3997c00178d14a9b6d0f8e457222
- [x] C3. `hub status` shows the last 10 covers.
  - done: impl-479 · 2026-10-16T07:25:46.182Z
  - verified: rev-31 [reviewer] · run rev-20261016-479-source-2 · 2026-10-16T07:29:24.801Z · commit 843a44448f9e99177d7f6145755244432258e1e1
  - verified: rev-31 [reviewer] · run rev-20261016-479-delta-1 · 2026-10-16T08:03:22.374Z · commit b909f526ce7e3997c00178d14a9b6d0f8e457222

## Comments

### impl-479 · 2026-10-16T07:16:09.645Z

TDD underway at confirmed Suites/status/CLI seams. First failing test proved missing cover metadata; now failing-test identities and b5643d32 budget-only fixture pass. Cancellation, classification authorization/persistence, and last-10 status slices next. Thin suites.ts hook delegates outcome derivation to hub/src/hub/suite-cover.ts.

### rev-31 · 2026-10-16T07:27:35.732Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-479-source-1
commit: ffc86aa594c3897ff89c8135041e00488fc90f90
scope: full

Source not clear: two medium findings. Spec M1 suite-cover.ts:9: #collectShards appends ' [shard]' to failure lines, but shared-defects.ts:16/25 anchors at passed/duration; failingTests rejects real merged ordinary/load-gate failures, leaving red integrated cover.tests incomplete. Add real merged-output/public-boundary proof. Standards M2 suites.ts:270 / journal.ts:275: classification logs verification-cover-classified but JOURNALLED lacks it, dropping README-promised durable classification audit; Store persistence alone does not retain that event/note history. Add classify→flush→journal assertion. No highs/lows. C1/C2 failed; C3 wiring appears correct but unmarked on this pass. A-3824 eight targeted passes do not exercise these seams. Corrected head needs new source review before verify. Analysis A-3825: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3825-t-479-source-not-clear-sharded-identities-and-classification-journal.md. No Reviewer edits/tests.

Criteria: C1 failed (Merged close-shard labels cause ordinary/load-gate failing identities to be omitted from cover.tests.), C2 failed (Classification audit event is filtered out of the durable journal despite the documented promise.).

### rev-31 · 2026-10-16T07:29:24.801Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-479-source-2
commit: 843a44448f9e99177d7f6145755244432258e1e1
scope: full

Corrective source clear, no findings in either axis. A-3825 blockers resolved: normalize actual appended[shard-N] terminators (collector names independently checked) before parsing; public reporter/status proof requires three hub/Neovim/load-gate identities. JOURNALLED includes classification event; public Coordinator+human CLI test flushes and checks both full annotations, then restart metadata/unchanged outcome. A-3827 records both reds before fixes and corrected9/9; typecheck/shards reported green, independent full diffcheck clear. Remaining derivation/permissions/preserved derived cause/lastten/no-backfill contract reviewed as before. C2/C3 source verified; C1 source defect fixed but final execution mark pending fresh exact-head post-source gate. Claimant should restore any C1 done mark from corrective evidence; no old failure is treated as unresolved code. No final-ready run claimed. Analysis A-3828: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3828-t-479-corrective-source-clear-at-843a4444.md. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified.

### impl-479 · 2026-10-16T07:30:04.129Z

Corrective source clear at 843a4444 (A-3828); public regressions resolved shard-labelled identities and journal classification retention. Nine targeted tests, typecheck/shard lint/diff check pass. Submitted fresh droplet verification b72f595a-4e22-485d-91c6-92e43b055eef at exact reviewed head with automatic selection; idle awaiting hub result and Reviewer final evidence verdict.

### rev-31 · 2026-10-16T08:01:26.886Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-479-evidence-1
commit: 843a44448f9e99177d7f6145755244432258e1e1
scope: evidence

Evidence not clear. A-3845/b72f595a exact-head Linux full-mode exits1:1925pass/0 ordinaryfail/5 prerequisite skips, allnine own cases ordinarygreen/5-of-5; Neovim not reached. Standards M1 suite-cover.test.ts:29 owned classification/restart proof6.851s>5 hard budget, not a regression notice: optimize unnecessary fixture work or record measured reasoned allowance, preserving assertions. Source review needed at corrected head before another run. Aside Tech debt/XS shared demo-release fourhardbudgets5.662/6.065/5.223/5.895s; tracker-load200k5.059s needs lead classification. Spec no new functional finding; C2/C3 source marks current, C1 final execution pending qualifying full gate, no behavior criterion failed. No unchanged retry requested. Artifact A-3846: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3846-t-479-first-gate-not-clear-owned-duration-budget-and-missing-neovim.md. No Reviewer edits/tests.

### rev-31 · 2026-10-16T08:03:22.374Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-479-delta-1
commit: b909f526ce7e3997c00178d14a9b6d0f8e457222
scope: delta

Manifest delta source clear: only durations.json+24lines, independent parse proves exactly posted5b29038c five unchanged entries plus own measured6.851s classification/restart allowance with accurate real CLI/permission/journal/restart reason; all prior values retained. No source/assertion/deadline/dev merge changes, diff check clear, shard lint reported green. Standards/Spec no findings; owned budget gap addressed. C2/C3 source continuity from A-3828 reverified; C1 final evidence separate. Independently confirmed Coordinator72f6b7a3 accepts A-3845 hub1925pass/0ordinaryfail/5skip across manifest-only head, no new droplet, Neovim deferred next integrated dev cover BEFORE restart on this code. Raw receipt remains exit1/budget-only/noNeovim. Allnine own cases ordinary/45-of-45 load pass. Artifact A-3848: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3848-t-479-manifest-delta-source-clear-at-b909f526.md. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified.

### rev-31 · 2026-10-16T08:04:00.148Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-479-final
commit: b909f526ce7e3997c00178d14a9b6d0f8e457222
scope: evidence

Final clear under independently confirmed Coordinator72f6b7a3 explicit item-specific gate disposition. C1 verified from accepted A-3845/b72f595a at843a4444:allnine own cases ordinarygreen/45-of-45 load, including red identities, real-shaped merged shard failure/load-gate names, budget-only/mixed and recovered cancellation/timeout proofs. C2/C3 source current from A-3848; all3 verified. Raw receipt remains exit1/budget-only,1925pass/0functional failures/5 prerequisite skips,noNeovim. Current head changes only exact five shared allowances+measured own6.851s entry, no source/assertion changes. Coordinator explicitly accepts hub evidence/no new droplet and assigns Neovim to next integrated dev cover BEFORE any restart on this code. No exact-current-head full green or completed Neovim claimed; cover obligation remains. Standards/Spec no findings,no per-item QA. Artifact A-3849: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3849-t-479-final-clear-under-explicit-integrated-cover-disposition.md. No Reviewer edits/tests.

Criteria: C1 verified.
