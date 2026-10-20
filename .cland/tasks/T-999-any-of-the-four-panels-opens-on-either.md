---
id: T-999
kind: task
title: Any of the four panels opens on either side from the palette
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by: []
topic: topic-753
branch: t/T-999-any-of-the-four-panels-opens-on-either
created: 2026-10-20T16:57:43.127Z
updated: 2026-10-20T17:02:17.410Z
---

## Summary

The workbench stops assuming that the left panel is Items. Each of the four panels (Items, Inbox, Sessions, Topics) has a home side, the left or the right, that the human chooses from the palette or with `:Cland panel`, and each side shows one of the panels assigned to it, as the right side does today (human, 2026-10-20). Each panel keeps its own keys and its live updates on whichever side it is shown.

## What to build

The human opens the palette and picks "Sessions on the left", then "Items on the right". Sessions becomes the left side's panel and Items the right side's, and both follow hub events as they do today. Every panel key (Enter, the Sessions keys, the Items filters and folds, digits on an Inbox ask, `n` on Topics) works there. Only these four panels are placeable; Events, Artifacts, Accounts and the verification queue stay what they are (human, 2026-10-20).

A panel is never shown on both sides at once. When a panel is asked for on the other side, it moves there, closing on the old side, and that side becomes its home side (Coordinator decision, 2026-10-20). When two panels have the same home side, opening one replaces the other on that side, as Sessions, Inbox and Topics do on the right today. With no choice made, the default homes apply: Items on the left, Sessions, Inbox and Topics on the right, and the workbench opens exactly as it does today.

This slice removes the hard-coded "left = Items" from the layout and from its callers' window bookkeeping (`layout`, `panels`, `actions`, `qa.state`). Keys, persistence, widths and the other openers come in the tickets that follow.

## Acceptance criteria

- [ ] C1. The palette offers "<Panel> on the left" and "<Panel> on the right" for Items, Inbox, Sessions and Topics, and `:Cland panel <kind> left|right` does the same, proved by a T2 component test on the stub hub.
- [ ] C2. With Sessions on the left and Items on the right, both panels render and follow hub events (a `session.state` frame and a `task` frame change the visible rows), proved by a T2 stub-hub test.
- [ ] C3. With the panels swapped, each panel's keys still work (Enter opens the row in the centre; `x` and `c` on Sessions; `1`-`6` and `za` on Items; a digit on an Inbox ask; `n` on Topics), proved by a T2 stub-hub test.
- [ ] C4. Asking for a panel on the other side moves it there, closes it on the old side and makes the new side its home, so a panel is never shown twice, proved by a T2 test.
- [ ] C5. When two panels share a home side, opening one replaces the other on that side and the replaced panel keeps its home, proved by a T2 test.
- [ ] C6. Closing either panel with `:q` or `CTRL-W c` clears only that side's state, and the centre is re-made when it was the sole column, proved by a T2 test.
- [ ] C7. `qa.state().panels` reports which panel each side shows, and the shipped PANELS-005 to PANELS-016 and ITEMS-001/002 cases pass unchanged under `cland --headless --qa`.
- [ ] C8. A new headless-grid case PANELS-017 opens Sessions on the left and Items on the right from the palette, then reads both panels' headers and one live row change from the grid.
- [ ] C9. With no side chosen, the workbench opens as today (General in the centre, Sessions on the right, Items on the left when opened), and the existing T2 panel-key and preset tests in `shell-component.test.ts` pass unchanged.
- [ ] C10. `ui.test.ts` and `shell.test.ts` pass as targeted local runs on the branch, since their layout cases are T3 and batches run T1 only.

## Comments

### impl-999 · 2026-10-20T17:02:17.410Z

Implementation seam: generic placement/open/lookup in layout, retaining boolean ui.left and adding runtime left_kind/panel_homes so shipped QA shape remains compatible. ui.json stays v2; side persistence/reset belongs to T-1001. First targeted T2 attempt did not reach assertions: fixture admission refused `no hello received`; escalated under rule 5.
