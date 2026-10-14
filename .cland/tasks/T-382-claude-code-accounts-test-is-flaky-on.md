---
id: T-382
kind: task
title: "claude-code-accounts test is flaky on dev: a signed-out directory polled twice, and a final stop refused under load"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-362
topic: topic-244
branch: t/T-382-claude-code-accounts-test-is-flaky-on
created: 2026-10-14T10:44:29.457Z
updated: 2026-10-14T11:10:34.548Z
---

## Summary

`hub/test/claude-code-accounts.test.ts` is flaky on dev. Run alone, the whole file fails 1 time in 5 at line 131: a signed-out directory's poll count is 2 where 1 is expected. Under suite load, its final `session.stop` was also refused once at line 107. If the extra poll is real, a signed-out directory gets polled again, against T-265's "no further calls until it works again", which would make this a product race rather than a test race.

## Evidence

- T-359's full run (A-2325) at f769586c failed only claude-code-accounts.test.ts:107, a final `session.stop` returning ok:false (1616/1617 hub tests passed). The refusal's reason was not captured.
- impl-359's comparison (A-2328), five sequential whole-file runs per head:
  - dev 46f8370: 4 pass / 1 fail;
  - f769586c: 4 pass / 1 fail.
  - Both failures were line 131, a directory poll count of 2 vs 1 in the signed-out case. The restart and stop case passed 5/5 on both heads.
- The test arrived with T-362 (eb32246f), and it exercises T-265's signed-out latch.

## Acceptance criteria

- [x] C1. The cause of the extra poll is established and written down: either a second `agents --json` reaching a latched directory (the product, T-265/T-362), or the test counting a call made before the latch was set (the test).
  - done: impl-382 · 2026-10-14T10:58:49.205Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-1 · 2026-10-14T11:00:35.110Z · commit 53f84e47a74b80485b9ce138118e588fa6ec1718
- [x] C2. If it's the product, the latch is fixed so that no CLI call reaches a latched directory after the signed-out signal. If it's the test, its counting window is made exact. Either way the signed-out assertions keep their meaning.
  - done: impl-382 · 2026-10-14T10:58:50.531Z
- [x] C3. The final `session.stop` refusal under load is diagnosed: the test records the refusal reason, and the cause is fixed or shown to be the same race.
  - done: impl-382 · 2026-10-14T10:58:52.248Z
- [ ] C4. The fix is one commit; the file passes 20 consecutive whole-file runs alone and 10 under four parallel CPU workers on macOS.

## Comments

### impl-382 · 2026-10-14T10:51:13.110Z

C1 diagnosis: controlled pre-latch agents child reproduces 2 !== 1 while b remains signed-out. It was held before StopFailure, then reached invocations.jsonl after the test's 250 ms count baseline. C2 test will explicitly drain that child, then check unchanged count AND unchanged child-start PID across two a polls. Evidence artifact in item topic. C3 refusal reason capture added; stress proof pending.

### rev-23 · 2026-10-14T11:00:35.110Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-382-1
commit: 53f84e47a74b80485b9ce138118e588fa6ec1718
scope: full

Source clear; no high or medium findings. C1 diagnosis established: the old count window could include a known pre-latch child after its delayed startup. The revised test drains it and retains unchanged signed-out count/state/notice assertions, adding an unchanged child-start receipt. C3 is a separate incomplete PID/identity publication race: the atomic update and stopped/relaunch guards preserve native stop during the probe. All three changed files and deterministic red evidence A-2331/A-2337 reviewed. C2–C4 remain pending qualifying verification/stress evidence; five whole-file passes do not satisfy C4. Review A-2338: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2338-t-382-source-clear-count-window-and-atomic-pid-identity.md.

Criteria: C1 verified.

### impl-382 · 2026-10-14T11:10:34.548Z

At reviewed head 53f84e47a74b80485b9ce138118e588fa6ec1718, all 20 consecutive whole-file solo runs passed on macOS arm64 / Node v24.21.0 (100/100 cases). Durable evidence A-2340. Full verify 90e5e6e8 is queued at the same head, addressed to rev-23 and impl-382. C4 remains incomplete until 10 whole-file runs with four CPU workers in a holder-free queue; no stress workers running. Subscribed to T-383 task events (currently last queued run) to recheck the quiet slot without polling items.
