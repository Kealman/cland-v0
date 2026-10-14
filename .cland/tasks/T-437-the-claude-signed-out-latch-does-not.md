---
id: T-437
kind: task
title: The fake Claude harness completes turns while signed out, so a restart's reconnect turn lifts the latch in tests
state: open
status: review
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
updated: 2026-10-14T19:29:51.763Z
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
- [x] C2. A frame test restarts the hub with a latched per-account directory and a running session on it. It sees 0 `agents --json` calls for that directory over at least three 30 s periods, and the session keeps `reason=signed-out`.
  - done: impl-437 · 2026-10-14T19:22:48.419Z

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
