---
id: T-161
kind: task
title: "Graph cursor and live updates: node motions with edges highlighted, the winbar, Enter, gi, gt and gs, sideways scroll, redraw only on a visible change"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by:
  - T-160
topic: null
branch: null
created: 2026-10-10T07:49:36.665Z
updated: 2026-10-10T07:49:36.665Z
---

## Parent

T-116 (The task graph), slice 3 of 5.

## What to build

The node cursor and live updates. A cursor moves node to node with `h`, `l`, `j`, `k`, `^` and `$`, with its edges highlighted. The winbar spells the node out. Enter opens the item; `gi`, `gt` and `gs` act on the node as they do elsewhere. The window scrolls sideways to keep the cursor in view. A hub update redraws only on a visible change and keeps the cursor on its node; `␣␣` returns to the same node after opening an item.

## Acceptance criteria

- [ ] The motions move node to node; edges of the cursor's node are highlighted; the winbar names it.
- [ ] Enter, `gi`, `gt` and `gs` act on the node.
- [ ] Sideways scrolling keeps the cursor visible.
- [ ] A claim landing on a node redraws it in place with the cursor kept; an update with no visible change redraws nothing; headless tests cover both.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-160 (The graph view)
