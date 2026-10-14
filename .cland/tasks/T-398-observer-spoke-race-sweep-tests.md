---
id: T-398
kind: task
title: "Observer-spoke race sweep: tests observing a fake-harness session miss deliveries when the native spoke connects later (lead handover 1/5 alone)"
state: open
status: in progress
size: S
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-369
topic: topic-249
branch: t/T-398-observer-spoke-race-sweep-tests
created: 2026-10-14T12:41:56.075Z
updated: 2026-10-14T13:00:10.504Z
---

## Summary

The test 'lead-1 hands its node and question to lead-2; the next verdict reaches the new Lead through the fake harness' fails 1 in 5 when run alone. Its 5 s channel wait for lead-2 sees only lead-2's role clause. This is the observer race T-369 fixed in verifier-routing: a test-side observer spoke connects before the fake harness's native spoke, and the native spoke then becomes the newest delivery endpoint and receives the message. Every test using this observer-plus-native-fake pattern is exposed.

## Evidence

- T-347's run dde7d63b at cbbe6974 (A-2357): 1641/1642 hub tests passed, and the only failure was this test.
- Five runs alone at cbbe6974: pass, pass, fail, pass, pass. The failure was the same 5 s lead-2 wait, seeing only the Implementer clause, in a test of about 12.5 s. The logs are in topic-233.
- T-369 (e5bd6b89) fixed the same race in verifier-routing.test.ts by waiting for each fake session's first `session.usage` frame, which means the native MCP spoke is ready, before connecting the observer.

## Acceptance criteria

- [ ] C1. Sweep every hub test that connects an observer spoke for a session also driven by a fake harness, and apply T-369's readiness wait (the native spoke ready before the observer connects), or observe through the native session's delivery log. No assertion changes meaning.
- [ ] C2. List the swept tests and files in the review request.
- [ ] C3. The fix is one test-only commit, so it can be cherry-picked into every live branch.
- [ ] C4. Each touched file passes 20 consecutive solo runs, plus 10 under four CPU workers when the verify queue is empty.

## Comments

### impl-398 · 2026-10-14T12:44:25.799Z

Sweep found unguarded fake-Claude/native observer connections in ask-chain, lead-handover, lead-permissions, lead-routing, session-archive, session-holds, stage-qa, verifier-routing (8 test files). Added subscribed UI first-session.usage waits keyed to launched sessionId before observer connection; no existing assertion changed. Baseline lead-1 handover targeted run passed (1/1), prior 1/5 failure supplied by task evidence. Starting 20 consecutive whole-file solo runs, one file at a time while verify holds the host. Existing session-usage and session-events observers already follow usage waits; T-369's three-Reviewer observer already guarded.

### coord · 2026-10-14T13:00:10.504Z

Coordinator amendment to C4 (2026-10-14 13:00Z): lead-handover.test.ts gets 20 consecutive solo whole-file runs plus 10 under one runner and four CPU burners. The other 7 swept files get 5 consecutive solo runs each. A deliberate delayed-native-spoke reproduction on lead-handover goes red before the fix and green after. Reason: the literal C4 would cost about 2.5 h on the critical path.
