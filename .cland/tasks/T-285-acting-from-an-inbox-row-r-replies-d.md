---
id: T-285
kind: task
title: "Acting from an inbox row: r replies, d declines or marks read, A the archive"
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: E-274
blocked_by:
  - T-284
topic: topic-176
branch: t/T-285-acting-from-an-inbox-row-r-replies-d
created: 2026-10-12T11:57:19.680Z
updated: 2026-10-12T20:02:20.780Z
closed: 2026-10-12T20:02:20.991Z
---

## Summary

The human acts on inbox rows without leaving the inbox: `r` replies from a row, `d` declines a request (its sender is told) or marks a message read, and `A` shows the inbox archive, what left in the last seven days and why. `cland inbox --archive` prints the archive.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**`r` replies from a row.** On a request or a message row, `r` opens the composer on the row's topic as a reply to that message. Sending it makes the row leave as `replied` (a request) or `answered` (a message), by the leave rules the first ticket built. On an ask, `r` gives the free answer, like `i`. On a command approval, it says the approval is answered in the session.

**`d` removes a row.**

- On a request, `d` declines it. The hub records the decline and journals the departure as `declined`. It sends the request's sender one line from the hub saying the human declined the request and naming it. The row leaves.
- On a message, `d` marks that one message read and journals `read`. Other messages in the same topic keep their rows.
- On an ask, a command approval or a plan approval, `d` refuses in the status line and says how that row is answered.

The hub gains the frames for decline and mark-read, refusing an unknown or already-left row by name. Both are the human's alone in the permission table. The decline notice reaches the sender after a hub restart if the sender was offline, as other queued deliveries do.

**`A` shows the archive.** `A` in the inbox toggles the archive below the sections: the rows that left in the last seven days, newest first, each with its kind, its subject, its first line, when it left and why (`answered`, `approved`, `replied`, `declined`, `read`, or the state a withdrawn ask or a closed plan left with). `inbox.list` with `archive: true` returns them. The archive survives a hub restart and does not read the whole journal. `A` takes over the key that today shows the inbox's archive layer (T-191); that toggle goes, by the Coordinator's decision of 2026-10-12. When the archive is hidden, a line below the sections reads "▸ archive · N rows left today · A". This line also shows in the empty state.

**The CLI.** `cland inbox --archive` prints the archive, one line per row with when it left, its kind, its subject, its first line and its reason, newest first. `--json` with it prints the frame.

**Demo.** A session's request waits in the inbox. `d` on its row sends the sender the decline, the chip drops by one, and `A` lists the row as `declined`. `cland inbox --archive` prints the same row.

Out of scope: the events view and the events line; the retirement of the notification list. Until that retirement, `d` on a v0.1.1 notification row still dismisses it and `D` still dismisses all.

**Constraints.**

- Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project) and the fake harnesses second. Neovim runs headless on the stub hub from the protocol's other side.
- No new seams inside the hub.
- Neovim is the host with no plugins (ADR 0005).
- Every key goes through the action registry.
- Suites run through `cland verify`.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.
- Declines, read marks and the archive survive a hub restart.

## Acceptance criteria

- [x] C1. `r` on a request or message row opens the composer as a reply in the row's topic, and sending it removes the row with reason `replied` or `answered`.
  - done: impl-285 · 2026-10-12T17:41:19.748Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-2 · 2026-10-12T17:51:12.624Z · commit f00cde9cd8c9cd39406f8d52b617383e118f4857
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-4 · 2026-10-12T18:29:38.665Z · commit 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-7 · 2026-10-12T19:39:45.939Z · commit 27bfb180878062a126d79293693e21b622d87a15
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-8 · 2026-10-12T20:02:17.630Z · commit 27bfb180878062a126d79293693e21b622d87a15
- [x] C2. `d` on a request declines it: its sender receives one hub line naming the declined request, the row leaves and needsYou drops; `d` on a message marks only that message read; `d` on an ask or an approval refuses with how to answer it.
  - done: impl-285 · 2026-10-12T17:41:20.372Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-2 · 2026-10-12T17:51:12.624Z · commit f00cde9cd8c9cd39406f8d52b617383e118f4857
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-4 · 2026-10-12T18:29:38.665Z · commit 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-7 · 2026-10-12T19:39:45.940Z · commit 27bfb180878062a126d79293693e21b622d87a15
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-8 · 2026-10-12T20:02:17.630Z · commit 27bfb180878062a126d79293693e21b622d87a15
- [x] C3. `A` shows the rows that left in the last seven days with when and why, and hides them again; the archive line shows how many rows left today, in the empty state too.
  - done: impl-285 · 2026-10-12T17:41:20.942Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-2 · 2026-10-12T17:51:12.624Z · commit f00cde9cd8c9cd39406f8d52b617383e118f4857
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-4 · 2026-10-12T18:29:38.665Z · commit 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-7 · 2026-10-12T19:39:45.940Z · commit 27bfb180878062a126d79293693e21b622d87a15
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-8 · 2026-10-12T20:02:17.630Z · commit 27bfb180878062a126d79293693e21b622d87a15
- [x] C4. `cland inbox --archive` prints the same rows with their reasons, and both the archive and a decline survive a hub restart.
  - done: impl-285 · 2026-10-12T17:41:21.325Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-2 · 2026-10-12T17:51:12.624Z · commit f00cde9cd8c9cd39406f8d52b617383e118f4857
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-4 · 2026-10-12T18:29:38.665Z · commit 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-7 · 2026-10-12T19:39:45.940Z · commit 27bfb180878062a126d79293693e21b622d87a15
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-8 · 2026-10-12T20:02:17.630Z · commit 27bfb180878062a126d79293693e21b622d87a15
- [x] C5. Targeted tests pass (hub frame tests on a real hub with a real spoke receiving the decline, the CLI on a temporary project, nvim headless tests on the stub hub), and `hub/README.md` and `nvim/README.md` describe the frames, `r`, `d`, `A` and `--archive`.
  - done: impl-285 · 2026-10-12T19:39:00.910Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-7 · 2026-10-12T19:39:45.940Z · commit 27bfb180878062a126d79293693e21b622d87a15
  - verified: rev-23 [reviewer] · run rev-2026-10-12-285-8 · 2026-10-12T20:02:17.631Z · commit 27bfb180878062a126d79293693e21b622d87a15

## Comments

### coord · 2026-10-12T15:27:39.903Z

Input from T-284's C7 audit (impl-284, 2026-10-12): a request and the human's reply processed within one tick never enter inbox_waits, so they get no departure record and would be missing from the seven-day archive this item builds. Decide in this item: either journal a departure (reason `replied`) for a row that was answered before its first persisted tick, so the archive is complete, or state the gap in hub/README.md. Prefer the first. Also keep T-293's lesson: no synchronous full inbox recompute per event; the archive query must be indexed and bounded.

### impl-285 · 2026-10-12T17:22:43.143Z

Implementation started: human-only decline/read frames, indexed seven-day departure archive (including same-tick replies), CLI archive output and registry-backed Neovim row actions. Keeping inbox-workload C7 regression; protocol/spoke/CLI tests precede headless UI checks.

### impl-285 · 2026-10-12T17:41:22.558Z

C1–C5 implemented and targeted checks pass: hub inbox-actions (5), inbox-workload/C7 (2), existing inbox-requests (10), Neovim inbox-actions panel/full/free-answer/retry (4), archive-layer replacement, registry audit, and narrow status-line checks. First lines are captured with waits so command approvals remain identifiable after metadata clears. Same-tick replied requests retain their actual reply timestamp, keeping old replies outside the seven-day archive. CLI archive/read/decline survive restart and an offline sender receives the persisted decline. Preparing committed review head and final hub-managed suite; QA is after-stage per task policy.

### rev-23 · 2026-10-12T17:46:30.745Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-1
commit: 603345eb304336f35dc70f695293265379f087e2

Medium: hub/src/hub/core.ts:366 queued live projection has no shutdown cancellation/drain; HubBase.close closes Store (server.ts:133), then callback :371 enters eventsProject/inbox.list on closed SQLite. Read-only in-memory public-boundary probe reproduced queuedProjectionError='database is not open' after await hub.close. Own that callback's shutdown lifecycle while retaining per-tick/C7 bounds; add existing-frame/public-close regression without a new seam.
C1–C4 requested paths and registry/docs/tests read; no other high/medium finding established. Full suite pending. Evidence A-1576: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1576-t-285-review-pending-live-projection-outlives-shutdown.md.

Criteria: C5 failed (Included live-event batching leaves a pending projection after hub.close, causing an uncaught SQLite database-is-not-open error.).

### impl-285 · 2026-10-12T17:50:03.699Z

Fixed rev-2026-10-12-285-1 C5 finding in separate follow-up f00cde9cd8c9cd39406f8d52b617383e118f4857. HubCore.close cancels its pending journal Immediate and batch, rejects late publication, and closes inbox timers before Store closes. The new regression sends a real topic.close frame over the stdio edge then immediately awaits public hub.close; it failed with database-is-not-open before the fix and passes after. All three inbox-workload tests (unchanged C7 startup/burst assertions) and typecheck pass. Old suite e50ef560 was cancelled; requesting fresh review/full verification at this head.

### rev-23 · 2026-10-12T17:51:12.624Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-2
commit: f00cde9cd8c9cd39406f8d52b617383e118f4857

No remaining high/medium findings. Core now cancels queued Immediate/rows and guards late publication before Store closes; frame/public-close regression covers the exact shutdown path, C7 bounds unchanged. Read-only in-memory queued+late probe now observes no error. Unchanged C1–C4 source paths, human-only actions, reply/draft routing, durable reads/declines/indexed archive/CLI, registry and docs rechecked; C5 targeted evidence retained plus 3/3 workload/typechecks. Fresh full verify pending; cancelled prior suite is not pass evidence. A-1579: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1579-t-285-re-review-clear-at-f00cde9.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-23 · 2026-10-12T18:22:22.958Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-3
commit: f00cde9cd8c9cd39406f8d52b617383e118f4857

Medium: hub/test/aide.test.ts:24 expects the Aide-rule reason for every known denied tool; new inbox.decline/read correctly refuse with 'only the human acts on inbox rows' before Aide-rule dispatch. Preserve exact grants/allow-deny checks and all old-tool Aide-rule assertions, adding the exact human-only reason expectation for these two frames. No production permission defect established.
A-1582/b8725021 cancelled exit 143; 30/30 free phase, named hub-machine failure, no complete machine/Neovim aggregate. No full-green claim. Source/shutdown review A-1579 retained. A-1583: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1583-t-285-cancelled-full-run-exposes-stale-aide-reason-assertion.md.

Criteria: C5 failed (Aide defaults permission test still expects the Aide-rule reason for the two new mandatory human-only inbox tools; cancelled full run is not green.).

### impl-285 · 2026-10-12T18:28:47.017Z

Fixed rev-2026-10-12-285-3 C5 assertion mismatch in 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0: only inbox.decline/read expect the stronger human-only reason, retaining every exact grant/denial and every old-tool Aide-rule assertion. Targeted Aide defaults passes. Cancelled full run b8725021 was not green. Separately, the Coordinator's events diagnosis compared both files on f00cde9 and dev 37a6a23; the reproducible issue was ENOTEMPTY during directory removal before in-process daemon shutdown, leaving a live handle. Shared test-only fix cd3518eb82b462c61666e7d400776afeef5c5ccb corrects both events files without changing any existing assertion or shared harness. events-quiet passes 20/20 runs under four workers (80 cases), and a forced first-case failure exits code 1 in 2.62s instead of hanging. events.test passes 3/3. Evidence A-1586 (stress) and A-1587 (negative control). Fetched/merged origin/dev before final suite, already up to date; requesting review/full verification at 48e1ab0.

### rev-23 · 2026-10-12T18:29:38.665Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-4
commit: 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0

No remaining high/medium findings in delta. Aide test now asserts the exact mandatory human-only reason only for inbox.decline/read; exact grants/denials and every old-tool reason retained. Events cleanup registers daemon shutdown before fixture removal and before UI setup, follows restarted daemon, and retains all assertions/shared harness. A-1586 confirms 20 quiet files pass; A-1587 forced failure exits 1 without hanging. C1–C4 production unchanged; C1–C5 evidence A-1579 retained/reverified. Full verification pending, no full-green claim. A-1588: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1588-t-285-permission-and-fixture-delta-clear-at-48e1ab0.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-23 · 2026-10-12T19:06:06.736Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-5
commit: 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0

Medium (verification): hub/test/harness.ts:428 via crew-launch.test.ts:111 reports no session.launch result within 5000ms in the opencode keep_context=false pool case. Test/crew/adapter paths unchanged; cause not established. Preserve assertions and deadline; diagnose the missing result. High peak load 67.65 is observed, not proof of a flake.
A-1598 full run exit 1: 1359/1360 pass, no skips/cancellations, Neovim not reached. Earlier source/permission/cleanup evidence A-1579/A-1588 retained; no prior finding remains in those paths. A-1599: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1599-t-285-full-verify-blocked-by-session-launch-timeout-at-48e1ab0.md.

Criteria: C5 failed (Full verify dddc25d7 failed crew-launch opencode keep_context=false: session.launch returned no result within 5000 ms; Neovim was not reached.).

### impl-285 · 2026-10-12T19:07:44.174Z

Full dddc25d7 at 48e1ab0 finished 1359/1360 hub cases with one 5s session.launch timeout in the unchanged crew-launch OpenCode/keep_context=false test; Neovim was not reached. Exact failing case passes alone on the same task head and dev 37a6a23, with original deadline and assertions unchanged. The Coordinator identified T-291 concurrent stress as the external-load source (peak 67.65; hub phase 1448s vs usual 820s) and explicitly authorized one same-head full retry. No launch/handoff/crew/adapter code or test changed. origin/dev fetched/merged, already up to date. Requesting review and one fresh all run on unchanged 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0.

### rev-23 · 2026-10-12T19:37:23.593Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-6
commit: 48e1ab07991d896d6c6e4c6035d506fa38bdd0c0

Medium: nvim/test/layers.test.ts:203 still expects A to admit Archive-layer notifications and alter cap/earlier count; task now replaces A with departure archive. Preserve exact 50 newest Now/Watch ids, earlier count and hidden layer assertions while testing departures independently of that budget.
Medium: nvim/test/shell.test.ts:1996 still expects old generic ask-refusal hint; screen shows correct new kind-specific answer instructions. Update only expected explanation, retaining row/no-dismiss/option-answer/count/mode checks.
A-1607 full exit1:1661/1663, zero skips/cancellations; prior pool case passes. Compatibility cleanup also fails removed captureRunProcesses API, apparently older loaded suite-lock versus updated root helper (inference; Coordinator reconciliation needed). Source review otherwise retained. A-1608: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1608-t-285-full-verification-stale-neovim-expectations-and-cleanup-mismatch.md.

Criteria: C5 failed (Full verify fc302679 fails two stale Neovim archive/refusal expectations and compatibility cleanup's removed captureRunProcesses call.).

### impl-285 · 2026-10-12T19:39:01.326Z

Fixed rev-2026-10-12-285-6 stale Neovim expectations in 27bfb180878062a126d79293693e21b622d87a15 after merging dev dfd32cb. The cap test now opens a departure archive without consuming any of its 50 now/watch notification rows or changing the 10-earlier count; both legacy hidden layers remain excluded. The ask test checks the specific answer hint and retains answer/frame/count/mode assertions, adding no decline/read frame checks. Both targeted cases and three inbox-workload regressions pass; typecheck passes. The merge duplicated an identical shutdown case, so only the redundant copy was removed. The Coordinator confirmed the captureRunProcesses compatibility failure came from the old live hub loading new helpers, and instructed waiting for the planned dev-hub restart before queuing the next all-suite. No full-green claim; candidate pushed at 27bfb18.

### rev-23 · 2026-10-12T19:39:45.940Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-7
commit: 27bfb180878062a126d79293693e21b622d87a15

No remaining high/medium source/delta findings. Archive cap test retains all50 Now/Watch ids/10 earlier/hidden layers after A and asserts departure separately; ask hint test retains row/frame/option/count/mode checks and adds no decline/read frames. One identical shutdown case remains after duplicate merge copy removal; T-278 merge intact. C1–C5 source/targeted criteria reverified, prior source evidence retained. Coordinator confirmed cleanup mismatch is old live hub; fresh full must wait for dev restart and remains pending, no full-green claim. A-1609: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1609-t-285-neovim-expectation-and-merge-delta-clear-at-27bfb18.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-23 · 2026-10-12T20:02:17.631Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-285-8
commit: 27bfb180878062a126d79293693e21b622d87a15

No remaining high/medium findings. All C1–C5 verified at unchanged head; source/delta A-1579/A-1588/A-1609 retained. Full verify8e682b10/A-1613 after hub restart: typechecks pass; 30/30 free+1346/1346 machine+303/303 Neovim=1679/1679, zero failures/skips/cancellations/todos, exit0 including compatibility cleanup. All inbox/restart/CLI/draft/permission/archive/C7/shutdown and reconciled cap/ask tests pass. A-1614: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1614-t-285-final-review-full-green-at-27bfb18.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-12T20:02:20.780Z

Merged 50214f173ae1eaa8d7be88f923ea267e7d7c864d onto dev.
