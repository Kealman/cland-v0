---
id: T-665
kind: task
title: Suite and executor test fixtures name their commands and carry a stub of cland's runner
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-664
topic: topic-569
branch: t/T-665-suite-and-executor-test-fixtures-name
created: 2026-10-16T16:35:23.892Z
updated: 2026-10-19T11:47:44.718Z
closed: 2026-10-19T11:47:44.718Z
---

## Summary

Prefactoring, with no change to behaviour. The temporary projects that the suite and executor tests verify write `[verification] check` and `test` matching their package scripts. They also carry a stub `hub/test/run-suite.ts`, so they stay "cland-shaped" when ticket T-666 makes verify read the commands and ticket T-667 keeps cland's selection for candidates with the runner. An option builds an "other stack" project without the stub, for the tests that follow.

## What to build

- **Commands.** The fixtures that write a `package.json` with `typecheck` and `test` scripts also write `check = "npm run typecheck"` and `test = "npm test"` into the `[verification]` table of their `config.toml`: `hub/test/suite-fixture.ts`, `close-run-fixture.ts`, `remote-fixture.ts`, `prepared-project.ts` and `droplet-fixture.ts`. The tests that write such a project directly get the same lines: `executor.test.ts`, `suite-cancel.test.ts`, `suite-human.test.ts`, `suite-cache-recovery.test.ts` and `task-card.test.ts`. Find the rest with a grep for `scripts:` and `"scripts"` under `hub/test`. A test that plants a typecheck failure keeps planting it through its script.
- **The runner stub.** The same fixtures commit a stub `hub/test/run-suite.ts` by default. Today the hub probes the candidate's runner file in two places. In the suite worker, a missing file or one containing `inheritedLease` means the runner borrows the worker's lease. At submission, a file containing `reduceCoverage` turns coverage recording on. The stub's text names `inheritedLease` and not `reduceCoverage`, so both probes decide as they do today without the file. Tests that already write their own runner file, such as `suite-close.test.ts` with its `reduceCoverage` stub, keep it.
- **Other stacks.** The fixtures take an option (for example `stack: 'other'`) that writes neither the stub nor a `package.json`. With it, the caller passes its own `check` and `test` lines, such as `sh -n test.sh` and `sh test.sh`.
- **Shard manifest.** The stub lies outside the hub shard globs (`*.test.ts`), so `hub/test/shards.json` and `npm run test:shards` are unaffected. Confirm that.

**Keeping cland's own suite intact.** Only test fixtures change, and the stub keeps both runner probes' decisions. The hub reads none of the new lines until ticket T-666, so the whole suite passes with no assertion changed.

## Acceptance criteria

- [x] C1. Every fixture project that writes package scripts also writes matching `check` and `test` lines, and a grep under `hub/test` finds no writer without them.
  - done: impl-665 · 2026-10-19T07:59:41.613Z
  - verified: rev-30 [reviewer] · run rev-20261019-665-source-corrected · 2026-10-19T08:02:49.033Z · commit a4c3f1eae02bc0a7038b7d29aed38baf5b601be3
  - verified: rev-30 [reviewer] · run rev-20261019-665-shared-source · 2026-10-19T08:38:23.576Z · commit bbfaafe84ee4dadd9026c22dce56f06ae77163fb
  - verified: rev-30 [reviewer] · run rev-20261019-665-final · 2026-10-19T08:55:58.914Z · commit bbfaafe84ee4dadd9026c22dce56f06ae77163fb
- [x] C2. The fixtures commit a stub `hub/test/run-suite.ts` that the worker reads as borrowable and the submission reads as not coverage-capable (assertion added in `suite-fixture.ts`'s own test or `suite.test.ts`).
  - done: impl-665 · 2026-10-19T07:59:42.066Z
  - verified: rev-30 [reviewer] · run rev-20261019-665-source-corrected · 2026-10-19T08:02:49.033Z · commit a4c3f1eae02bc0a7038b7d29aed38baf5b601be3
  - verified: rev-30 [reviewer] · run rev-20261019-665-shared-source · 2026-10-19T08:38:23.576Z · commit bbfaafe84ee4dadd9026c22dce56f06ae77163fb
  - verified: rev-30 [reviewer] · run rev-20261019-665-final · 2026-10-19T08:55:58.914Z · commit bbfaafe84ee4dadd9026c22dce56f06ae77163fb
- [x] C3. A fixture built with the other-stack option has no `package.json` and no runner stub, and its `config.toml` holds the caller's lines.
  - done: impl-665 · 2026-10-19T08:02:08.270Z
  - verified: rev-30 [reviewer] · run rev-20261019-665-source-corrected · 2026-10-19T08:02:49.033Z · commit a4c3f1eae02bc0a7038b7d29aed38baf5b601be3
  - verified: rev-30 [reviewer] · run rev-20261019-665-shared-source · 2026-10-19T08:38:23.576Z · commit bbfaafe84ee4dadd9026c22dce56f06ae77163fb
  - verified: rev-30 [reviewer] · run rev-20261019-665-final · 2026-10-19T08:55:58.914Z · commit bbfaafe84ee4dadd9026c22dce56f06ae77163fb
- [x] C4. The hub-level suite and executor tests pass with no assertion changed, and `npm run test:shards` passes.
  - done: impl-665 · 2026-10-19T08:53:51.839Z
  - verified: rev-30 [reviewer] · run rev-20261019-665-final · 2026-10-19T08:55:58.914Z · commit bbfaafe84ee4dadd9026c22dce56f06ae77163fb

## Comments

### impl-665 · 2026-10-19T07:59:43.030Z

Implemented on 127c799927d88ad838602bd34d1cd26ac93f92bb; pushed task branch after fetching and merging origin/dev (already current). Evidence A-5867 records script-writer audit, default committed runner probe contract, other-stack file-only contract, and passing targeted checks. Existing assertions unchanged. QA policy is none/after-stage; requesting source review before mode-free verification. C4 full task receipt pending; T3/batch/stage evidence is landing evidence.

### rev-30 · 2026-10-19T08:01:37.300Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-665-source
commit: 127c799927d88ad838602bd34d1cd26ac93f92bb
scope: full
findings: [{"severity":"medium","text":"M1: New other-stack contract is file-only but is placed in the T3 suite lifecycle carrier. T1 suffices under docs/agents/tests.md's lowest-tier rule; ordinary task verification would skip this regression. Move it to an appropriate T1 carrier, retaining all command and absence assertions.","file":"hub/test/suite.test.ts","line":308}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear, one medium Standards finding M1; no Spec findings. A-5869 records all 13-file review and package-writer/probe audit. Functional fixture implementation matches C1–C3, but C3's new file-only contract is unnecessarily T3 and absent from the ordinary task gate. Existing native lifecycle assertions should remain. A-5868 preserves captured host evidence, including test:shards/typecheck success and disclosed pre-final-addition provenance. C4's exact-head mode-free task receipt remains pending. No verify at this head; request fresh source review after the test placement correction.

Criteria: C3 failed (Move the new file-only other-stack regression out of the T3 lifecycle carrier to T1, preserving its assertions.).

### impl-665 · 2026-10-19T08:02:08.744Z

Addressed review M1 at a4c3f1ea: moved other-stack file-only contract with all assertions unchanged to existing T1 verification-commands.test.ts. Targeted T1 file 3/3 (278.471291 ms), typecheck, test:shards and diff checks pass. Native probe additions remain in suite.test.ts; no manifests changed. New source review requested before verification.

### rev-30 · 2026-10-19T08:02:49.033Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-665-source-corrected
commit: a4c3f1eae02bc0a7038b7d29aed38baf5b601be3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 resolved, no findings remaining. A-5871 incorporates full writer/probe audit and verifies the two-file correction moves all other-stack assertions unchanged to existing T1 verification-commands.test.ts. Native committed-runner probe assertions stay in suite.test.ts. C1–C3 verified. C4 remains pending exact-head mode-free task receipt, together with preserved host native evidence A-5868 and shard/type checks A-5870. No production or manifest changes, no dev merge. Reviewer performed no source edits or tests.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-665 · 2026-10-19T08:18:26.751Z

Same-head mode-free verification aab19490-ba38-462e-a356-1d60d75e90d6 failed load-gate repetition 2 for unchanged nvim/test/explorer-card-component.test.ts::rapid j movement fetches only the rested row, reuses cached details and refreshes on updated (4/5 passed; no row under cursor). Evidence A-5881. Hub summary 1476/1476 green; overall 3485 pass / 1 fail. Reported shared-defect candidate to supervising lead; holding diagnosis and retries pending Coordinator direction. Head remains a4c3f1ea.

### rev-30 · 2026-10-19T08:18:54.707Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-665-runtime
commit: a4c3f1eae02bc0a7038b7d29aed38baf5b601be3
scope: evidence
findings: [{"severity":"medium","text":"Runtime gate aab19490 / A-5881 exits 1: rapid-j card test's second load repetition finds no row under cursor; group is 4/5. Ordinary 1476/1476 passing tests do not clear the failed repetition gate. Shared-defect classification/disposition is pending; no T-665 source cause established.","file":"nvim/test/explorer-card-component.test.ts","line":196}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear; A-5882 retains exact failure and head. Ordinary phase finals 378+866+232=1476 pass, but one of 396 load groups fails 4/5; all other groups pass. T1 other-stack regression passes ordinarily and 5/5; zero tier-mismatch rows. C1–C3 source verification remains, C4 failed for task gate. Existing T-848 has a similar same-file symptom but a different test identity; this review does not equate their causes. Aside Bugs/S candidate already routed by Implementer to lead T-665; no retry, unrelated diagnosis or source changes requested pending Coordinator disposition.

Criteria: C4 failed (Same-head task gate aab19490 failed explorer-card rapid-j load repetition (4/5); await lead/Coordinator classification and accepted replacement evidence.).

### impl-665 · 2026-10-19T08:35:15.162Z

Coordinator-authorized single retry fe6ad676-357d-4599-96ee-dd37fed73979 failed at unchanged a4c3f1ea on the same T-848 explorer-card rapid-j identity, repetition 5 (4/5 passed). Log A-5899; ordinary summary 1476/1476 passed, total completed 3485 pass / 1 fail. Reported repeated failure to supervising lead. Per Coordinator instruction: no further retries, diagnosis or source changes; waiting for shared fix/direction. C4 remains blocked.

### rev-30 · 2026-10-19T08:35:40.139Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-665-runtime-retry
commit: a4c3f1eae02bc0a7038b7d29aed38baf5b601be3
scope: evidence
findings: [{"severity":"medium","text":"Authorized single same-head retry fe6ad676 / A-5899 repeats T-848's rapid-j load failure (repetition 5, 4/5, no row under cursor). C4 cannot clear despite 1476/1476 ordinary passes; Coordinator directed report/no changes if repeated.","file":"nvim/test/explorer-card-component.test.ts","line":196}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime retry remains not clear. Coordinator decision 1d966d8c-c8d6-4f20-80b7-6e8e1f045230 read back: first failure classified T-848; exactly one same-head retry authorized, then report/no changes if repeated. A-5899 repeats the same identity in repetition 5 (prior repetition 2). Full log zero tier-mismatch rows, one of 396 load groups fails 4/5; ordinary 1476/1476 pass. C1–C3 source verification unchanged; C4 remains failed. Retain both failed receipts. No further retry authorized by this review; Implementer already escalated to lead/Coordinator and is holding.

Criteria: C4 failed (Authorized retry fe6ad676 repeats known T-848 explorer-card failure, 4/5; no more retries/edits pending Coordinator shared-fix disposition.).

### impl-665 · 2026-10-19T08:37:33.433Z

Per Coordinator shared-fix directive, cherry-picked final-clear T-848 commit 4f6c6775 onto prior reviewed a4c3f1ea. New pushed head bbfaafe84ee4dadd9026c22dce56f06ae77163fb changes only nvim/test/explorer-card-component.test.ts's shared shown() helper. No other edits or dev merge. Provenance A-5903; requesting delta source review before new-head mode-free verify. Prior red receipts retained.

### rev-30 · 2026-10-19T08:38:23.576Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-665-shared-source
commit: bbfaafe84ee4dadd9026c22dce56f06ae77163fb
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Shared-fix delta source clear; no findings. A-5906 confirms Coordinator af2b5994 authorization and exact one-file cherry-pick equivalence to final-clear T-848 commit 4f6c6775. shown() observes cursor readiness then matching drawn card/text with separate bounded yielding RPC reads; no test bodies/assertions removed, no other task changes or dev merge. C1–C3 fixture source refreshed at bbfaafe8. C4 remains pending the required new-head mode-free gate; failed A-5881/A-5899 remain preserved. Responsible T-848 final evidence A-5903 is fix provenance, not a combined-head receipt. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-19T08:55:58.914Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-665-final
commit: bbfaafe84ee4dadd9026c22dce56f06ae77163fb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5924. A-5919 / 0daf4073 exact-head gate audited: 1476/1476 ordinary passed, zero fail/cancel/skip/TODO; zero tier-mismatch rows, all 396 load groups 5/5. Previously failing rapid-j explorer-card case now passes ordinarily and 5/5; historical A-5881/A-5899 retained. Source A-5871/A-5906 plus qualified host A-5868/A-5870 suite/executor, shards/typecheck and corrected T1 carrier evidence establish C1–C4. Linux task T3 not claimed; landing batch owns it. No findings; report-only lint/duration findings disclosed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T11:47:44.718Z

Merged 62963541f35ac22ff35886df6e0b601b0dde01f1 onto dev.
