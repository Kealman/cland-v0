---
id: T-1435
kind: task
title: orphan-servers-perf's shared-deadline case misses its expected rejection once in a full macOS cover
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1207
branch: t/T-1435-orphan-servers-perf-s-shared-deadline
created: 2026-10-28T21:37:03.480Z
updated: 2026-10-29T18:17:53.479Z
---

## Summary

`hub/test/orphan-servers-perf.test.ts` "the shared sweep deadline preserves remaining servers and prevents later signals" (T4) failed once in the E-1311 stage-3 / E-1312 stage-2 macOS cover e4f27594 at adf3140c (A-13475): "AssertionError: Missing expected rejection" at line 27. The sweep with a 400 ms deadline resolved instead of rejecting with /deadline|failed|timed out/. It passed 5/5 alone right after (coord, 2026-10-28 21:40Z). The file's own header says its elapsed-time assertions need a quiet machine; it ran at the end of a full macOS cover (T4 phase, peak load 5.03).

## Acceptance criteria

- [x] C1. The test proves the deadline independently of host speed: it holds the TERM-resistant server alive through the deadline by a mechanism the test owns, rather than relying on the sweep taking longer than 400 ms of wall time, with 10/10 under two workers plus CPU load on macOS.
  - done: impl-1435 · 2026-10-29T18:17:53.186Z

## Notes

First sighting; load flake under the flaky-rerun rule (one cover resubmit).

## Comments

### impl-1435 · 2026-10-29T18:14:45.659Z

Scope/seam: retain native sweepOrphans process-lifecycle regression. No production, wire, schema or shared policy change. Plan to stop the owned native fixture, verify its stopped OS state, freeze Date at the sweep boundary, and expire that clock only when the sweep sends its first TERM. This keeps discovery outside the deadline race and makes deadline rejection independent of scheduler speed; actual OS signals remain observable. Awaiting Coordinator's separate exclusive stress slot.
