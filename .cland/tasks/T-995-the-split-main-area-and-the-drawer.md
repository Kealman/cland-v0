---
id: T-995
kind: task
title: The split main area and the drawer
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-994
topic: null
branch: null
created: 2026-10-20T16:51:40.862Z
updated: 2026-10-21T12:56:04.043Z
---

## Summary

⌘\ splits the main area into two panes that swap and close, with a draggable divider at 2:1. The drawer shows the selected row's card or thread with Split and Close, and stays closed when nothing is selected and while split.

## What to build

- **The split.** ⌘\ splits the main area, ⌘Enter on a row opens it in the other pane, and each pane has Swap and Close. The divider drags and starts at 2:1. The rail collapses while split and returns to the human's choice afterwards.
- **The drawer.** It opens on the selected row with Split and Close. It stays closed when nothing is selected and while split, and once closed by hand it stays closed until the selection moves.
- **Esc** closes the drawer and never answers anything.
- **Rows.** The areas have no content until E-416 to E-418, so each area shows a stand-in list of its objects (ids and titles from the hub's frames) that gives the split, the drawer and the folds something to act on; E-416 to E-418 replace them (Coordinator decision).

## Acceptance criteria

- [ ] C1. ⌘\ splits the main area into two panes at 2:1, the divider drags, and each pane's Swap and Close work (browser test).
- [ ] C2. The rail collapses while the main area is split and returns to the human's choice when the split closes (browser test).
- [ ] C3. The drawer opens on a selected row with Split and Close, stays closed when nothing is selected and while split, and after Close stays closed until the selection moves (browser test).
- [ ] C4. ⌘Enter on a row opens it in the other pane (browser test).
- [ ] C5. Esc closes the drawer and sends no frame to the hub (browser test).
