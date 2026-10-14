---
id: T-375
kind: task
title: executor-droplet watchdog-restart test gets a fake 404 during acquire under suite load
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
regression_of: T-343
topic: topic-237
branch: t/T-375-executor-droplet-watchdog-restart-test
created: 2026-10-14T06:26:05.430Z
updated: 2026-10-14T07:01:04.813Z
---

## Summary

`hub/test/executor-droplet.test.ts:158`, the watchdog-restart case, failed under full-suite load. The fake DigitalOcean API answered 404 during `DropletExecutor.acquire` (droplet.ts:109). It passes 5/5 alone, so this is a load race in the test or the fake, most likely a short test lifetime that lets the detached watchdog delete the fake droplet before acquire's polling finishes. It now blocks merges as a dev defect, under the shared-fix rule.

## Evidence

- T-356's full run 53a04bb2 at 6176764 (A-2258, lines 1801–1814) on 2026-10-14, macOS under suite load: 404 from the fake during acquire in the watchdog-restart test. The same run also failed T-369's routing race, which is fixed since.
- Run alone 5 times by impl-356 at 2e2ffce1, it passed 5/5.
- The integrated runs 076f13dc, 2c1f3761 and d80d1b41 passed this test.

## Acceptance criteria

- [x] C1. The cause is established and written down: which deadline or timer races acquire under load, with a reproduction under a parallel CPU load generator on dev.
  - done: impl-375 · 2026-10-14T06:36:23.971Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-375-1 · 2026-10-14T06:38:02.754Z · commit 19c0e356775b4d17fd1ec588b6f2a3e39dae8072
  - verified: rev-23 [reviewer] · run rev-2026-10-14-375-3 · 2026-10-14T06:49:42.436Z · commit 07433e45e8a7d092f3c819b852c12991d8a5e119
- [x] C2. The test's timing becomes readiness-based, or its lifetime is decoupled from acquire's polling, and the survival, restart and cleanup assertions stay unchanged. If the cause is in hub code, the hub is fixed instead.
  - done: impl-375 · 2026-10-14T06:36:25.891Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-375-1 · 2026-10-14T06:38:02.754Z · commit 19c0e356775b4d17fd1ec588b6f2a3e39dae8072
  - verified: rev-23 [reviewer] · run rev-2026-10-14-375-3 · 2026-10-14T06:49:42.436Z · commit 07433e45e8a7d092f3c819b852c12991d8a5e119
- [x] C3. The fix is one commit, so it can be cherry-picked into every live branch.
  - done: impl-375 · 2026-10-14T06:36:29.025Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-375-1 · 2026-10-14T06:38:02.754Z · commit 19c0e356775b4d17fd1ec588b6f2a3e39dae8072
  - verified: rev-23 [reviewer] · run rev-2026-10-14-375-3 · 2026-10-14T06:49:42.436Z · commit 07433e45e8a7d092f3c819b852c12991d8a5e119
- [x] C4. The executor-droplet file passes 20 consecutive targeted runs under four parallel CPU workers on macOS.
  - done: impl-375 · 2026-10-14T07:01:03.267Z

## Comments

### impl-375 · 2026-10-14T06:34:50.544Z

C1 diagnosis: the exact fake 404 is caused by asynchronous hub startup recovery racing the test's direct in-process acquire. startDaemon returns while Dispatcher.#dropletReady = sweep(true) is pending; reconcile(true) treats a creating lease with resource:null as an interrupted create and release discovers/deletes its fake droplet during acquire's poll at droplet.ts:109. Natural four-worker CPU-load tracing caught key deletion about 135ms after creation, before the 3s deadline. Pinning startup inside fake beforeCreate and awaiting executor.status there reproduced the exact 404 3/3 under four CPU workers even with lifetime=5m, excluding short lifetime as the exact 404 cause. The separate 3s window also races machine readiness and hub shutdown (natural load produced machine-readiness deadline and missing watchdog receipt failures). Fix: await executor.status before direct acquisition; keep a long acquisition lifetime and persist expiry only after hub stop and watchdog/resource survival assertions. All existing restart, receipt, billing, cleanup, and redaction assertions retained. Full-file 20-run macOS CPU-load check is running.

### rev-23 · 2026-10-14T06:38:02.754Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-375-1
commit: 19c0e356775b4d17fd1ec588b6f2a3e39dae8072
scope: full

No high/medium findings. A-2265 establishes startup sweep racing direct acquire (exact 404 red 3/3 under load even at 5m), plus independent short-expiry races. Public executor.status awaits startup recovery. Persisted expiry now follows confirmed stopped hub and live watchdog/droplet/key; watchdog rereads deadline and still performs deletion while hub absent. Original restart/receipt/cleanup/billing/redaction assertions and deadlines retained; new survival preconditions strengthen coverage. Single test-only commit, no production seam. C1–C3 verified; C4 load batch and ordinary exact-head full remain pending. A-2266: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2266-t-375-complete-watchdog-readiness-source-review-clear.md.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-14T06:44:06.624Z

Coordinator decision (2026-10-14 06:45Z): the neighbouring load race at executor-droplet.test.ts:57 joins T-375 (A-2267). The acquire-deadline case gets 'DigitalOcean 0 transport' instead of /deadline/ when the 250 ms deadline expires mid-call. One amended commit covers both cases. If the hub should report the deadline cause, fix the hub with a test; otherwise make the test robust. C4 counts the whole file, 20 consecutive runs.

### rev-23 · 2026-10-14T06:45:30.930Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-375-2
commit: 19c0e356775b4d17fd1ec588b6f2a3e39dae8072
scope: evidence

Medium — hub/test/executor-droplet.test.ts:65: acquire's pending API abort gives DigitalOcean 0 transport instead of expected /deadline/ at 250ms. A-2267 run 19 is 11/12 with watchdog 19/19, so C4's whole-file twenty-consecutive gate fails. Coordinator folds this case into the one amended shared commit; preserve cleanup/single-create/released-state checks and request changed-head source review before new batch. Unchanged retry was stopped. A-2269: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2269-t-375-c4-not-clear-complete-file-batch-failed-at-run-19.md.

Criteria: C4 failed (Complete-file load batch failed at run 19 on acquisition-deadline assertion; twenty consecutive passes not established.).

### impl-375 · 2026-10-14T06:48:34.125Z

Coordinator disposition folded the neighboring deadline classification bug into this item. A-2271 records a red provider-boundary regression on old api.ts and green after the fix. Complete executor-droplet file passed 13/13 once before review. Amended/pushed single commit 07433e45 replaces 19c0e356; fetched/merged origin/dev (still cc623149). API deadline-limited AbortSignal timeouts now report id=deadline; shorter provider transport caps retain id=transport, as do actual network failures. HTTP errors/redaction remain, and response-body aborts retain their cause. Existing 250ms acquisition deadline and all destroy/lease assertions are unchanged. The first C4 batch failed at run 19 (A-2267); the mistakenly started unchanged retry was stopped on reviewer instruction. No C4 pass claimed. A new qualifying batch starts from zero only after clear source review of 07433e45.

### rev-23 · 2026-10-14T06:49:42.436Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-375-3
commit: 07433e45e8a7d092f3c819b852c12991d8a5e119
scope: full

No high/medium findings in combined amended commit. Prior watchdog recovery/expiry correction retained. API distinguishes aborted deadline-limited calls from shorter transport caps/network errors, preserves HTTP/redaction behavior and body-abort cause. Fake boundary red/green A-2271 and original 250ms /deadline/cleanup/single-create assertions retained; no retries or seam. C1–C3 refreshed, C4 requires a new twenty complete-file load batch from zero at this changed head, then ordinary full evidence. A-2272: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2272-t-375-amended-watchdog-and-deadline-source-review-clear.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-375 · 2026-10-14T07:01:04.813Z

C4 complete at exact reviewed 07433e45: twenty consecutive complete executor-droplet.test.ts runs under four parallel CPU Worker threads on macOS arm64, Node v24.21.0. All 13 cases passed in each run (260/260 test cases, no failures/skips), total file-run duration about 596s. Runner exit 0 followed awaited termination of all workers. Durable artifact A-2276 contains exact runner, all twenty TAP logs and summary.json. Working tree clean/head unchanged throughout. Both initial failure batches remain recorded; only this changed-head reviewed batch qualifies. Full verification is now submitted at the same reviewed head.
