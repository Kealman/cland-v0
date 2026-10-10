---
id: T-123
kind: task
title: "The surfaces read status: items panel filters in status terms, the tree folded by level with unscheduled last, the current release in the top bar, the board's status columns scoped to the release; T-80 closes"
state: open
status: ready
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by:
  - T-119
  - T-121
  - T-122
topic: topic-51
branch: t/T-123-the-surfaces-read-status-items-panel
created: 2026-10-09T21:56:50.147Z
updated: 2026-10-10T02:31:27.509Z
---

## Parent

T-107 (v0.1 release and status), slice 6 of 6. Spec §3.1 (Tree and scope), §3.2 (Filters and columns in these terms, Bug T-80); map T-81, "Settled while charting" (board scoping).

## What to build

The Neovim surfaces read the hub's status, rank and tree. They never derive them (ADR 0003).
- **Items panel filters.** "In work" is `planned`, `in progress`, `review`, `qa` and `ready`; "needs you" is unchanged; "done" is the done tasks of the current release.
- **Items panel tree.** It folds by level: closed releases and epics folded, the current release unfolded. Siblings are ordered by rank. Items under no open release form the "unscheduled" group at the bottom; "all" shows everything.
- **Top bar.** It names the current release: the open release with the lowest version. The human's pick of another release is T-109's.
- **The board.** Its columns are the statuses. It shows the items of open parents in the current release only, with a parent filter in its header naming the epics. The closed items of a closed epic leave it.

T-80 closes with this ticket. Its in-work items under review now show.

The vertical board in the items panel, the rank keys and the "next" mark are T-109's. This ticket keeps the v0 tree panel and board.

## Acceptance criteria

- [ ] On the stub hub, a task moving through `planned`, `in progress`, `review`, `qa`, `ready` and `done` moves between the board's columns and in and out of "in work", from `task` events alone.
- [ ] The board shows only the current release's open parents, with a working parent filter; a closed epic's items leave it.
- [ ] The items panel folds by level with the unscheduled group last; the top bar names the current release.
- [ ] Siblings are shown in rank order.
- [ ] T-80's case, an item under review shown by "in work", is a regression test, and T-80 is closed with a comment.
- [ ] Headless QA cases cover the board's columns and the filters; `nvim/README.md` documents them.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. References: `prototype/panels` `vboard.lua` (`M.status`) and `prototype/graph` `graph.lua` (`M.status`) for the derived rules this replaces; mockups `ItemsBoard.dc.html`, `Main.dc.html`, `screens/v01-items-board.png`. Precedence: the spec, then the prototype's behaviour, then the mockups. Lands before T-109's vertical-board ticket, which rewrites the items panel on top of it.

## Comments

### impl-123 · 2026-10-10T01:51:26.253Z

Reading the status/tree surfaces and tracker protocol. Tests will use the agreed Neovim stub-hub seam plus headless QA cases; the shared rank fixture will verify client ordering.

### impl-123 · 2026-10-10T02:03:11.397Z

Implemented hub-backed status/rank/levels, current-release tree/top bar, seven scoped board columns and registered parent/fold controls. New T-80/event, rank fixture/final-siblings, custom-level/SemVer and board scope regressions pass; real-hub items 3/3 and headless PANELS-011/012 pass. Updating docs is complete; committing before internal review and the final locked root suite.

### rev-6 · 2026-10-10T02:08:57.308Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-123-1
commit: cbf88b4bf6dfacf87e7da6b59e8f5f6820a5e299

Low — nvim/lua/cland/board.lua:136: the eight-cell minimum makes the seven-column grid at least 75 cells, so narrower centres initially clip Done despite per-cell fitting; native horizontal scrolling still reveals the card and its target remains correct.

Standards: clear. Spec: no high or medium findings. Full b693783..cbf88b4 reviewed. Hub-backed status/configured levels replace derived workflow columns; SemVer scope, shared rank ordering and final siblings, task-only board/open-parent filtering, explicit in-work statuses, unchanged needs-you, current-release done and tree folds match the brief. Revised fixture counts/order/card expectations are exact and align with the spec; T-80's close remains the Coordinator's post-landing step.

Read-only scratch Neovim probes confirm SemVer/rank ordering, final siblings, all status-event transitions, scope exclusion/filter reset, folds and the low width limit. Diff check passes; no suite run.

Evidence: A-348, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-348-t-123-review-rev-6-123-1-at-cbf88b4.md.

### impl-123 · 2026-10-10T02:19:18.786Z

Committed head cbf88b4bf6dfacf87e7da6b59e8f5f6820a5e299 passed the full Neovim suite: 152/152, exit 0. Internal Standards/Spec reviews are clear (A-346); external review rev-6-123-1 is clear (A-348). Root npm test is running now; no changes after review.

### impl-123 · 2026-10-10T02:30:07.583Z

First root suite found one catalogue-metadata failure (814/815 hub tests passed): PANELS-012 regression must be yes/no. Corrected to yes and retained T-80 in a separate comment; targeted catalogue test now passes. New committed head 9742c374b609a3755d802fa556454b6c1ca4a826, internal reviews refreshed without new findings. Root rerun queued on the machine suite lock.

### rev-7 · 2026-10-10T02:31:27.460Z

verdict: review
result: clear
by: rev-7 [reviewer]
run: rev-7-123-2
commit: 9742c374b609a3755d802fa556454b6c1ca4a826

Low (carried forward) — nvim/lua/cland/board.lua:136: the seven-column grid's eight-cell minimum initially clips Done in narrow centres; native horizontal scrolling still reveals the card and its target remains correct.

Full-item verdict clear at 9742c374b609a3755d802fa556454b6c1ca4a826. Carry forward rev-6-123-1's baseline clearance at cbf88b4 (A-348), per Coordinator's delta-review request. Standards and Spec independently clear for the sole header change in qa/cases/PANELS-012.lua:6–7. No high or medium findings remain.

Read-only comparison confirms every fixture, executable line and assertion is identical. The exact catalogue parser accepts all six required fields in order, matching case id and regression: yes; uppercase T-80 commentary adds no header field. No suite run. T-80 close/comment remains the Coordinator's post-landing step.

Evidence: A-361, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-361-t-123-review-rev-7-123-2-at-9742c37.md.
