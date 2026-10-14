---
id: T-441
kind: task
title: session-holds verifier-request test misses its channel event (observer-spoke race, 1 in 5 alone)
state: closed
status: done
size: S
rank: 2282
criterion_seq: 3
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
regression_of: T-398
topic: topic-265
branch: t/T-441-session-holds-verifier-request-test
created: 2026-10-14T21:26:59.664Z
updated: 2026-10-14T22:30:46.677Z
closed: 2026-10-14T22:30:46.677Z
---

## Summary

`hub/test/session-holds.test.ts:160` ("delivered verifier requests persist across restart and clear on hold, verdict, stop and death") fails intermittently on macOS. It failed in integrated cover 9484455a at 039421e7 (A-2562), and in 1 of 5 runs of the file alone at about e6c0af0a; T-385 merged during that series. The error is "no channel event matched within 5000ms", while the review request to the pending reviewer had already been seen. This is the observer-spoke channel-timing class that T-369 and T-398 fixed elsewhere: the test waits for a channel event that may arrive before or after its observer subscribes. T-398's sweep did not cover this file. The integrated dev cover fails on it, so this is a shared fix.

## What to fix

Apply T-398's pattern to this test: wait for the observer spoke's connection or subscription before acting, or match against the full received history rather than only new events. Widen no time bound.

## Acceptance criteria

- [x] C1. The cause is named, with a deterministic reproduction that is red before the fix and green after.
  - done: impl-441 · 2026-10-14T21:34:14.795Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-441-1 · 2026-10-14T21:38:18.233Z · commit f303e8d09c1b684b8d69af1388a1cfc784d72e18
  - verified: rev-23 [reviewer] · run rev-2026-10-14-441-3 · 2026-10-14T22:30:27.638Z · commit f303e8d09c1b684b8d69af1388a1cfc784d72e18
- [x] C2. The file passes 10/10 whole-file runs serially, including at least five beside a local full run.
  - done: impl-441 · 2026-10-14T21:36:29.276Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-441-3 · 2026-10-14T22:30:27.638Z · commit f303e8d09c1b684b8d69af1388a1cfc784d72e18
- [x] C3. Any other test in hub/test that waits on a channel event without T-398's readiness is listed, and is fixed in the same commit or filed.
  - done: impl-441 · 2026-10-14T21:34:15.770Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-441-1 · 2026-10-14T21:38:18.233Z · commit f303e8d09c1b684b8d69af1388a1cfc784d72e18
  - verified: rev-23 [reviewer] · run rev-2026-10-14-441-3 · 2026-10-14T22:30:27.638Z · commit f303e8d09c1b684b8d69af1388a1cfc784d72e18

## Comments

### impl-441 · 2026-10-14T21:31:51.194Z

Cause confirmed: startup's first-usage barrier is invalidated by hub restart; native adapter spoke and channel observer reconnect independently, and HubCore correctly directs delivery to the newest spoke. Scratch-only 4000ms native reconnect delay plus a second-native-connect receipt before the post-restart request produces the exact 5000ms missing-channel timeout twice; same mutation with observer close/native-presence/fresh-observer passes twice. Temporary production/test instrumentation removed. Final diff is 7 lines in session-holds.test.ts only, with assertions/deadlines unchanged. Ten serial complete-file runs underway beside impl-389's local full verification.

### impl-441 · 2026-10-14T21:36:48.844Z

Source ready at f303e8d09c1b684b8d69af1388a1cfc784d72e18, pushed to origin on t/T-441-session-holds-verifier-request-test. Fetched/merged origin/dev aa5efe01 before commit; one test-only commit, clean worktree. C1 A-2568: 2 red / 2 green same delayed-native reconnect mutation, removed after proof. C2 A-2570: ten serial whole-file invocations, 70 passed / 0 failed/cancelled/skipped, all ten beside local full 4b2735cc (impl-389) with queue/holder receipts. C3 A-2569: 43 channel-wait files inventoried, remaining native same-session restart observer fixed; no further missing barrier found. Every assertion/deadline preserved. qaPolicy.scope none and no qaCriteria: source review only, then exact-head local no-mode verification.

### rev-23 · 2026-10-14T21:38:18.233Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-441-1
commit: f303e8d09c1b684b8d69af1388a1cfc784d72e18
scope: full

No high/medium Standards/Spec findings. Observer closes before restart, persisted pending assertion remains before reattachment, coordinator current-live who waits for sole native reviewer, fresh observer attaches last without role reassignment. Cleanup, original assertions/event cursors and deadlines retained. C1 exact 4000 ms delayed-native mutation red twice/green twice verified; final patch matches, ineffective 1500 ms probes honestly disclosed. C3 43-file buffered channel-wait inventory and additional native observer/restart boundaries checked, no further missing barrier found. Ten serial whole-file logs pass 70/70 with zero skips and receipts for local full holder 4b2735cc; C2 final mark/readiness awaits complete same-head local no-mode gate. A-2571: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2571-t-441-source-review-native-reconnect-before-fresh-observer.md.

Criteria: C1 verified, C3 verified.

### impl-441 · 2026-10-14T21:38:39.921Z

Source review clear rev-2026-10-14-441-1 at f303e8d09c1b684b8d69af1388a1cfc784d72e18 (A-2571); C1/C3 verified, C2 final awaits same-head suite. Submitted required cland verify --executor local --report topic-265 --to rev-23 --to impl-441, no mode, run 2c0e86a1-4f0f-44bc-a7b2-85490f79b896, queue position 1. Worktree clean and exact reviewed head retained. Idle awaiting hub result and final reviewer verdict; claim retained until merge.

### impl-441 · 2026-10-14T22:00:31.372Z

First exact-head verification 2c0e86a1 / A-2579: typecheck passed, 1699/1700 cases passed; repaired session-holds restart case passed. Only failure was unrelated nvim/test/sessions.test.ts:331, reset=now+2min crossing local midnight (UI correctly shows ↻Thu 00:01, expected helper only HH:MM). Diagnosis A-2580. Coordinator decision a612e0fd-ed71-4af3-9ca9-e5d13f539af5 authorizes one unchanged-head resubmit under flaky rule; submitted local no-mode 44a4159f-5972-4bdb-a805-1b3b15e73f08 at clean f303e8d0, queue position 1. No edits; final reviewer verdict must name both runs.

### rev-23 · 2026-10-14T22:00:37.468Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-441-2
commit: f303e8d09c1b684b8d69af1388a1cfc784d72e18
scope: evidence

Medium gate finding — nvim/test/sessions.test.ts:331: untouched test expects same-day clock(reset), but reset +120 s crosses midnight; screen correctly shows Thu 00:01 per accounts.lua:10–11. Bugs/S filed by Coordinator. Local hub-only 2c0e86a1/A-2579 exits 1, 1699/1700 passing, root typecheck passes; repaired verifier request test passes 9.324 s. No T-441 source regression inferred. Direct Coordinator a612e0fd at 22:00:14Z authorizes one unchanged-head no-mode local retry after the midnight window, with both runs named in final verdict. C1/C3 source and ten-file proof retained; C2/readiness awaits accepted replacement, second unrelated failure needs disposition. A-2581: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2581-t-441-gate-held-by-midnight-reset-label-test-boundary.md.

### impl-441 · 2026-10-14T22:30:02.788Z

Authorized same-head retry 44a4159f-5972-4bdb-a805-1b3b15e73f08 / A-2584 passed: local Darwin arm64, Node v24.21.0, Neovim v0.12.5; root typecheck and auto-selected hub-only suite 1700/1700, zero failures/cancellations/skips/todo. Head remains clean source-reviewed f303e8d09c1b684b8d69af1388a1cfc784d72e18. First run 2c0e86a1 / A-2579 was red only on the separately filed midnight reset-label test; Coordinator a612e0fd authorized this one unchanged-head retry. Both runs retained for final reviewer verdict; claim retained until merge.

### rev-23 · 2026-10-14T22:30:27.638Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-441-3
commit: f303e8d09c1b684b8d69af1388a1cfc784d72e18
scope: evidence

Final clear; C1–C3 claimant done marks confirmed, unchanged clean head. Source A-2571 and A-2570 deterministic 2-red/2-green, ten serial files 70/70 beside full holder and 43-file readiness inventory retained. First exact-head run 2c0e86a1/A-2579 red 1699/1700 only on untouched sessions.test.ts:331 midnight reset-label defect (filed Bugs/S): reset+120s crosses local day, correct weekday label mismatches today-only expectation. Direct Coordinator a612e0fd authorized one unchanged-head retry after the time window. Retry 44a4159f/A-2584 passes root typecheck and 1700/1700 (37 free, 1651 hub machine, 12 Neovim smoke), zero failures/cancellations/skips/todo; repaired verifier and prior failed display cases both pass. No high/medium T-441 findings remain. A-2585: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2585-t-441-final-evidence-green-authorized-retry-and-retained-midnight-failure.md.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-14T22:30:46.677Z

Merged 41f9d59b9085e58363ba4ccb16409622f45bf33b onto dev.
