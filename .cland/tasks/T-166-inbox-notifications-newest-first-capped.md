---
id: T-166
kind: task
title: Inbox notifications newest first, capped at the last N with a count of
  earlier ones
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-166
parent: E-115
blocked_by: []
topic: topic-131
branch: t/T-166-inbox-notifications-newest-first-capped
created: 2026-10-10T09:19:59.990Z
updated: 2026-10-11T14:07:18.392Z
closed: 2026-10-11T14:07:18.424Z
---

## Parent

T-110 (Threads that read). A lower-priority follow-up the human reported with the needs-you bug.

## What to build

The inbox's notifications list shows every notification, oldest first (407 on the live build). Show the newest first, and only the last N, with a line saying how many earlier ones there are and how to see them (the Agents log). N is a constant documented in nvim/README.md; 50 is a reasonable default.

## Acceptance criteria

- [x] C1. Notifications are listed newest first.
  - done: impl-166 · 2026-10-11T11:05:18.926Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r4 · 2026-10-11T12:48:47.831Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r5 · 2026-10-11T13:54:09.598Z
- [x] C2. Only the last N show, followed by a line naming the count of earlier ones and where they live.
  - done: impl-166 · 2026-10-11T10:59:18.476Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r4 · 2026-10-11T12:48:47.831Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r5 · 2026-10-11T13:54:09.598Z
- [x] C3. A headless test covers ordering and the cap.
  - done: impl-166 · 2026-10-11T10:59:19.153Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r4 · 2026-10-11T12:48:47.831Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r5 · 2026-10-11T13:54:09.598Z
- [x] C4. `npm run typecheck && npm run test:nvim` pass.
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r4 · 2026-10-11T12:48:47.831Z
  - done: impl-166 · 2026-10-11T13:53:44.765Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T166-r5 · 2026-10-11T13:54:09.598Z

## Notes

Size S. Low priority.

## Comments

### impl-166 · 2026-10-11T10:55:46.733Z

Claimed in task worktree at fa139c8. Scope: Neovim notification rendering, documented 50-row limit, and headless ordering/cap coverage. Will merge origin/dev before review suite.

### impl-166 · 2026-10-11T10:58:34.276Z

Implemented shared display cap of 50 across visible layers, using the hub's oldest-first/insertion-order contract to render newest first within each layer. Short footer fits the narrow panel and names omitted count plus Agents log shortcut. Headless layer file passes 6/6, covering both views, boundaries, equal timestamps, mixed-layer cap and Archive/Background exclusion. Adding dismissal promotion coverage before review.

### rev-15 · 2026-10-11T11:02:39.314Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T166
commit: bb30d60e58a7ccbfd3d36a326bfab401c29e4292

Standards: clear; no findings.
Spec:
Medium — nvim/lua/cland/inbox.lua:111: live insertion prepends a notification, but both views retain numeric cursor rows (panels.lua:593–605; inbox.lua:267–270). Selecting B in [B,A], then receiving C, leaves the cursor on C in [C,B,A]; d dismisses C. Preserve the selected notification ID while it remains visible and test insertion in both views.
C2 cap/footer and C3 ordering/cap coverage checked; C4 fresh suite evidence pending. Review artifact A-1198 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1198-t-166-review-at-bb30d60-live-selection-regression.md. Read-only review; no tests run.

Criteria: C1 failed (Newest-first live redraw retains a numeric cursor row, changing the selected notification and causing d to dismiss another notification.).

### impl-166 · 2026-10-11T11:05:18.769Z

Fixed rev-20261011-15-T166 finding. Both new live-insertion tests first failed with cursor selecting C instead of B. Panel and full-width redraw now capture notification identity before replacing rows and restore it afterward. A selection evicted by the cap moves to the inert earlier-count footer. Targeted layers file now passes 8/8, including actual dismiss action and shared item/session identities. Initial suite run remains pending; fresh final suite will cover the repaired head.

### impl-166 · 2026-10-11T11:23:24.603Z

Initial suite 045ef71d passed typecheck + 276/276 Neovim tests (A-1214), reported at pre-repair bb30d60. Re-review of 9d446d1 is code-clear (A-1201), pending C4. Fetched/merged latest origin/dev 1697ced and pushed final head 4ad51b9345f12d4db2c3229d55c52685446286e5. No task-owned hub changes; launching fresh nvim suite at this head.

### rev-15 · 2026-10-11T12:08:37.227Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T166-r2
commit: 4ad51b9345f12d4db2c3229d55c52685446286e5

Standards: code clear, no findings.
Spec: C1–C3 implementation/coverage established by A-1201 and byte-identical merge verification A-1215. Notification selection regression resolved.
Medium — nvim/test/artifacts.test.ts:233: C4 suite gate fails before moved-buffer assertions; screen says no such artifact after hub: connected and artifacts.open at :232. Artifact snapshot readiness is a likely setup race inferred from call order, not an established notification-code regression.
A-1238 fresh suite 10be9942 at exact4ad51b9: typecheck passed; requested nvim widened to full; hub1210/1210, Neovim275/276, total1485/1486; one failure, zero cancelled/skipped/todo, exit1; peakload24.71. No applicable exception identified. C4 failed; old-head pass cannot establish it. Final review artifact in topic-131. No Reviewer edits or tests.

Criteria: C4 failed (Fresh final-head suite 10be9942 exited 1: moving-an-already-open-prompt artifact regression timed out with no such artifact; Neovim 275/276.).

### impl-166 · 2026-10-11T12:09:27.100Z

C4 investigation: A-1238 typecheck passed; hub 1210/1210, Neovim 275/276 failed before prompt rebind assertions with no such artifact. Exact single-test failure reproduced on this branch and unchanged dev 1697ced in a detached baseline worktree (removed after reproduction). Two-line test synchronization repair now waits for source prompt in the artifact cache before opening in the move and matching reconnect cases; no production artifact code or rebind/save assertions changed. Full artifacts test file running.

### impl-166 · 2026-10-11T12:12:06.420Z

Coordinator withdrew the moved-draft exception because unchanged test fails alone on dev too. Per direction, reverted ce886ac (6af7e97) and cherry-picked T-171 canonical fix 7eb519c (local 711e7dd). Obsolete queued suite a4348006 stopped safely via its worker's SIGTERM cleanup handler; received exit143/A-1243 before replacement. Fresh final suite will cover the canonical repair.

### rev-15 · 2026-10-11T12:47:40.171Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T166-r3
commit: 711e7dd17b63d4d552822282c01397ca0053fa67

Standards: code clear; no findings, A-1249 remains applicable.
Spec: C1–C3 ordering, cap/footer and headless coverage remain established.
Medium — nvim/test/plan.test.ts:216: C4 fresh suite 7273eb91 at 711e7dd fails the moved-item watch/last-look receipt case with Invalid 'buf': Expected Lua number from nvim_buf_get_lines. Exact failing invocation/root cause is not established by the log; plan test/module have no task-owned diff.
A-1258: typecheck passed; requested nvim widened to full; hub1212/1212, Neovim275/276, total1487/1488; zero cancelled/skipped/todo, exit1, peakload20.37. Canonical moved-draft cases pass. No applicable exception; the earlier one was withdrawn and concerned different tests. C4 remains failed. Follow-up review artifact records details.

Criteria: C4 failed (Fresh exact-head suite 7273eb91 exits 1: plan.test.ts:216 moved-item watch/last-look receipt case errors Invalid buf; Neovim 275/276.).

### impl-166 · 2026-10-11T12:48:20.416Z

C4 accepted under Coordinator's explicit T-223 load-sensitive exception (decision0c99b056). At unchanged head711e7dd, suite7273eb91/A-1258 passed typecheck and hub1212/1212; Neovim275/276 had only the plan watch-marks/last-look receipt Invalid buf failure. Exact unchanged isolated plan test passes1/1 in2.46s (A-1260); no plan code/test touched. Both canonical moved-draft tests passed. Per Coordinator no repair/no new run; T-223 owns the plan-test repair. Requesting final review verdict with exception named.

### rev-15 · 2026-10-11T12:48:47.831Z

verdict: review
result: clear
by: rev-15 [reviewer]
run: rev-20261011-15-T166-r4
commit: 711e7dd17b63d4d552822282c01397ca0053fa67

Standards: clear, no unresolved findings; prior parallel reviews A-1201/A-1249 remain applicable.
Spec: clear. C1 newest-first and stable notification selection, C2 documented 50-row cap/earlier-count Agents-log footer, C3 headless ordering/cap/live-selection coverage established.
C4 verified under Coordinator decision 0c99b056's standing load-sensitive exception for the T-188 plan watch-marks/last-look receipt test, repair T-223. Exception ends for heads containing T-223's fix. Exact-head A-1258 suite7273eb91 raw exit1: typecheck pass, hub1212/1212, Neovim275/276, total1487/1488; both phases ran, sole failure plan.test.ts:216 Invalid buf, zero cancelled/skipped/todo. Canonical moved-draft tests pass. A-1260 records that exact plan test passing alone unchanged at clean711e7dd, 1/1 exit0, all assertions retained. No task-owned plan code/test changes. All exception conditions checked; raw suite is not described as green. Supersedes r3 C4 failure under the newly authorized exception; final review artifact records details. No high/medium findings remain under this acceptance policy.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-166 · 2026-10-11T12:50:36.430Z

Resolved latest dev/T-171 merge. Shell assertion now expects newest-first warning death⚠, clear✓, warning not-clear⚠. Targeted shell inbox/notification/warn/needs-you cases pass13/13; layers pass8/8 including real warning protection and cap/live selection. Updated mixed-layer cap fixture to ordinary plan notifications in Now because warnings intentionally remain Watch even under overrides; README documents D retains warnings. Merge resolution committed18527e1; no task-owned hub production changes.

### impl-166 · 2026-10-11T13:53:44.682Z

Final exact-head suite b084fa19/A-1279 at18527e17e792f82fe12d7ac3bd6ef8337e771b38 passed typecheck and all1489/1489 tests, exit0, fail0, skipped0. No load-sensitive exception needed. Warning/cap merge already code-clear in A-1263; requesting final C1–C4 verdict at this tested head.

### rev-15 · 2026-10-11T13:54:09.598Z

verdict: review
result: clear
by: rev-15 [reviewer]
run: rev-20261011-15-T166-r5
commit: 18527e17e792f82fe12d7ac3bd6ef8337e771b38

Standards: clear, no unresolved findings; parallel merged-head review A-1263 checked warning metadata/protection, cursor identity, shell resolution and docs.
Spec: clear. C1 newest-first display preserves selected notification ID. C2 documented50-row visible-layer cap and earlier-count Agents-log footer preserve layer grouping and hub count. C3 headless coverage checks ordering/ties/boundaries/mixed-layer cap/archive/dismissal/live-selection/eviction; T-171 warning glyphs and d/D protection retained.
C4 exact-head suiteb084fa19/A-1279 at18527e1: typecheck pass; requested nvim widened to full; hub1213/1213, Neovim276/276, total1489/1489, rawexit0, zero fail/cancelled/skipped/todo, peakload14.76. No T-223 or other exception needed. All C1–C4 checked; prior711e7dd verdict superseded by clean reviewed merged-head evidence. Final artifact records details; Reviewer made no edits or ran tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T13:54:25.318Z

Merged 083c6d44fc65c22d5cfc50f40be13b0d521f9067 onto dev.
