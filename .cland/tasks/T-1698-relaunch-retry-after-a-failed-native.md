---
id: T-1698
kind: task
title: "Relaunch retry after a failed native admission: same-destination refresh and onward third-host transfer"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1614
topic: topic-1398
branch: t/T-1698-relaunch-retry-after-a-failed-native
created: 2026-11-05T19:34:54.917Z
updated: 2026-11-06T00:32:44.178Z
---

## Summary

T-1614 moves a session to another host. When native admission on the destination fails after the checkout and the lease transfer, T-1614 leaves the destination fenced in an `adding` state with a named reason, and nothing is corrupted. The rest of the retry is this item:
- a known-prepared retry onto the same destination must reuse the captured checkout and Git-admin identity, and refresh to an advanced pushed tip;
- a retry onto a third host must retire or retain the second host's checkout and ref-watch as named obligations, never overwrite their only owner.

Raised by rev-35's initial review of T-1614 (items 2 and 3).

## What to build

1. A same-destination retry after a known native-admission failure reuses the prepared checkout by its captured identity, fetching and resetting it to the current pushed tip if the tip advanced.
2. A third-host retry transfers the lease onward under the territory lock. The previous destination's checkout and ref-watch become a named obligation for settlement. No owner is silently overwritten.
3. Unknown preparation stays fenced, as in T-1614.

## Acceptance criteria

- [x] C1. After a native-admission failure on f2 and a push that advances the tip, a retry onto f2 runs the session at the new tip using the same prepared checkout (test).
  - done: impl-1698 · 2026-11-06T00:24:57.691Z
- [x] C2. After a native-admission failure on f2, a retry onto f3 runs the session on f3, and f2's checkout and ref-watch are reported as a retained obligation with no f2 state overwritten (test).
  - done: impl-1698 · 2026-11-06T00:24:57.894Z

## Comments

### impl-1698 · 2026-11-06T00:15:04.978Z

Rule 20 sweep before edits: searched hostRelaunch/host-relaunch, HostWorktreeRecord, hostWorktrees/saveHostWorktree, transferBranchLeaseLocked, reuseOnly, worktreeAdd and checkout identity names across hub/web/nvim/shared/docs/qa/.agents and all tiers, including T-1614 consumer inventory. Migrate Sessions resume/failure/warning owner, TaskWorktrees admission/preparation, agent prepared/worktree operation and SSH Host result. Add optional checkout receipt and retained obligations to existing JSON records, preserving old fields; legacy missing receipt remains fenced. Store JSON serialization and ProcessTable atomic completion preserve extra fields unchanged. Listing/prune/flush retain current-owner semantics and retained obligations must remain in that row. Lease file readers (git-daemon/receive, territory merge and batch) unchanged TSV host/branch; transfer keeps territory lock. CLI/web/nvim/setup/spoke/protocol frames and permission classification unchanged (optional existing host frame); previous-wire session-resume plus unedited T-1614 tests provide compatibility. Fixtures/QA stage4/startup probes use old worktree replies and remain accepted; new retry requires positive optional receipt. Agent prepared-checkout uses the existing shared identity validator, not a duplicate parser. Test inventory and full search output will be committed in docs/evidence/T-1698-consumers.md before verify.

### impl-1698 · 2026-11-06T00:28:43.343Z

Coordinator decisions8a85dc4d/105c6e3a supersede the launch brief's blanket unedited-test requirement only for host-relaunch.test.ts refused-case retry migration. Exactly three edits: f2 retry now asserts repeated named native refusal (fixture always refuses f2); f3 retry now asserts named unregistered-destination refusal (fixture has no f3); spawned-attempt count2→3. Drain, f1-return setup, no-host fence and all other T-1614 test files unchanged. New retry tests return f1 before f2/f3 retry, preserve no-host/source fences, and add f2→f3→f4 positive flat-retention proof. Source review found and is holding for these returned-source and nested-history corrections before a new pin. Correction to progress: preserved host-push-on-ref-move at current dev has FOUR generated top-level cases,4/4 passed, not my earlier5/5 label copied from launch brief. Exact generated outputs will be in artifact; no fifth case was executed or claimed as coverage.

### rev-35 · 2026-11-06T00:32:44.178Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1698-source-1
commit: 0245e5c46a54e26faeee3fd720e583f439fbdf00
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-16989: full source clear. Positive settled native-failure receipt + exact checkout ownership authorize retry; same destination validates inode/Git-admin/branch/tip before refresh and before install without acquiring deletion authority. Onward transfer preserves prior full checkout/ref-watch obligations once, under existing locks, and existing atomic publication preserves the complete owner. Returned-source continuation and recursive retention blockers from the ongoing predecessor review are corrected under Coordinator8a85dc4d/105c6e3a; initial live-source refusal and no-host/source-directed fencing remain. New f4 case checks two flat retained records and unchanged old watch/identity facts. Only authorized old refusal assertions/count migrated; consumers/docs/skill/tier/index inspected, all32 closure hashes match, diff check clean. No remaining findings. C1/C2 remain unverified pending named exact-head runtime/preservation/configured evidence; predecessor reports are not final coverage. Source clear permits configured mode-free verify at this unchanged head after required local checks; no Reviewer execution. After-stage QA separate.
