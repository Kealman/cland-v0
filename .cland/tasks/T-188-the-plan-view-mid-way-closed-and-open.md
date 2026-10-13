---
id: T-188
kind: task
title: "The plan view mid-way: closed and open stages, change marks in the watch
  colour, S2 tags on item rows"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-188
parent: E-114
blocked_by:
  - T-187
  - T-185
  - T-186
topic: topic-122
branch: t/T-188-the-plan-view-mid-way-closed-and-open
created: 2026-10-10T15:38:38.467Z
updated: 2026-10-11T10:32:02.360Z
---

## Parent

T-114, slice 6 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

Closed stages' marks and QA runs, the stage in work with its sessions, dimmed planned stages, change marks until the human opens the view, the right column, and the "S2" tag on the items panel's rows.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-188 · 2026-10-11T07:54:45.572Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-188-3 · 2026-10-11T07:56:30.111Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-188-5 · 2026-10-11T09:32:14.539Z
- [x] C2. Demo: a lead moves an item between stages; the view marks the move in the watch colour with its reason until the human looks.
  - done: impl-188 · 2026-10-11T07:40:22.925Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-188-3 · 2026-10-11T07:56:30.111Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-188-5 · 2026-10-11T09:32:14.539Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-188 · 2026-10-11T07:29:48.098Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-188-3 · 2026-10-11T07:56:30.112Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-188-5 · 2026-10-11T09:32:14.539Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-188 · 2026-10-11T10:31:20.910Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-188-6 · 2026-10-11T10:31:44.825Z

## Comments

### impl-188 · 2026-10-11T07:14:57.771Z

Using the accepted headless Neovim and real hub frame seams. Existing stage/approval metadata will drive progress; plan change notices need previous/current plan and optional reason to survive reconnect and show authoritative changes. Adding that bounded protocol support means final cland suite all rather than nvim-only.

### impl-188 · 2026-10-11T07:30:05.964Z

Implementation committed/pushed at f1d763b2f08057e4b669c7e16e4e3613bc429e9f. A-1110 records scope, local Standards/Spec review, real-hub restart/change-reason demo and headless mid-way/receipt/equal-time/closure regressions. Typecheck passes; targeted hub plan 10/10 and Neovim plan 9/9 pass with no fail/cancel/skip/todo. C1-C3 done. Fetched and merged origin/dev 343226b before handoff (already up to date). Requesting rev-13 review and cland suite all; C4 remains pending.

### rev-13 · 2026-10-11T07:36:08.880Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-188-1
commit: f1d763b2f08057e4b669c7e16e4e3613bc429e9f

Medium — nvim/lua/cland/plan.lua:45: restored plan views bypass plan.enter (layout.lua:529), so looking after restart never saves the receipt and reopening repeats seen change marks.

Medium — nvim/lua/cland/plan.lua:505: future per-item QA counts every non-done item, including ready items with current clear QA; the panel shows already-completed QA as still to come.

Low heuristic — hub/src/tracker/tracker.ts:815: writer/reason travel through long positional publication signatures; a named context could reduce misrouting.

A-1113 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1113-t-188-review-at-f1d763b-restored-receipts-and-future-qa-not-clear.md records both review axes and evidence. Independent typecheck passed; C3 docs established, C4 full suite pending.

Criteria: C1 failed (Future QA count includes ready items whose current clear QA already satisfies the gate.), C2 failed (Restoring an open plan view bypasses attention receipt acknowledgment and repeats already-seen change marks.).

### impl-188 · 2026-10-11T07:40:23.756Z

Fixed rev-13's A-1113 findings and pushed 3b9d657a667d3af261b7aa9dd99758748e079611. Restored plan views initialize a visit once; future per-item QA excludes only the latest explicitly current clear run. New headless regressions fail before fixes and pass afterward; complete nvim/test/plan.test.ts passes 11/11 with zero fail/cancel/skip/todo. Typecheck passes, worktree/diff-check clean, origin/dev 343226b fetched/merged. C1/C2 marked done again; requesting re-review and a fresh all suite. Prior suite interrupted before edits (A-1116); C4 still pending.

### rev-13 · 2026-10-11T07:42:23.134Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-188-2
commit: 3b9d657a667d3af261b7aa9dd99758748e079611

Medium — nvim/lua/cland/plan.lua:165: needs_item_qa accepts file-only clear/current QA headers. Freshness annotates a hand-written header at HEAD as current, so the panel removes a required future run while the gate refuses qa-provenance. Select qualifying hub QA evidence consistently with the gate and cover this boundary.

The restored visit/receipt finding is fixed, as are current/stale/unknown/latest-failed cases. C2/C3 are established; independent typecheck passed. C4 remains pending the new complete suite. A-1118 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1118-t-188-re-review-at-3b9d657-restored-receipt-fixed-qa-provenance-not-clear.md records both axes. Prior low positional writer/reason heuristic is unchanged.

Criteria: C1 failed (File-only current clear QA headers suppress future QA although they cannot satisfy the hub-written QA gate.).

### impl-188 · 2026-10-11T07:54:45.472Z

Fixed A-1118 QA provenance finding at pushed head 9b8f7853abc0a399133306e6625a1e87049b91de. task.view.qaSatisfied uses canonical gate evidence; task.view.merged requires a closed task with a durable dev receipt, removing the manual-done bypass and correcting merged bars. Evidence A-1121: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1121-t-188-qa-provenance-and-landing-fixes-at-9b8f785.md. Final-head typecheck passed; plan file 11/11; focused real-hub QA/landing regression 1/1. Broader merge file also completed 42/42, no failures/cancellations/skips/todos. Both local review axes clear. Fresh fetch/merge origin/dev 343226b is already up to date. C4 awaits a complete corrected-head all suite; interrupted superseded runs are not pass evidence.

### rev-13 · 2026-10-11T07:56:30.112Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-188-3
commit: 9b8f7853abc0a399133306e6625a1e87049b91de

No high or medium findings remain. Shared gate qualification over durable merge evidence fixes QA provenance; closed+dev receipt fixes landing counts/bars. Restored attention receipt behavior remains intact. C1–C3 established at 9b8f785.

Low heuristic — hub/src/tracker/tracker.ts:815: prior writer/reason positional Data Clumps remains unchanged and nonblocking.

Independent typecheck/diff check passed. A-1121 records plan11/11, focused QA/landing1/1 and merge42/42. A-1123 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1123-t-188-re-review-at-9b8f785-c1-c3-clear-full-suite-pending.md records both axes and evidence. C4 remains unverified until the fresh complete same-head suite; final readiness withheld. Interrupted old-head runs are not evidence; no exception applied.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-13 · 2026-10-11T09:17:11.073Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-188-4
commit: 9b8f7853abc0a399133306e6625a1e87049b91de

Medium — nvim/test/thread.test.ts:557: full-suite background fold test failed the board rank-selection assertion (expected T-21, actual undefined). The log establishes a validation failure; its underlying cause and attribution are unresolved.

A-1148: typecheck completed, hub 1151/1151 pass, Neovim 259/260 pass, total 1410/1411; one failure and zero cancellations/skips/todo, all exit 1. No standing exception covers this case. C4 failed; final readiness withheld. Same-head C1–C3 source review stands.

A-1149 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1149-t-188-c4-at-9b8f785-full-suite-not-clear-board-rank-regression.md records both axes and complete result. No edits or independent writing tests.

Criteria: C4 failed (Full suite exit 1: background-fold board-rank assertion at thread.test.ts:557 expected T-21 but received undefined.).

### impl-188 · 2026-10-11T09:27:20.213Z

Pushed corrected final head 54e18262dbf8d9b5ee1efea83e9bf3e5480ad908 after merging origin/dev 0ed3774. A-1157 records diagnosis, red-green probes and integration correction: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1157-t-188-suite-failure-diagnosis-and-post-dev-fixes-at-54e1826.md. Full suite's rank assertion was an asynchronous request snapshot race; the test now waits actual rank receipt before assertion or reorder events. Initial verdict history also waits before unchanged mark assertions. All 24 thread tests pass. Preserved merged plan history and incoming criterion freshness; landed tasks retain fractions against their durable task tip after cleanup/restart. Real hub closed/restart and active exact-head regressions pass 2/2; typecheck passes; post-dev plan 11/11 and hub plan 10/10 pass. Both self-review axes have no blocking findings. C4 remains failed/pending until a successful current-head all suite; no exception is claimed.

### rev-13 · 2026-10-11T09:32:14.539Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-188-5
commit: 54e18262dbf8d9b5ee1efea83e9bf3e5480ad908

Low — hub/src/tracker/tracker.ts:819: unchanged possible Data Clumps in writer/reason parameters across publication helpers; a context type could reduce positional mistakes. Nonblocking.

No high or medium findings. Dev integration retains ordered planHistory/approval/stages and exact-head annotation. Closed landed fractions use receipt.tip after pruning/restart; active/reopened/receipt-less items retain live freshness and closed tasks remain ineligible for merge. Bounded rank/history waits preserve original assertions. C1–C3 refreshed at 54e1826; independent typecheck and diff checks pass on the clean pushed head. C4 remains pending the new complete same-head all suite; no waiver or final readiness claim.

A-1160: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1160-t-188-integration-at-54e1826-c1-c3-clear-corrected-suite-pending.md records separate Standards and Spec reports and A-1157 targeted evidence.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-188 · 2026-10-11T10:31:21.075Z

C4 marked done after complete same-head cland suite all f970373b-a09e-4b90-a60c-672458f5e95e passed at 54e18262dbf8d9b5ee1efea83e9bf3e5480ad908. Typecheck and 1430/1430 tests passed; failures, cancellations, skips and todos all zero. Durable log A-1183: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1183-suite-f970373b-a09e-4b90-a60c-672458f5e95e-all-at-54e1826.log. Current worktree head matches tested head and is clean. Requesting rev-13 final C4 verification; C1–C3 were freshly verified on this same head (A-1160).

### rev-13 · 2026-10-11T10:31:44.825Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-188-6
commit: 54e18262dbf8d9b5ee1efea83e9bf3e5480ad908

No high or medium findings. A-1183 establishes C4 at unchanged clean pushed54e1826: typecheck and full npm test exit0, hub1166/1166 + Neovim264/264 =1430/1430, zero failures/cancellations/skips/todo. No exception applied.

Same-head C1–C3 review rev-13-20261011-188-5 (A-1160) stands, including its unchanged low nonblocking positional-metadata heuristic at hub/src/tracker/tracker.ts:819. All criteria are now reviewed on this head and final readiness is clear; item QA policy remains none/per-item.

A-1184: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1184-t-188-final-c4-at-54e1826-full-1430-1430-clear.md records complete final validation and separate Standards/Spec conclusions.

Criteria: C4 verified.

### coord · 2026-10-11T10:32:02.360Z

Merged 2d3a8405c7c585a6d2433d8321f798b3defd0327 onto dev.
