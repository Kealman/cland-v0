---
id: T-1178
kind: task
title: Web reconnect waits advance the fake clock without giving the real socket time to reconnect
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1163
topic: topic-901
branch: t/T-1178-web-reconnect-waits-advance-the-fake
created: 2026-10-23T09:40:21.371Z
updated: 2026-10-23T09:56:44.414Z
closed: 2026-10-23T09:56:44.414Z
---

## Summary

web/test/composer.test.ts:196–198 (T-1124) and web/test/asks.test.ts:310–313 (T-1163's fix) wait for the hub connection to read Live by advancing the page's fake clock in 250 ms steps up to 15 s of fake time, checking Live between steps with no real-time wait. The reconnect itself is real socket I/O, so under load the 60 steps finish in real milliseconds before the socket reconnects. T-1128's verify 08dcc577 (A-9942, Linux) failed composer.test.ts "per-topic drafts survive reload and hub disconnection…" with `bounded fresh-epoch reconnect`, false !== true.

## What to build

One shared helper in web/test/harness.ts that waits for Live by advancing the fake clock in bounded steps and, between steps, giving real time for the socket to connect, bounded by a fake-time ceiling and a real-time timeout. Both tests, and any other fake-clock reconnect wait in web/test, use it.

## Acceptance criteria

- [x] C1. web/test/harness.ts exports a reconnect wait that interleaves fake-clock steps with a bounded real-time poll, and composer.test.ts, asks.test.ts and every other fake-clock Live wait in web/test use it, with their assertions unchanged (test).
  - done: impl-1178 · 2026-10-23T09:45:32.307Z
  - verified: rev-23 [reviewer] · run rev-20261023-1178-final · 2026-10-23T09:53:14.098Z · commit fb9bb7509fbe386b12a3925df937ea070e97751b
- [x] C2. The composer and asks reconnect cases pass 20/20 alone and 10/10 under two CPU-load loops on macOS, with counts posted in the item topic (test).
  - done: impl-1178 · 2026-10-23T09:45:32.464Z
  - verified: rev-23 [reviewer] · run rev-20261023-1178-final · 2026-10-23T09:53:14.098Z · commit fb9bb7509fbe386b12a3925df937ea070e97751b

## Comments

### impl-1178 · 2026-10-23T09:42:02.443Z

Red reproduction on macOS/local at initial head: under two yes CPU loops, asks failed `AssertionError [ERR_ASSERTION]: fresh epoch live` / `false !== true` at asks.test.ts:313. Composer passed its first loaded attempt; repeating composer before applying the shared helper. Both load loops were reaped after the first pair. Queue showed local: none before stress. Existing sealed webFixture + authenticated rendered Live seam is the user-approved test seam.

### impl-1178 · 2026-10-23T09:45:32.259Z

C2 evidence at fb9bb7509fbe386b12a3925df937ea070e97751b, macOS/local targeted Web cases: composer 20/20 quiet + 10/10 under two yes CPU loops; asks 20/20 quiet + 10/10 under two yes CPU loops. No failures. Each is a fresh single-case Node test process using sealed webFixture and isolated Headless Shell. Stress checked verify queue local: none before starting and before each loaded run; both CPU loops terminated and reaped in finally. Raw logs and counts: A-9945 (.cland/artifacts/A-9945-t-1178-reconnect-red-20-quiet-and-10-loaded-runs-per-case.txt). Seven neighboring cases passed: connection backoff, topics replay/fresh snapshot, session-actions offline, Events fresh epoch, area-slots restart, session-launch offline, Inbox approval fresh epoch. Web typecheck and test lint passed (lint report mode, 0 refusals); no suite receipt yet. C1 shared helper and all grep-found paused-clock reconnect waits migrated with every original assertion retained. Pre-fix red: asks failed first loaded attempt (A-9944); composer passed 21 loaded attempts, so the reported composer failure was not reproduced on this macOS machine.

### rev-23 · 2026-10-23T09:47:21.687Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1178-source
commit: fb9bb7509fbe386b12a3925df937ea070e97751b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1178 source review
Head fb9bb7509fbe386b12a3925df937ea070e97751b
Tree 1f3d95f3240eb859ed1e70969196fc0048d41b09
Fixed base 8614eb6406dfbb6daee6a56c099781f5a0eb96e4 (merge-base with dev at review); one task commit. Diff git diff 8614eb6406dfbb6daee6a56c099781f5a0eb96e4...fb9bb7509fbe386b12a3925df937ea070e97751b.
Run rev-20261023-1178-source. Source clear, findings [].

Standards: pass. Against docs/agents/tests.md's bounded observable-condition guidance and role rules 9/15/17, helper web/test/harness.ts:27–46 uses the existing until deadline, checks the authenticated rendered Live condition, advances at most 15000ms fake time in 250ms increments and polls real browser evaluations for up to100ms between increments. It returns as soon as Live is observed and retains a final Live assertion. No unconditional sleep, wall-time assertion, new process fixture, product change or expanded authority/policy. The outer nominal15000ms bound inherits until's existing load scaling (default droplet factor2); it is not always an unscaled15s deadline. Polling real I/O is the explicitly requested seam. Existing sealed webFixture isolation and lifecycle cleanup are unchanged. No independent smell finding.

Spec: pass by source. All paused-clock reconnect patterns identified by git grep at the exact head migrate to the one helper: asks, composer, topics resume/fresh epoch, connection retry/backoff, session-actions, session-launch, area-slots, Events and Inbox. Remaining Live waits are initial authentication, reload/folds without paused retry-driving, or still retain their helper-adjacent final condition. Existing assertions are unchanged, including connection's249/1 and499/1 boundaries, exact attempts count2, fresh snapshot/history counts, no-replay, drafts, recovered ask/approval outcome, session facts and offline-disabled actions. Original caller setup observes the old Offline boundary before helper use. Product code and test tiers untouched; no command/policy/docs migration required.

Targeted evidence: A-9945 raw-log audit finds composer20/20 quiet+10/10 labelled loaded and asks20/20 quiet+10/10 labelled loaded, each one test pass/zero fail, plus browser census cleanup. Header attributes these to exact fb9bb750, macOS local. Seven neighboring reconnect cases/typecheck/lint passes are reported; no configured receipt exists yet. Original red asks false!==true is retained with A-9944 trace; pre-fix composer did not reproduce in21 reported attempts, so no composer-local red claim. The concatenated artifact lacks command exits and CPU-loop start/reap/queue receipts; implementer has been asked to preserve existing original records without transcription reruns. C2 load attribution remains pending that supplement. Source criteria are not marked verified while configured integration and evidence settlement remain pending.

Proceed with mode-free verification at this exact head. Reviewer ran no tests/browser and made no edits; no delegation under role restriction. qaPolicy none and no QA criteria. Final verdict must inspect exact-head configured result and finish C1/C2 evidence attribution.

### rev-23 · 2026-10-23T09:53:14.098Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1178-final
commit: fb9bb7509fbe386b12a3925df937ea070e97751b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1178 final evidence review
Head fb9bb7509fbe386b12a3925df937ea070e97751b / tree1f3d95f3240eb859ed1e70969196fc0048d41b09; branch tip unchanged.
Run rev-20261023-1178-final. Clear, findings[]; verified C1,C2.

Standards: source audit A-9947 carries forward. One bounded helper is used by every paused-clock reconnect wait; final existing assertions remain. No product/command/policy changes. Real deadline is nominal15000ms with existing until load scaling; fake advance ceiling remains15000ms. Reviewer made no edits and ran no tests/browser.

Spec and criteria:
C1 verified by exact-head source plus passing configured cases. reconnectUntilLive interleaves250ms fake-clock advances and100ms bounded real evaluation polls for the rendered authenticated Live receipt. Composer, asks, topics, connection, session-actions, session-launch, area-slots, Events and Inbox migrations retain all original assertions. Raw Linux test passes include composer2.050790037s; asks1.631282551s; topics1.159771833s; Events1.228978916s; Inbox1.355240730s; offline actions1.313260063s; launch1.362026339s; area restart subcase1.008648277s; connection backoff subcase1.440136064s (parent5.729760955s). Exact attempt and no-replay/draft/outcome checks remain in source.
C2 verified from A-9945 plus A-9946 at exact fb9bb750: local macOS targeted composer20/20 quiet+10/10 with two CPU loops, asks20/20 quiet+10/10 with two CPU loops. Raw logs each show one pass/zero failures; total60 passes. Original driver records exact head/Node argv, aborts any nonzero subprocess exit, guards local:none before stress and every loaded case, and terminates then waits for both yes workers in finally. Original completion session87433/chunk58140d exit0 and “Both CPU load loops reaped” are retained without reruns. Queue stdout captured/guarded rather than printed; worker PIDs/start timestamps were not recorded, a limited attribution claim explicitly retained. Browser census logs show cleanup. Pre-fix asks red and A-9944 trace retained; no local composer-red claim after21 passing attempts.

Configured mode-free fe24f64e-cd1a-41de-bbcb-6b366e5ab698 / A-9950 exits0 at this exact source-reviewed head: raw ordinary964/964 tests and161/161 file records pass, no failure/skip/cancel. No load-gate-scope repetitions present; generic five-repetition header is not extra repetition proof. Actual T1 and complete Web ran; T2 was an empty web-only compatibility phase (0.03s), not all hub/Neovim T2 coverage. No T3/T4; configured policy defers T3.

Executor Linux x64 c-8 lon1 cland-v0-de93747d, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime248s/$0.0172. Host check gate89ac65e37a4228a61516444c851c68564500dba3 reused/not repeated remotely. Duration/static-test-lint/tier/ratchet diagnostics report-only; two missing baselines retained. Web phase106.62s is measured phase duration; projected94.196s at2workers is not measured wall time. Existing parent budget warnings are not clean-budget evidence; no new test identity was introduced.

qaPolicy none; no outstanding QA criteria. Final clear at this head; Reviewer performs no merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-23T09:56:44.414Z

Merged 558262e4ffb41f285a046720a3cc19b2392fd2a7 onto dev.
