---
id: T-497
kind: task
title: "suite-runner test: second nvim runner misses the fixed 500 ms contention window and never reports the holder (Linux, under load)"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-301
branch: t/T-497-suite-runner-test-second-nvim-runner
created: 2026-10-15T13:48:51.140Z
updated: 2026-10-15T16:44:32.133Z
---

## Problem

`hub/test/suite-runner.test.ts:76`, 'two nvim suite invocations serialize and report the holder', failed on Linux in T-393's droplet verify 282b9c70 at bedfcef3 (A-3038). The expected waiting-for-holder diagnostic didn't appear within 20 s. The case holds the first runner for a fixed 500 ms before starting the second, so under load the second runner can miss the contention window. The whole file passed 5× alone on the Mac, 250/250 (A-3043).

## Acceptance criteria

- [x] C1. The case keeps the first runner holding until the second has observably started waiting, using a gate or file signal rather than a fixed 500 ms. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
  - done: impl-497 · 2026-10-15T15:16:07.738Z
  - verified: rev-30 [reviewer] · run rev-20261015-497-source · 2026-10-15T15:17:23.945Z · commit b53da58894f1150cbf54f5df8691cdd27ac032c2
  - verified: rev-30 [reviewer] · run rev-20261015-497-delta · 2026-10-15T15:23:49.163Z · commit 9b10339a8cd82da4d7d92753e927ca30564ad2db
  - verified: rev-30 [reviewer] · run rev-20261015-497-final · 2026-10-15T16:44:27.454Z · commit 9b10339a8cd82da4d7d92753e927ca30564ad2db
- [x] C2. suite-runner.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-497 · 2026-10-15T15:43:49.269Z
  - verified: rev-30 [reviewer] · run rev-20261015-497-linux-first · 2026-10-15T15:44:13.513Z · commit b53da58894f1150cbf54f5df8691cdd27ac032c2
  - verified: rev-30 [reviewer] · run rev-20261015-497-final · 2026-10-15T16:44:27.455Z · commit 9b10339a8cd82da4d7d92753e927ca30564ad2db

## Comments

### impl-497 · 2026-10-15T15:07:09.330Z

Reproduced the exact missing waiting-for-holder symptom on Mac: temporarily delayed starting runner 2 by 750 ms; the unchanged nvim assertion failed in until() after ~20 s (test total 22.20 s). This pins the race to the fixed 500 ms holder window. Replacing that artificial work with a release file opened only after the existing holder PID assertion. Keeping all assertions and time bounds. Temporary delay will be removed after a green check.

### impl-497 · 2026-10-15T15:16:08.639Z

Implemented in b53da58894f1150cbf54f5df8691cdd27ac032c2. Evidence A-3102 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3102-t-497-mac-test-evidence-five-serial-whole-file-passes contains five serial whole-file Mac passes (250/250), labels and timings, and the deterministic delayed-start red/green result. Temporary delay removed; every assertion/time bound unchanged. Fetched and merged origin/dev 8389c3dd before commit/push. C2 awaits post-review Linux verify.

### rev-30 · 2026-10-15T15:17:23.945Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-497-source
commit: b53da58894f1150cbf54f5df8691cdd27ac032c2
scope: full

Source review clear at b53da58894f1150cbf54f5df8691cdd27ac032c2; no high, medium or low findings.

Standards: no findings against repo observed-state test guidance or code-review smell baseline. A release file replaces the artificial 500ms work interval; it is scoped to the existing temporary fixture and shared hub/nvim parameterization. Existing runner teardown and directory ownership remain in force.
Spec: C1 verified. suite-runner.test.ts:66–79 holds the first fixture until the second emits the existing waiting-for-holder diagnostic and the exact first-runner PID assertion succeeds, then writes the release signal. Both exit-code assertions and the exact start/end serialization journal remain unchanged. The successor observes the already-created release file, so it cannot deadlock on the first holder's gate. Existing until limits and every assertion remain. Commit body records the fixed-window root cause and removed delayed-start probe.

A-3102 records deterministic 750ms delayed-start old-red/new-green, probe removed; five serial whole-file Mac logs each show 50/50, no failures/skips/cancellations (250/250). Labels distinguish brief first-run overlap with automatic fallback from four quiet runs, permitted by E-482 1ba48602. Identical task file used before final dev integration; exact-head typecheck is pending the post-source verifier.

Reviewed git diff 8389c3dd45f92848dd43290f33f29fe1a9feed5a...b53da58894f1150cbf54f5df8691cdd27ac032c2, one commit/one file (4+/2-); git diff --check green. C2 remains unverified pending accepted same-head Linux gate. Both Standards and Spec reviewed directly; role prohibits delegation. No Reviewer tests or edits.

Criteria: C1 verified.

### rev-30 · 2026-10-15T15:23:49.163Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-497-delta
commit: 9b10339a8cd82da4d7d92753e927ca30564ad2db
scope: delta

Delta source review clear at 9b10339a8cd82da4d7d92753e927ca30564ad2db; no high, medium or low findings.

Standards: shared heartbeat duration commits are integrated with the correction: parsed manifest has the measured 5.113s allowance under allow, reason and A-3109 provenance, and no stray root key. No test assertion or budget-wide override added.
Spec: suite-runner.test.ts is byte-identical to source-reviewed b53da588; net task diff against merged dev 7df53ebe remains only the six-line holder fixture change. C1 reverified: release follows observed waiter/exact holder PID and preserves every assertion/time bound. Inherited T-495 is already final-reviewed with accepted Linux evidence; rulebook/tracker updates add no task-local seam change.

Reviewed b53da588..9b10339a and net task diff 7df53ebe...9b10339a; git diff --check green. Five Mac passes A-3102 remain supporting evidence for unchanged file. C2 awaits accepted Linux verification. Old immutable run d95c9b7a at b53da588 remains old-head evidence; await it rather than submitting overlapping verification, then request a current-head run after this clear. Both axes reviewed directly; no Reviewer tests or edits.

Criteria: C1 verified.

### impl-497 · 2026-10-15T15:43:49.947Z

C2 implemented evidence complete: five serial Mac whole-file passes (250/250, A-3102) and Linux droplet d95c9b7a at b53da588 green (A-3133), tests 1784; pass 1781; fail 0; skipped 3. Both touched cases green: hub 1.493s, nvim 1.557s. Host + droplet typecheck passed. Executor c-8 lon1 Linux x64, Node v24.21.0, lifetime 1299s, cost $0.0902. Current source-clear head remains 9b10339a; rev-30 confirmed own diff unchanged, and Coordinator ruling f900478e accepts this first receipt after pre-notice dev merge. Holding new verification submissions per Coordinator restart pause.

### rev-30 · 2026-10-15T15:44:13.513Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-497-linux-first
commit: b53da58894f1150cbf54f5df8691cdd27ac032c2
scope: evidence

Evidence review clear for immutable reviewed head b53da58894f1150cbf54f5df8691cdd27ac032c2; no high, medium or low findings in this receipt. This is not final clearance of current branch head 9b10339a8cd82da4d7d92753e927ca30564ad2db.

A-3133/d95c9b7a is Linux x64 c-8, exit 0, 1781 pass/0 fail/3 platform skips/0 cancelled. Host and remote typecheck, hub phases and Neovim smoke complete. All 50 suite-runner cases pass; changed hub/nvim serialization cases take 1.493325923 s and 1.557355101 s. No hard duration-budget failure; reported duration regressions are notices. Combined with previously checked A-3102's five whole-file Mac passes (250/250), C2 is verified at b53da588 only.

Current head 9b10339a already has clear delta source/C1 verification (rev-20261015-497-delta, A-3115); own file is byte-identical. Coordinator f900478e explicitly retains this integrated head, accepts this run as its first receipt and calls for the next droplet at 9b10339a as second. Therefore current-head final settlement remains pending that receipt; this old-head C2 mark will be stale against the current branch, intentionally. Submit no new verify during e6ea9694 hold; await restart notice. No Reviewer tests or edits.

Criteria: C2 verified.

### impl-497 · 2026-10-15T16:42:05.304Z

Exact-current-head second Linux receipt b2b552b1 is green at source-clear 9b10339a8cd82da4d7d92753e927ca30564ad2db: 1784 tests, 1781 pass, 0 fail, 3 skipped (A-3172). Droplet c-8 lon1, Linux x64, Node v24.21.0, lifetime 1416s, cost $0.0983. No source/head changes after review. First receipt A-3133 was also fully green; five serial Mac whole-file passes A-3102 remain supporting evidence. Awaiting Reviewer's final same-head evidence verdict.

### rev-30 · 2026-10-15T16:44:27.455Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-497-final
commit: 9b10339a8cd82da4d7d92753e927ca30564ad2db
scope: evidence

Final review clear at unchanged delta-reviewed 9b10339a8cd82da4d7d92753e927ca30564ad2db; no high, medium or low findings. C1 and C2 verified at this exact head.

C1: source/delta reviews A-3105/A-3115 stand. The first runner's release file is written only after the second observably waits and its exact-holder PID assertion succeeds. Original exit/serialization assertions and wait bounds remain. Commit records the fixed-window root cause; the controlled delayed-start probe was removed.

C2: A-3102's five serial Mac whole-file passes provide 250/250 tests, with brief first-run fallback overlap and four quiet runs labelled as previously accepted. Exact-current-head b2b552b1/A-3172 is Linux x64 c-8, exit 0, 1781 pass/0 fail/3 platform skips/0 cancelled; host/remote typecheck, hub and Neovim smoke all complete. All 50 suite-runner cases pass; changed hub/nvim holder cases 1.615512311 s/1.576779069 s. No hard duration-budget failure; regression lines are notices.

Older source-head d95c9b7a/A-3133 is also green; Coordinator f900478e's requested second receipt is now present at current head. No exception to a red suite is needed for this final pass. Read-only branch ref matches SHA; no source changes since delta clear. No Reviewer tests or edits.

Criteria: C1 verified, C2 verified.
