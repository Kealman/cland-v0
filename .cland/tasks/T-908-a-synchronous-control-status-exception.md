---
id: T-908
kind: task
title: A synchronous control.status exception escapes the socket dispatcher instead of returning a failed result
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-649
branch: t/T-908-a-synchronous-control-status-exception
created: 2026-10-19T20:32:34.913Z
updated: 2026-10-19T20:57:27.027Z
closed: 2026-10-19T20:57:27.027Z
---

## Summary

A synchronous exception thrown inside the hub's `control.status` handler escapes the socket dispatcher, so the client gets no failed result. impl-906b reproduced this on T-906 with an injected throwing status collector.

## What to build

The socket dispatcher catches a synchronous throw from any control handler, `control.status` included, and returns a failed result naming the error. The connection and the hub keep serving.

## Acceptance criteria

- [x] C1. A control handler that throws synchronously returns a failed result to the caller, and the next request on the same hub succeeds.
  - verified: rev-30 [reviewer] · run rev-20261019-908-final · 2026-10-19T20:51:25.777Z · commit f02dbedb27ca171fba9506298d8a5118ceb216c4
  - done: impl-908 · 2026-10-19T20:52:46.267Z
- [x] C2. A regression test injects a throwing status collector and observes the failed result.
  - verified: rev-30 [reviewer] · run rev-20261019-908-final · 2026-10-19T20:51:25.777Z · commit f02dbedb27ca171fba9506298d8a5118ceb216c4
  - done: impl-908 · 2026-10-19T20:52:46.750Z

## Comments

### impl-908 · 2026-10-19T20:33:54.774Z

Reproduced with a T1 public dispatcher conversation: injected status collector throws out of receive before the fix. Extended clientRequest's existing try/catch across the control switch. Regression covers status, reload and flushLogs synchronous throws, exact failed frames, then successful status requests on the same connection; targeted file passes.

### rev-30 · 2026-10-19T20:37:22.416Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-908-source
commit: a959f882c411c4ea2a52050f612bce899ffeff44
scope: full
findings: [{"severity":"high","text":"M1: A synchronous control.flushLogs() throw occurs before Promise.race attaches a handler to the deadline; its timer is never cleared and the unhandled rejection can terminate the live hub after 5000 ms. Handle invocation and deadline cleanup together, and cross the deadline deterministically in the injected regression.","file":"hub/src/hub/dispatch.ts","line":1583},{"severity":"medium","text":"M2: hub.stop sends success before calling control.stop(); a synchronous throw now sends a second failed result for the same id, so clients observe success. Ensure exactly one failed response for a throwing stop and cover later same-hub service.","file":"hub/src/hub/dispatch.ts","line":1594}]
finding_counts: {"high":1,"medium":1,"low":0}

Full source review not clear at a959f882. A-6650 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6650-t-908-source-review-deadline-cleanup-and-stop-response-findings.md) records both Standards/Spec findings and correction expectations. No Reviewer test execution. C2's injected status test exists, but source correction is required before exact-head mode-free verification.

Criteria: C1 failed (Synchronous flushLogs leaves an unhandled deadline rejection, and throwing stop sends success before failure.).

### impl-908 · 2026-10-19T20:38:18.610Z

Corrected source findings M1/M2. Expanded T1 regression deterministically ticks beyond the log-drain deadline, catches the old unhandled rejection, and checks throwing stop emits exactly one failure; normal stop acknowledgement also asserted. Invoked flushLogs before allocating its timer and invoked stop before acknowledging acceptance. Red reproduced both findings, then targeted 2/2 pass. Root typecheck passes; existing hub lifecycle file passes 6/6, including CLI stop and restart scenarios. No merge from dev after first review (rule 11).

### rev-30 · 2026-10-19T20:40:32.188Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-908-source-corrected
commit: f02dbedb27ca171fba9506298d8a5118ceb216c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, A-6663. M1 allocates no deadline before a synchronous flushLogs throw; M2 calls stop before sending success. Production stop yields before closing edges. Deterministic public conversation regression crosses 5000 ms, covers all four throwing controls, exact single failure and subsequent same-connection status, plus normal stop acknowledgement. Complete two-file correction and retained original scope reviewed; no other files/dev merge. A-6657 reported checks are prose, not independently audited raw execution. C1/C2 runtime settlement awaits exact-head mode-free gate; no Reviewer tests. QA none.

### impl-908 · 2026-10-19T20:49:50.050Z

Exact reviewed head f02dbedb verified green in mode-free run 1fd2dc1d-3e97-40c3-8376-51a47510e4e7: 1469/1469 tests pass, new control regression load gate 5/5 pass. Receipt A-6680. Linux x64 droplet c-8 lon1, lifetime 484 s, cost $0.0336. Queue-enabled task T0–T2 selection; T3 remains periodic/integrated (six existing lifecycle scenarios also passed in the targeted local check). Tree remains clean and unchanged; Reviewer receives the receipt directly for final settlement.

### rev-30 · 2026-10-19T20:51:25.777Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-908-final
commit: f02dbedb27ca171fba9506298d8a5118ceb216c4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6686. Independent raw A-6680/1fd2dc1d audit: 1469/1469, zero fail/cancel/skip/TODO; all 169 load groups 5/5, no tier/resource mismatch or owned overrun. New deterministic exception regression passes ordinary+five repetitions, maximum .038647469 s; retained drain barrier/deadline control passes. Source A-6663 resolves both earlier findings and proves exact single failed responses plus subsequent same-connection service for all four synchronous throwing controls, with normal stop acknowledgement retained. C1/C2 verified; covered report-only admission row follows Coordinator directive. QA none; no Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T20:57:27.027Z

Merged d644c8d395110272c274d5e9c90f51c5a1ecf483 onto dev.
