---
id: T-336
kind: task
title: A relaunched session's role clause acked while its process row reads stopped is never injected, so queued verifier requests stall until another turn
state: closed
status: done
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
updated: 2026-10-13T16:31:05.306Z
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
  - verified: rev-26 [reviewer] · run rev-20261013-336-source-2 · 2026-10-13T15:28:37.556Z · commit 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf
  - verified: rev-26 [reviewer] · run rev-20261013-336-source-3 · 2026-10-13T15:35:46.218Z · commit d609ac595e4b77ac63851d4491c7360c4f045578
- [x] C2. A frame test on a real hub covers it, including after a relaunch.
  - done: impl-336 · 2026-10-13T14:48:28.015Z
  - verified: rev-26 [reviewer] · run rev-20261013-336-source-1 · 2026-10-13T14:51:27.723Z · commit 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf
  - verified: rev-26 [reviewer] · run rev-20261013-336-source-2 · 2026-10-13T15:28:37.556Z · commit 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf
  - verified: rev-26 [reviewer] · run rev-20261013-336-source-3 · 2026-10-13T15:35:46.218Z · commit d609ac595e4b77ac63851d4491c7360c4f045578

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

### rev-26 · 2026-10-13T15:25:07.444Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261013-336-final-1
commit: 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf

Medium — nvim/test/palette.test.ts:164: completed full A-1984 / 3cf0415f fails centre-item navigation within the unchanged 10,000 ms bound; D25's accepted full gate is not met. Typecheck and both hub shards pass; Neovim 318/319, total 1793/1794, zero cancel/skip/todo. Cause and attribution remain unestablished; no retry or weakened bound. C1/C2's early-clause and initial/relaunched held-progress frame cases explicitly pass, so no criterion failure is asserted. Prior source assessment A-1975 remains valid; final evidence A-1985 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1985-t-336-final-verification-not-clear-at-3c185dc-neovim-item-navigation-fails.md).

### impl-336 · 2026-10-13T15:27:58.267Z

Full run 3cf0415f/A-1984: all hub phases green, one Neovim palette timeout (1793/1794 overall), peak 1m load17.86. Per Coordinator, ran the complete palette file three times on dev ccae33f and three at unchanged reviewed 3c185dc2, strictly serial: 108/108 pass, failing case353–478ms. Neovim source tree matches; case uses stub hub outside resumed-harness path. A-1986 records isolation. No speculative fix, no suite resubmission; awaiting Coordinator filing/rerun decision and Reviewer source confirmation.

### rev-26 · 2026-10-13T15:28:37.556Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-336-source-2
commit: 3c185dc2dddeb3019c7c04e4a1e9ec2ca00aa5bf

Source reassessment clear at unchanged 3c185dc2; no high/medium source finding. C1/C2 frame cases passed in A-1984. Neovim tree matches ccae33f, and the palette stub case does not exercise the changed native resume path. A-1986 reports six serial 18/18 comparisons; they do not reproduce or establish the failure's cause. A-1987 records independent source/diff assessment and comparison evidence limits. Final verification remains not clear per A-1985: preserve failed A-1984, obtain Coordinator authorization before another full run, and await an accepted same-head full receipt/final review before merge.

Criteria: C1 verified, C2 verified.

### impl-336 · 2026-10-13T15:34:32.859Z

A-1984's Neovim failure is the existing T-301 case, as identified by the Coordinator. Connected can precede both initial snapshots; the test's early empty-palette selection is discarded and later snapshots leave General open. Standalone shared fix7210621b waits for both fixture items and loaded tracker ladder before unchanged keys/assertions/screen bounds. Controlled delayed hub.status/task.list replay red before and green after; normal palette file18/18. A-1988 records evidence. Cherry-picked onto T-336 for delta review before a new full run.

### rev-26 · 2026-10-13T15:35:46.218Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-336-source-3
commit: d609ac595e4b77ac63851d4491c7360c4f045578

Source review clear: no high/medium finding. nvim/test/palette.test.ts:163–167 adds only a bounded fixture-state wait for T-12/T-13 plus loaded tracker ladder; false maps to undefined for eventually. Original keys, assertions, screen bound, harness and production are preserved. Reviewed shared 7210621b alone; cherry-picked file blob matches exactly. T-336 resume implementation/C1/C2 frame tests remain unchanged and passed in A-1984. A-1988 describes controlled delayed-snapshot red/green and 18/18 normal file; this is summarized Implementer evidence, not independent raw receipt verification. A-1989 records source review. Accepted full verification and final verdict at d609ac59 remain required; prior failed/cancelled receipts retained.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-13T16:31:05.306Z

Merged f9e499f5fbf4e324d5bd855bf5558f3cbd0cdcd0 onto dev.
