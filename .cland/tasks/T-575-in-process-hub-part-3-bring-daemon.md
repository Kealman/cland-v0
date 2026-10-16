---
id: T-575
kind: task
title: "In-process hub, part 3: bring daemon starts per full run from 743 to under 600"
state: open
status: in progress
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-578
blocked_by: []
topic: topic-376
branch: t/T-575-in-process-hub-part-3-bring-daemon
created: 2026-10-16T06:12:55.788Z
updated: 2026-10-16T16:04:06.669Z
---

## Summary
T-466's full Mac census at 88a3630e (A-3775) measured 743 daemon starts per full run, 742 of them canonical. The E-387 target is under 600, so at least 144 more net removals are needed. A-3775's per-file table ranks the remaining files and marks the lifecycle cautions. Its biggest contributors include remote-fixture-lifecycle (60, mostly load-gate repetitions of new tests, which the next durations refresh removes), daemon (26) and planned-stage (17). Each migrated file needs the lifecycle audit T-393 and T-466 used.

## Acceptance criteria
- [ ] C1. The next files from A-3775's ranking move to the in-process hub, with their lifecycle tests kept spawned and their assertions unchanged, and an audit posted.
- [ ] C2. A full-run spawn census after a durations refresh shows daemon starts under 600, with the per-file table recorded.

## Comments

### impl-575 · 2026-10-16T15:53:28.983Z

Ranked migrations underway; daemon 18/18, planned-stage 11/11, account-limited 10/10, suite-stage-cover 3/3, Neovim artifacts 9/9, account-poller 10/10, agents-journal 8/8 and artifact-browser 11/11 pass serial targeted runs. Restart, down-hub CLI, orphan/watchdog and instrumentation cases stay spawned. C2 measurement is assigned to the Coordinator after clear source review and green same-head diff-selected verify (decision 23a58883). No measured full-count claim yet.

### impl-575 · 2026-10-16T16:04:06.669Z

Source committed/pushed at e653452c8bae7a6008383de1439b2612f06696f8 after merging latest origin/dev. C1 audit A-3960 records 27 migrated test files + typed fixture forwarding, projected 156 ordinary-pass daemon removals, retained lifecycle cases, and exact preservation of 219 declarations / 1,767 assertion callsites. Serial whole-file targeted validation: 26 files green; task-worktrees timing case T-581 red twice (A-3942/A-3956), all eight other cases pass both times. Root typecheck at head exits 0. Coordinator decision 8e2aa2f4 holds review until its T-581 shared fix is posted/cherry-picked, then rerun task-worktrees. No full suite/census run; C2 is Coordinator-owned after source clear and green same-head diff-selected verify.
