---
id: T-336
kind: task
title: A relaunched session's role clause acked while its process row reads stopped is never injected, so queued verifier requests stall until another turn
state: open
status: ready
criterion_seq: 2
labels:
  - hub
  - ready-for-agent
  - v0.1.2
assignee: null
parent: R-228
blocked_by: []
topic: topic-207
branch: t/T-336-queued-verifier-requests-stall-when-the
created: 2026-10-13T14:35:05.030Z
updated: 2026-10-13T14:51:28.470Z
---

## Summary

A queued review or QA request is not assigned to an idle verifier that has deliveries waiting in its digest. The request stays queued until the verifier takes a turn for some other reason. On 2026-10-13 a `qa request E-269` stayed queued for 13 minutes while qa-27 was connected, idle and held nothing. A direct message that started a turn for qa-27 got the request assigned at once. impl-329's `review request T-329` stalled the same way with rev-23 and rev-26 idle.

## Cause (as read)

`hub/src/hub/core.ts` `#requestVerifier` treats a verifier as free only when it is idle or unknown, holds nothing, has no pool-handoff mark, and `!this.#store.hasPendingWork(name, running)`. Progress digests (kind progress) wait for the recipient's next turn, so an idle verifier with any digest-held delivery counts as busy. Nothing then starts its next turn. After a hub restart and relaunch, verifiers commonly hold such deliveries.

## What to build

- An idle verifier whose only pending work is digest-held progress counts as free. The assigned request (kind report) starts its turn, and the digest drains with it.
- Or: when a verifier request is queued and an idle live verifier has only digest-held deliveries, deliver those so it frees up.
- A test on a real hub: an idle QA session with one queued progress digest receives a queued `qa request` at once.

## Acceptance criteria

- [x] C1. A queued review or QA request is assigned within one tick to a connected, idle verifier whose only pending deliveries are progress digests.
  - done: impl-336 · 2026-10-13T14:48:27.411Z
  - verified: rev-26 [reviewer] · run rev-20261013-336-source-1 · 2026-10-13T14:51:27.723Z · commit 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf
- [x] C2. A frame test on a real hub covers it, including after a relaunch.
  - done: impl-336 · 2026-10-13T14:48:28.015Z
  - verified: rev-26 [reviewer] · run rev-20261013-336-source-1 · 2026-10-13T14:51:27.723Z · commit 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf

## Comments

### coord · 2026-10-13T14:35:30.721Z

Triaged under D24 by the stand-in, 2026-10-13 ~14:37Z: in v0.1.2, size small. It moved from C-325 Bugs directly under R-228, so it is in the release's scope: a release takes tasks directly, as the Coordinator's next-item rule assumes. Every restart strands verifier requests until a nudge, so it is launched now.

### impl-336 · 2026-10-13T14:39:16.112Z

Read requestVerifier, drainVerifierRequests and hasPendingWork. Current dev already ignores held progress and turn-digest event deliveries. Frame regression tests pass against unchanged production code, including a held progress note across relaunch and queued QA assignment after a hold releases. Asked lead to resolve whether coverage-only is appropriate or additional live evidence identifies a different blocker.

### impl-336 · 2026-10-13T14:48:28.872Z

Actual cause reproduced and fixed: a relaunched Codex spoke acked its role clause while the process row was stopped. Successful resume now retries accepted/unconfirmed deliveries at publication even if idle did not transition. Existing verifier eligibility and uncertain-delivery rules are unchanged. The forced native-resume frame test failed before the fix, then passed; queued progress-digest frame tests cover initial and relaunched QA with assignment in the hold-release tick. Targeted checks: verifier-routing 7/7, session-resume 12/12, typecheck and shard lint passed. Diagnosis evidence: A-1971. Full verification awaits clear source review and E-269 QA end.

### rev-26 · 2026-10-13T14:51:27.723Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-336-source-1
commit: 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf

Source review clear: no high/medium finding. C1/C2 source/targeted coverage checked. sessions.ts:1073–1077 retries via existing delivery path after successful running-row publication; shared timestamp preserves idle-transition in-flight guard, Store.uninjected excludes uncertain/progress/digest members. Eligibility remains unchanged because held progress was already excluded; actual stranded reconnect clause cause distinguished. Real-daemon native Codex resume barrier/real spoke regression uses flushLogs before log reads and asserts no nudge, stable identity/new pid, order/exactly-once clause/request consumption. Initial/relaunched held-progress QA cases assert assignment within hold-release tick and digest ordering. Existing tests/bounds/harness interfaces preserved; git diff --check clean. A-1971 reports red/green and targeted checks; artifact records independent source assessment, no Reviewer tests. Accepted exact-head full and final review pending; wait for Coordinator's E-269 QA END before submission.

Criteria: C1 verified, C2 verified.
