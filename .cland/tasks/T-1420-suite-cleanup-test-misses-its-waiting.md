---
id: T-1420
kind: task
title: suite cleanup test misses its 'waiting for a verified worker identity' log line once under load
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1198
branch: t/T-1420-suite-cleanup-test-misses-its-waiting
created: 2026-10-28T09:24:24.815Z
updated: 2026-10-29T17:04:03.118Z
---

## Summary

`hub/test/suite.test.ts::failure cleanup preserves a live worker whose recorded start identity is unavailable` failed once in coord's full verify e2311197 for T-1394 (Linux droplet c-8 lon1, head cad60172, log A-13169): the expected log line `suite cleanup waiting for a verified worker identity; process preserved` was absent (empty input) at suite.test.ts:268 after 4.07 s. It passed in every earlier run checked (A-13086–A-13114) and 5/5 alone on dev 95e764b1 (macOS, ~3.6 s). T-1394 does not touch suite cleanup.

## What to build

Find why the cleanup's log line can be missing when the assertion reads it under load (log flush ordering, the assertion reading before the cleanup reached that branch, or a timing-dependent identity probe) and make the test wait on the cleanup's own receipt rather than an immediate log read.

## Acceptance criteria

- [ ] C1. The cause is attributed from the failing output (A-13169) and the code: the case stopped the hub before the worker PID receipt, shown by a deterministic held-admission regression red at 7687a520; the unchanged case did not reproduce 5/5 under load (A-13833).
- [ ] C2. The cleanup identity and the new regression pass 10/10 under two owned busy CPU workers in one leased local probe at the reviewed head, with raw receipts.

## Comments

### impl-1420 · 2026-10-29T17:02:04.519Z

Baseline at dev 7687a520214e92f975cf658318390dd53828c295/tree a10e9b133b623174508489544199fa2ec6ca6628: targeted identity T3 passed 5/5 under two owned CPU workers in sealed clone, macOS darwin/arm64 Node 24.21.0, local executor, no browser, no suite budget gate. Both shared leases held; CPU progress and joins and per-run exits/pass lines recorded. Case durations 3.040, 3.097, 3.363, 3.379, 3.229 s; not a reproduction or C2 10/10. Existing T1 controlled-order identity cleanup regression also passes. T-825 already predates failing cad60172. Remaining suspected setup gap: launch reply permits null PID, but the test stops the hub and mutates its stored job without first waiting for workerPid(). No source changes. Baseline limit exhausted; awaiting Coordinator's decision.

### impl-1420 · 2026-10-29T17:03:44.453Z

Coordinator decision 8b9f5408: proceed with deterministic setup regression despite baseline 5/5 without reproduction. Red on 7687a520 plus test-only extraction: held LocalExecutor.occupied keeps the real frame/CLI job queued; launch snapshot pid is null. 'suite worker setup waits for admission rather than the launch PID snapshot' failed: null !== 56740 (1370.619 ms), expected admitted worker PID. Shared test fixture launchWorker now awaits existing workerPid receipt; lifecycle cleanup case uses it before hub.stop and DB mutation. This proves the setup race, not that it caused the historical Linux error. No hub/src or shared production contract changes.
