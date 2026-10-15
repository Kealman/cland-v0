---
id: T-437
kind: task
title: The fake Claude harness completes turns while signed out, so a restart's reconnect turn lifts the latch in tests
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-262
branch: t/T-437-the-claude-signed-out-latch-does-not
created: 2026-10-14T19:14:23.326Z
updated: 2026-10-15T05:35:15.832Z
---

## Summary

The fake Claude Code harness (`hub/test/fakes/fake-claude.ts`) checks the `logged-out` marker only for `agents --json` and `--bg` (line 108). Its background turn loop (from line 461) still completes deliveries with a successful `Stop` and `turn-end` while the marker exists, which a signed-out Claude cannot do.

In E-272 QA run qa-2026-10-14-27-11, M20(f), that successful turn after the hub reconnect counted as a pushed success and lifted the signed-out latch, as specified at claude-code.ts:468–477. A latch FAIL was then reported. The product was correct: the latch survived the restart. There was no claude-b `agents` call from the restart (19:11:25Z) until the fake's turn-end at 19:11:27.588Z, and the first call came 375 ms later.

This item was first filed as a product regression and was rewritten after QA's timestamp check.

## What to fix

While `logged-out` exists, the fake's turn loop fails each turn the way a signed-out Claude does: an authentication error, and no successful `Stop` or `turn-end` hook. Add a frame test that restarts the hub with a latched directory and a running session, and proves that the latch holds through the reconnect delivery.

## Acceptance criteria

- [x] C1. With `logged-out` present, a fake Claude session's turn produces an auth failure and no successful turn-end hook.
  - done: impl-437 · 2026-10-14T19:22:47.359Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-437-1 · 2026-10-14T19:29:51.763Z · commit f098268b9300384ff6cb3831709bf361a50e9a96
  - verified: rev-23 [reviewer] · run rev-2026-10-15-437-3 · 2026-10-15T04:00:54.487Z · commit 7aa9053d2910f0ce82cb047a9a537e0082461fa3
  - verified: rev-23 [reviewer] · run rev-2026-10-15-437-4 · 2026-10-15T05:35:14.710Z · commit 7aa9053d2910f0ce82cb047a9a537e0082461fa3
- [x] C2. A frame test restarts the hub with a latched per-account directory and a running session on it. It sees 0 `agents --json` calls for that directory over at least three 30 s periods, and the session keeps `reason=signed-out`.
  - done: impl-437 · 2026-10-14T19:22:48.419Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-437-4 · 2026-10-15T05:35:14.710Z · commit 7aa9053d2910f0ce82cb047a9a537e0082461fa3

## Comments

### impl-437 · 2026-10-14T19:16:47.240Z

Re-read rewritten scope after QA confirmed persistence is correct. Testing at the pre-agreed hub frame/fake process seam: logged-out turns must emit authentication_failed and no successful Stop; restart/reconnect keeps the per-account latch over three default 30 s periods. Production persistence code requires no change.

### impl-437 · 2026-10-14T19:22:49.627Z

Fake fix implemented: each turn checks the same global/per-account logged-out markers as CLI launch/discovery, reports StopFailure authentication_failed and an error mod completion, and skips commands/replies/Stop. New frame test went red on successful Stop in 4 s, now green across reconnect and three real default 30 s periods, with one journal/Agents notice and successful recovery after marker removal. claude-code-accounts.test.ts passes 6/6; hub typecheck and diff check pass. Existing adapter file is running serially before review.

### rev-23 · 2026-10-14T19:29:51.763Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-437-1
commit: f098268b9300384ff6cb3831709bf361a50e9a96
scope: full

No high or medium Standards/Spec findings. Fake global/per-account logged-out checks emit StopFailure authentication_failed and an error completion before commands/replies, with no successful Stop; production unchanged. C1 source and focused red/green verified. Frame regression observes initial/reconnect hooks before checking the three real 30 s periods, retained signed-out reason, notice deduplication and genuine pushed recovery. Targeted A-2526 supports the implementation; C2 remains unverified pending complete exact-head no-mode local verification. A-2527: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2527-t-437-source-review-signed-out-fake-turns-and-restart-latch.md.

Criteria: C1 verified.

### rev-23 · 2026-10-15T04:00:15.600Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-437-2
commit: f098268b9300384ff6cb3831709bf361a50e9a96
scope: evidence

Gate cfca4ef1/A-2672 not clear: typecheck passes; full selected suite 2064/2065, exit 1, no skips/cancellations. Sole failure explorer-card.test.ts:243 gi thread-reference case reports card T-11/no row under cursor, exactly known T-439 readiness defect (earlier A-2532/A-2533, reviewed correction A-2536 landed a2f60f7a). Git confirms a2f60f7a is not an ancestor of this unchanged T-437 head. Own signed-out latch tests pass, but complete green evidence is absent; C2 remains unverified and C1 source basis A-2527 remains. A-2673 records exact result/shared-fix path. Lead notified for adoption disposition; changed integrated head needs source review before a new local no-mode gate. No unchanged flaky retry prescribed and no own criterion failure inferred.

### impl-437 · 2026-10-15T04:00:29.504Z

A-2672 exact-head verification: 2064/2065 pass, sole failure the known T-439 explorer-card gi readiness error. Followed Coordinator's conditional instruction by cherry-picking a2f60f7a alone as 7aa9053d, pushed. Original fake/latch code unchanged. Touched explorer-card file passes 15/15 serially outside cover-quiet. Requested delta source review before rerunning the local no-mode gate.

### rev-23 · 2026-10-15T04:00:54.487Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-437-3
commit: 7aa9053d2910f0ce82cb047a9a537e0082461fa3
scope: delta

Delta source clear. Standards and Spec: no high or medium findings. Independently compared complete patches: exact landed T-439 a2f60f7a, only explorer-card.test.ts, 29 insertions/7 deletions. Readiness waits establish focused mode, thread reference cursor and matching drawn card while retaining navigation, content, fold, scope and palette assertions. Original T-437 fake/latch code unchanged; C1 refreshed from A-2527. Targeted 15/15 reported by claimant. A-2674 details review. Earlier cfca4ef1/A-2672 remains red on that known T-439 defect; shared correction adopted, not an unchanged flaky retry. C2/final clearance requires new exact-head local no-mode gate. Submit at 7aa9053d.

Criteria: C1 verified.

### rev-23 · 2026-10-15T05:35:14.710Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-437-4
commit: 7aa9053d2910f0ce82cb047a9a537e0082461fa3
scope: evidence

Final clear at unchanged source-reviewed 7aa9053d. Standards and Spec: no high or medium findings. Full local no-mode 9f985532/A-2693 passes root typecheck and 2065/2065 (37 free hub, 1641 machine hub, 387 Neovim), zero failures/cancellations/skips/todos, exit 0. Real-frame latch regression passes in 95.307 s: logged-out initial/reconnect turns emit auth StopFailure with no successful Stop, running session retains signed-out across three actual 30 s periods with no per-directory agents calls; elapsed >=90 s, deduplicated journal/Agents notice and explicit successful recovery are asserted. C1/C2 established; both done marks checked. Earlier cfca4ef1/A-2672 remains red on known T-439 gi readiness, resolved by exact adopted a2f60f7a patch source-reviewed in A-2674 before this new-head green gate. No unchanged flaky retry used. A-2694 details final evidence; original fake/latch production scope remains unchanged.

Criteria: C1 verified, C2 verified.
