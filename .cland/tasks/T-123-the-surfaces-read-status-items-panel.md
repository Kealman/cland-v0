---
id: T-123
kind: task
title: "The surfaces read status: items panel filters in status terms, the tree folded by level with unscheduled last, the current release in the top bar, the board's status columns scoped to the release; T-80 closes"
state: open
status: in progress
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
updated: 2026-10-10T01:51:26.253Z
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
