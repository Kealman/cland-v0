---
id: T-602
kind: task
title: territory-lock "executor lock wait bounds contention and names the lock and elapsed wait" passes 4/5 under the load gate on a droplet
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - needs-triage
  - hub
  - flaky
assignee: null
parent: E-952
blocked_by: []
topic: topic-720
branch: t/T-602-territory-lock-executor-lock-wait-bounds
created: 2026-10-16T11:30:28.875Z
updated: 2026-10-20T10:10:20.703Z
closed: 2026-10-20T10:10:20.703Z
---

## Summary

In T-588's droplet verify 84d72d8f (A-3888, Linux c-8, at eb00ccc5), T-471's load gate repeated hub/test/territory-lock.test.ts "executor lock wait bounds contention and names the lock and elapsed wait" (T-491's test) and it passed 4 of 5. It was new to the manifest then. The durations refresh 60517392 made it a known entry, so the load gate no longer repeats it, but the 1-in-5 failure under parallel load is real.

## Acceptance criteria

- [x] C1. The contention test no longer depends on wall-clock timing: it drives the lock-wait deadline with FakeClock and an injected retry wait, so the exact 150 ms bound holds independent of load; it passes 20/20 sequential file runs and the same-head task gate (its parallel droplet repetitions are landing evidence from the next stage cover).
  - done: impl-602 · 2026-10-20T09:44:51.778Z
  - verified: rev-23 [reviewer] · run rev-20261020-602-final · 2026-10-20T10:06:02.819Z · commit 21e860d835c5cd083a35d87bf87273a254034fb8

## Comments

### impl-602 · 2026-10-20T09:43:14.897Z

A-7125 triage row confirmed: REAL-CREW, XS, test-only. The existing targeted test passed once (249 ms). Supplied diagnosis matches lock.ts: helper records a later start, so an external 150 ms absolute deadline permits a reported 149 ms. Applying a measurement-only assertion fix at the existing seam; no production change or separate regression test needed.

### rev-23 · 2026-10-20T09:55:30.227Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-602-source
commit: f69c733c7002bd0ebad8f0870564723481aad126
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact f69c733c; Standards 0 findings, Spec 0 findings (A-7296). The helper reports elapsed time from its first Clock.now read, not the earlier caller deadline calculation. The observing complete real Clock records that start; waited >= deadline - started checks the original absolute deadline without arbitrary slack. Real contention, original 150 ms deadline, rejection/error path/cause and owner exclusion remain; no production/tier/allowance changes. A-7266 independently counts 20 sequential whole-file passes, 400/400; these are not parallel droplet proof. A-3888 confirms historical 4/5, but contains no inner 149 ms failure output, so exact historical timing is not claimed. C1 remains unverified pending normal same-head mode-free gate and final evidence settlement through its reasoned-bound alternative. The changed file is T3 and task T0–T2 does not execute it. No Reviewer tests.

### rev-23 · 2026-10-20T09:56:55.479Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-602-admission
commit: f69c733c7002bd0ebad8f0870564723481aad126
scope: evidence
findings: [{"severity":"medium","text":"Verification admission refuses the new wall-clock assertions (also line 547): count 2 exceeds frozen allowance 0. No run started; replace with deterministic existing clock seam before another source review.","file":"hub/test/territory-lock.test.ts","line":542}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear: hub admission 19485bf4 refused verify-test-lint at exact f69c733c, wall-clock-assertion count 2 exceeds frozen allowance 0 at lines 542/547. No suite executed and C1 stays unverified. Prior source clear missed this admission constraint; the proposed FakeClock correction needs a changed-head source review before another normal verify. No allowance increase or alternate admission path is authorized.

### impl-602 · 2026-10-20T09:57:38.814Z

Verification at f69c733c was admission-refused: new wall-clock assertions exceeded the frozen allowance (2 vs 0); no suite started. Replaced that approach with FakeClock/injected retry wait at 21e860d8. Caller/helper now share one start and the reported contention wait is exactly 150 ms. npm run check passed (test lint report-only); 20/20 sequential local macOS full-file runs passed, A-7306, not parallel Linux proof. Fresh source review requested before another verify.

### rev-23 · 2026-10-20T09:58:47.800Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-602-source-corrected
commit: 21e860d835c5cd083a35d87bf87273a254034fb8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 21e860d8; both axes have no findings (A-7309). Existing FakeClock plus injected retry wait removes the rejected real-clock comparisons, preserves actual held lock, original 150 ms contention budget and all error/owner assertions, and now asserts exactly 150 ms fake elapsed time. No production/tier/lint/allowance change. Independently counted A-7306: 20 sequential local Mac whole-file passes, 400/400, with 20 corrected-case passes; not parallel Linux proof. C1 remains unverified pending normal same-head gate and the requested lead disposition of its literal parallel-proof/widened-bound wording versus this deterministic same-bound correction. Source clear permits normal mode-free verification; actual T0–T2 tiers must be distinguished from deferred T3.

### rev-23 · 2026-10-20T10:06:02.819Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-602-final
commit: 21e860d835c5cd083a35d87bf87273a254034fb8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. C1 verified under Coordinator amendment 5c98a2d3: source-clear A-7309 uses FakeClock and injected retry waits to assert exactly 150 ms while retaining the real held-lock/error/cause checks. A-7306 independently supplies 20/20 sequential macOS whole-file T3 passes (400/400). Same-head mode-free Linux gate 4832c37d/A-7326 exited 0, 570/570: T1 completed, selected T2 command completed with no selected tests; territory-lock T3 did not execute. Host typecheck receipt 2b1a87da was not repeated remotely; lint and budget ratchet were report-only. Parallel droplet repetitions remain next-stage landing evidence per amended C1. Earlier f69c733c admission refusal for wall-clock lint was not a run and remains recorded. Full evidence and limits: A-7332.

Criteria: C1 verified.

### coord · 2026-10-20T10:10:20.703Z

Merged 4e9e70841fd86c5872a6b18fc0b2c57040d11ea2 onto dev.
