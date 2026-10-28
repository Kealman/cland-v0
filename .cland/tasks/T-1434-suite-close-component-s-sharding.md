---
id: T-1434
kind: task
title: suite-close-component's sharding-fallback case times out on suite.start at the harness's 5 s bound once on a macOS stage cover
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1161
branch: t/T-1434-suite-close-component-s-sharding
created: 2026-10-28T19:57:06.286Z
updated: 2026-10-28T20:15:59.391Z
---

## Summary

`hub/test/suite-close-component.test.ts` "a batch sharding fallback publishes one warning frame and one whole-run result" failed once in the E-1312 stage-2 macOS cover 4d335435 at 2a0f4c43 (A-13439, T2, two workers, peak load 5.08) with "no result for suite.start within 5000ms" (hub/test/harness.ts:682). That is the harness's default 5 s request bound on its scratch hub. It passed 5/5 alone right after (coord, 2026-10-28 19:58Z). Same family as T-1423 (a 5 s harness request bound under load).

## Acceptance criteria

- [x] C1. The suite.start wait in this test is attributed from receipts (hub request time against the work done) and either bounded from them or shown to pass 10/10 under two workers plus CPU load on macOS, with no weakened assertions.
  - done: impl-1434 · 2026-10-28T20:08:52.261Z

## Notes

First sighting; load flake under the flaky-rerun rule (one cover resubmit). Consider a shared fix: a per-fixture request bound for heavy scratch-hub requests rather than the 5 s harness default (T-1423 did this locally for task.comment).

## Comments

### coord · 2026-10-28T20:02:44.108Z

Red again in the macOS cover resubmit 15b5e716 at 2a0f4c43 (A-13440): same identity, 5.129 s, same 'no result for suite.start within 5000ms'. Two in-suite reds against 5/5 alone means a defect, not a flake (flaky-rerun rule). It was green in the E-1311 stage-2 macOS cover af00dc78 at 60ad6021, so the trigger landed in 60ad6021..2a0f4c43 (T-1406, T-1403, T-1432, T-1388, T-1424, T-1407, T-1389). C1 must find which landing's in-suite effect delays suite.start.

### coord · 2026-10-28T20:03:11.657Z

Moved into 0.3 (R-1278) on the answer to ask 44154c80 (2026-10-28 20:03Z), under the human's standing yes of 05:04Z. Size raised to S: it needs attribution across seven landings.

### impl-1434 · 2026-10-28T20:08:14.051Z

C1 cause reproduced at the authorized frame/fake seam: after native scratch spend-lock release, reserveShardSpend remains asleep on injected +25ms retry at an unchanged fake clock; plain submission await fails the exact suite.start 5000ms error twice (5.219s). drive(f, submission) resolves it without changing any timeout or assertion. All shared production/fixture code at that boundary is byte-identical across 60ad6021..2a0f4c43; no receipt attributes the scheduling exposure to an individual landing. Pinned fallback passed 10/10 in two lanes plus one CPU load process on macOS arm64 Node v24.21.0; full touched file 12/12, typecheck passed. Durable detailed receipts in item topic artifact. Shared-contract inventory: no contract/policy/schema/consumer shape changes; only existing T2 test and its file-specific guidance change.

### rev-26 · 2026-10-28T20:11:20.050Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1434-source-1
commit: 51fb11f52bc450cb483464d3565e9a8c688cd644
scope: full
findings: [{"severity":"medium","text":"M1: missing/aborted retry setup leaves an uncancellable observer and unhandled/unjoined submission; caseDeadlines teardown waits pending work before fixture hooks can release the held spend lock. Pre-register one release/cancel/drain owner and test omitted/aborted setup through it before writer/storage cleanup.","file":"hub/test/suite-close-component.test.ts","line":349}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13443 full source1 not clear, consolidated M1 only. Happy-path drive correction preserves fallback assertions; Coordinator0f5beec0 accepts deterministic stranded+25ms retry diagnosis without naming a landing, and requires related undriven-fixture audit. Planned eight normal-await fixes not in this head. C1 remains unverified; lifecycle finding is not a fabricated behavior failure. Local exact-head/original load receipts and configured runtime pending; no reviewer workloads.

### impl-1434 · 2026-10-28T20:13:15.032Z

Coordinator disposition 0f5beec0 (topic-1161, 20:06:06) approves the deterministic attribution: this is a latent race exposed through T2 scheduling by the seven landings, not a regression attributed to any one landing. Related audit found eight other normal scripted suite-close-component launches with the same undriven planning retry; corrected them in this item. suiteUnit.launch already drives Suites.start; suite-cover stubs reservations; native integrated fixtures use real-clock retries; executor-admission-lock deliberately holds planning for shutdown and reads independent durable job receipts. Source review M1 cleanup ownership corrected with a pre-registered release/cancel/caught-submission/drain owner and omitted/aborted controls, all original assertions retained.

### rev-26 · 2026-10-28T20:15:59.391Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1434-source-2
commit: 7884115cdc67af1111f99ef46c989d28b08a6aac
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13445 source2 clear resolves M1 via pre-caseDeadlines real-context owner, captured lock/release, cancellation-aware bounded observation, caught/driven/joined submission and native I/O drainage; omitted/aborted controls retain native/durable/provider assertions. Related nine normal awaits now drive; intentional held cancellation unchanged. Coordinator accepts latent-retry mechanism without named landing attribution. C1 pending exact-head configured original runtime evidence and clearly scoped local receipts. No reviewer workloads, product/shared/timeout/tier changes or full run requested.
