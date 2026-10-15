---
id: T-433
kind: task
title: A restored launching suite fails when its suite ref already exists (update-ref expects it absent)
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
regression_of: T-345
topic: topic-258
branch: t/T-433-a-restored-launching-suite-fails-when
created: 2026-10-14T17:56:11.704Z
updated: 2026-10-15T02:10:43.996Z
---

## Summary

`hub/test/executor-run.test.ts:182` ("a crash after acquire preserves the launching suite lease before delivery") failed on a Linux c-8 droplet in T-429's run 56d039e0 (A-2481, lines 1866–1897). After the simulated crash, the restored run failed. It ran `git update-ref refs/cland/suites/<run> <head> 0000…`, which asserts the ref is absent, but the ref already existed: "cannot lock ref …: reference already exists". The suite result was exit 1 and `eventually` timed out after 15 s.

This may be a product defect: a hub that restarts between acquire and delivery recreates the suite ref as if it were new, and then the restored run fails. It passes on macOS, where the timing apparently leaves the ref uncreated before the crash.

## What to fix

Make the suite ref's creation idempotent across a restart: accept an existing ref that already points at the same head, and refuse only a different head. Add a deterministic test in which the ref exists before the restore.

## Acceptance criteria

- [x] C1. A restored launching run whose suite ref already exists at the same head proceeds to delivery. A ref at a different head fails with a message naming both heads.
  - done: impl-433 · 2026-10-14T18:11:49.880Z
  - verified: rev-26 [reviewer] · run rev-20261014-433-source-1 · 2026-10-14T18:12:50.812Z · commit b874faa11e64b60f8f2b1d7846b987c145c4d2ca
  - verified: rev-26 [reviewer] · run rev-20261015-433-source-2 · 2026-10-15T02:10:23.017Z · commit 2c9f932ad185fa423b14685eff47582aac36bf3c
- [x] C2. The test sets up the existing-ref case deterministically and passes 5/5 whole-file runs.
  - done: impl-433 · 2026-10-14T18:11:50.850Z

## Comments

### impl-433 · 2026-10-14T17:58:30.822Z

Confirmed the product defect with a deterministic executor-run restart regression: after stopping the first hub, pre-created refs/cland/suites/<run> at HEAD. Targeted run failed with the same update-ref all-zero old-value error seen in A-2481. Keeping atomic create semantics; recovery will accept only an existing same-head ref and reject a mismatch without changing it.

### impl-433 · 2026-10-14T18:11:51.755Z

Implemented and pushed one commit b874faa11e64b60f8f2b1d7846b987c145c4d2ca. Atomic creation now accepts an existing same-head suite ref and refuses a conflicting ref with both heads in the message. Deterministic restored-launching tests exercise successful delivery/ref cleanup and conflicting-head failure/ref preservation, single reporting, and lease cleanup. npm run typecheck and git diff --check passed. Five serial whole-file runs passed 18/18 each; durable logs attached in the item topic. origin/dev fetched and merged (already current) before commit. QA policy is none with no QA criteria; requesting source review next.

### rev-26 · 2026-10-14T18:12:50.812Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-433-source-1
commit: b874faa11e64b60f8f2b1d7846b987c145c4d2ca
scope: full

No high/medium findings. hub/src/executor/droplet/run.ts:37 preserves atomic absent-ref creation, accepts only exact same-head recovery, and names both heads on conflict before bundle cleanup can modify it. Existing compare-and-swap ref deletion remains. hub/test/executor-run.test.ts:182 deterministically establishes same/conflicting refs after SIGKILL before restart; delivery/ref preservation, one create/report and resource cleanup assertions remain. A-2486 contains five serial 18/18 whole-file passes. C1 verified from source; C2 setup/evidence checked, final execution settlement awaits accepted same-head post-clear verify. No source seam/assertion/timeout weakening. Evidence A-2487: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2487-t-433-source-review-clear-at-b874faa1-restart-safe-same-head-suite-refs.md.

Criteria: C1 verified.

### impl-433 · 2026-10-14T18:13:15.765Z

Source review clear from rev-26 at b874faa11e64b60f8f2b1d7846b987c145c4d2ca; C1 verified. Submitted the required no-mode local verification at this clean unchanged head: 54e82e23-98f2-4c21-aa77-64a1f12a1f26, queue position 4, reporting to rev-26 and impl-433 in topic-258. Awaiting the hub result and final C2 settlement.

### rev-26 · 2026-10-15T00:10:37.345Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-433-evidence-1
commit: b874faa11e64b60f8f2b1d7846b987c145c4d2ca
scope: evidence

Medium — hub/test/suite.test.ts:798 (case :784): 'unverified cleanup preserved' times out after15000ms in the live-worker/start-identity case. 54e82e23/A-2608 fails:1654/1655 pass, one fail, zero cancel/skip/todo; Neovim never runs. Typecheck and both restored-ref subcases pass. Failure is outside T-433 patch; no cause inferred and no unrelated criterion failed. Source C1/A-2487 and five-file A-2486 retained; final execution settlement pending. Evidence A-2610: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2610-t-433-verification-not-clear-at-b874faa1-unrelated-unverified-cleanup-wait-times.md.

### impl-433 · 2026-10-15T00:39:52.745Z

Original gate run 54e82e23/A-2608 failed only suite.test.ts:798 (cleanup observer timeout); T-433 restored-ref cases passed. Coordinator required five serial whole-file suite.test.ts isolation runs before one same-head rerun. Completed 5/5 green, 61/61 each, at unchanged clean b874faa11e64b60f8f2b1d7846b987c145c4d2ca; all logs in A-2623. Test introduced by T-203 a61949083; last edit within test by T-232 9b67aea7d. Reported S/Bugs flake to Coordinator. Submitted the authorized no-mode local rerun be362f56-ac22-4ebd-b960-36a369c6c0c3, position 2, with rev-26 and impl-433 as recipients. Going idle pending result.

### rev-26 · 2026-10-15T02:09:23.465Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261015-433-evidence-2
commit: b874faa11e64b60f8f2b1d7846b987c145c4d2ca
scope: evidence

Medium — nvim/test/explorer-card.test.ts:243: gi case fails with 'card T-11 expects fallback human picture' / 'no row under the cursor', the known T-439 signature. be362f56/A-2639 is failed: 2041/2042 pass, one failure, zero cancel/skip/todo; typecheck/hub green. Earlier 54e82e23/A-2608 cleanup failure and five-file A-2623 proof retained. No unrelated criterion failed; source A-2487 remains clear, final execution pending. This second red result authorizes no further unchanged-head retry; follow Coordinator shared-fix direction and obtain delta review for a new head. Evidence A-2640: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2640-t-433-second-verification-not-clear-known-t-439-explorer-readiness-signature.md.

### impl-433 · 2026-10-15T02:09:48.903Z

Second verification be362f56/A-2639 passed 2041/2042; sole failure exactly matches Coordinator-authorized T-439 conditional: explorer-card.test.ts:243, card T-11 expects fallback human picture / no row under cursor. Cherry-picked a2f60f7a as 2c9f932ad185fa423b14685eff47582aac36bf3c, preserving original suite-ref commit b874faa1 and changing only nvim/test/explorer-card.test.ts. Touched whole file passed 15/15 with zero skips (A-2641); npm run typecheck and git diff --check passed. Pushed clean new head to origin. Requesting delta review of this pick alone before further verification; retaining both red receipts and A-2623 cleanup isolation.

### rev-26 · 2026-10-15T02:10:23.017Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-433-source-2
commit: 2c9f932ad185fa423b14685eff47582aac36bf3c
scope: delta

No high/medium findings. Shared T-439 pick changed lines match a2f60f7a exactly. nvim/test/explorer-card.test.ts:247 observes actual input focus, target cursor and rendered card while yielding between RPC reads; original assertions and five-second bounds preserved. A-2641 whole-file 15/15 checked. Both original T-433 ref-fix files byte-identical to b874faa1. C1 renewed; C2 final execution settlement awaits accepted new-head no-mode local verification. Preserve both red gates A-2608/A-2639 and cleanup isolation A-2623. Evidence A-2642: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2642-t-433-delta-source-clear-at-2c9f932a-exact-shared-t-439-readiness-pick.md.

Criteria: C1 verified.

### impl-433 · 2026-10-15T02:10:43.996Z

Delta source clear from rev-26 at 2c9f932ad185fa423b14685eff47582aac36bf3c (rev-20261015-433-source-2/A-2642); C1 renewed. Submitted required no-mode local verification c08bddb4-e200-4390-82de-7d74ff327646 at clean unchanged head, position 1, reporting to rev-26 and impl-433. Both prior red runs and cleanup isolation logs retained. Awaiting hub result.
