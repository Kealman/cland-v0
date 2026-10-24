---
id: T-1018
kind: task
title: Merge batches skip the typecheck on the combined tree, so two green tasks broke dev
state: open
status: review
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
updated: 2026-10-24T07:54:15.372Z
---

## Summary

Merge batches run `[merge] batch_tiers = ["T1"]` (D67) and no typecheck on the combined candidate tree. On 2026-10-20 T-979 (wire module with type-level conformance) and T-978 (adds `HubStatus.web`) each passed review and their own T0 at their own heads and landed in separate green T1 batches; the combination broke `npm run typecheck` on dev (TS2344, fixed by T-1017). Every task branch that merged dev then failed its T0.

## What to build

Every merge batch runs the T0 checks (at least `npm run typecheck` and the static lints) on the candidate tree before its tiers, and a red T0 bisects like a red tier. It is cheap (about 30 s) and catches cross-task type and lint breaks that per-branch T0 cannot.

## Acceptance criteria

- [x] C1. A batch whose candidate tree fails `npm run typecheck` is red and its members are bisected, even when its T1 tests pass (test with two members that typecheck alone but not together).
  - done: impl-1018 · 2026-10-24T07:53:19.069Z
- [x] C2. The batch result names the T0 step with its duration, and `docs/agents/tests.md` documents it.
  - done: impl-1018 · 2026-10-24T07:44:22.354Z

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

### impl-1018 · 2026-10-24T07:44:40.166Z

Source-review findings M1/M2 fixed at pushed head 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8. Added four static-diagnosis/full-confirmation T1 cases with config changes/reopen and green/red later tiers, plus two recovered missing/conflicting T0 cases. Red regressions were observed before fixes. Local macOS on corrected head: npm run check exit0 (test lint report mode, zero refusals), merge-batches43/43, verification-commands15/15. Native raw stdout/stderr/exit/timing receipts and source delta copied to A-10411, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10411-t-1018-m1-m2-raw-regression-and-committed-head-receipts. C1/C2 done again; fresh source review delivered to Reviewer before mode-free verify. No merge with dev after the first source review.

### rev-26 · 2026-10-24T07:47:29.908Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1018-source-2
commit: 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 322f3b6e/tree fa4e26d9, building on full A-10393. M1 resolved: static omission/repeat now selects a new exact-candidate full confirmation using the original recorded commands/tier selection across config reload/store reopen; later red runtime tier cannot land. Detached checkout can be recreated after diagnosis cleanup. M2 resolved: original/recovered successful batches with configured check require passing, nonconflicting T0 receipt; absent/conflicting proof holds durably. Four full-plan and two recovered-proof T1 regressions retain final assertions. Standards/docs/skills/provenance delta reviewed; no findings. A-10411 raw local corrected-head check0 (lint report-only/0 refusals), batch43/43 and commands15/15 retained; development red/green and old T3 source limits remain explicit. A-10418: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10418-t-1018-corrected-source-review-at-322f3b6e.md. C1/C2 runtime verification remains pending mode-free configured verification at this unchanged head; no current configured pass, Linux/T3/T4 or QA claim. Proceed to that run.

### rev-26 · 2026-10-24T07:52:22.043Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1018-evidence-1
commit: 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8
scope: evidence
findings: [{"severity":"medium","text":"M3: Configured T1 fails the unchanged compatibility matrix: fixture configures check, actual batch plan ['check','T1'] vs expected ['T1'] at115 (A-10432 lines4773–4790). Mandatory T0 is intended; migrate the batch expectation while retaining all other occasion and no-Web assertions. This task-owned test migration blocks configured verification; T2/Web never ran.","file":"hub/test/web-phase.test.ts","line":113}]
finding_counts: {"high":0,"medium":1,"low":0}

A-10432/653d0b93 at unchanged322f3b6e exits1: actual ['check','T1'], expected ['T1'] (web-phase.test.ts115). Source M1/M2 remain corrected perA-10418, but this compatibility migration was missed by source review. Independent native counts:782ordinary tests pass/1fail,133files pass/1fail;40actual load-gate tests+40files pass. T1exit1;T2/Web/T3/T4 absent, projections notpasses. Linux x64 c-8 lon1 cland-v0-38e799e9 Node24.21/Nvim0.12.5 workers2(T1serial), lifetime156s/$0.0108. Successful hostcheck reusedtree1bfc7fd7 remotely, lint/duration/tier/ratchet diagnosticsreport-only. A-10436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10436-t-1018-failed-configured-evidence-at-322f3b6e.md. Updateonly intended expectation with preserved final phase assertions, re-markC1done, new-head source review before fresh mode-free verify.

Criteria: C1 failed (Configured T1 fails the compatibility matrix's obsolete batch skip-check expectation; no accepted configured pass.).

### impl-1018 · 2026-10-24T07:53:35.683Z

Configured Linux run653d0b93 at322f3b6e failed T1 on the missed no-Web compatibility expectation: actual ['check','T1'], expected ['T1']; original A-10432 retained, T2/Web not executed. Fixed only expected list and added file guidance/index at pushed0e732613c193605b8ff09c72c0956bdc5134c066. Corrected-head local macOS: npm run check exit0 (lint report mode, zero refusals), web-phase8/8 and doclinks2/2 T1. Raw red/green/check outputs and exact delta A-10441, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10441-t-1018-m3-no-web-batch-expectation-native-receipts. C1 re-marked done; fresh source review routed to Reviewer before another mode-free run.

### rev-23 · 2026-10-24T07:54:15.372Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1018-source3
commit: 0e732613c193605b8ff09c72c0956bdc5134c066
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1018 M3-only delta source review — clear

Head 0e732613c193605b8ff09c72c0956bdc5134c066; tree 4bbc42268b8ef2e30daab26b8443dfacef975b11. Fixed accepted-source point 322f3b6ecaa43d4ff87ee96741d62b7aeb5840f8, reviewed by rev-26 in A-10418. Comparison git diff 322f3b6e...0e732613c193605b8ff09c72c0956bdc5134c066. Three files: one expected-list correction, new per-test guidance and index entry. No implementation or post-review dev merge. Run rev-20261024-1018-source3; findings []; C1/C2 runtime pending.

## Standards

No findings. M3 is resolved: the configured-check/no-Web batch expectation is now ['check','T1'], matching the intended mandatory T0 command plan. Every other occasion, no-Web exclusion and package phase assertion remains; test identity, fixture and observation bounds are unchanged. The separate fixture with no configured check still expects ['T1','T3']. This is a specific compatibility migration, not an assertion removed to hide failure.

The new document has the exact repository test path heading/index mapping. It accurately separates candidate command plans, package phases, configured check and Web exclusion. Existing T1 classification is retained, no new process/browser. Task worktree is tracked-clean at reviewed head; diff whitespace check passes.

## Spec

No additional findings. The prior accepted source review A-10418 and full review history carry forward unchanged: M1 requires full exact-candidate confirmation after T0-only diagnosis before landing; M2 requires successful configured T0 receipts on original/recovered batches. This delta does not modify either accepted implementation, their regressions, durable plans, protocol or role/skill guidance.

Source inspection confirms pinVerificationPlan starts with configured check and independently excludes Web for batch occasions. M3 updates exactly the stale expected list that failed configured T1. C1/C2 remain unverified until new-head configured evidence is accepted; this source clearance alone is not final runtime proof.

## Evidence and limits

A-10441 contains original native logs and exact source.patch. Prior-head isolated red reproduces the configured ['check','T1'] versus ['T1'] mismatch. Corrected-head local macOS arm64 receipts show whole web-phase file 8/8, docs guards 2/2 and npm run check exit 0; raw output is retained, 132 findings / 59 files remain report-only with zero refusals. No total npm-check wall time is inferred.

Old A-10432 / 653d0b93 at 322f3b6e remains failed T1 evidence: 782 ordinary pass / one fail plus 40 passing actual load repetitions, T2/Web absent. It is not relabelled green or reused at the new head. Proceed with mode-free verification at exact 0e732613. No new Linux/T3/T4/integrated or QA proof is supplied by these local checks.

QA policy none/after-stage, no per-item brief/criteria. Reviewer performed source/Git/artifact inspection only, no tests/probes, edits, browser, merge or delegation. Both axes completed in-session. Standards: zero findings. Spec: zero findings.
Durable review A-10450.
