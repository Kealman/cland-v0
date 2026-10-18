---
id: E-789
kind: epic
title: Panels by choice in the Neovim workbench
state: open
labels:
  - needs-triage
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-18T09:12:36.923Z
updated: 2026-10-18T09:12:36.923Z
---

## Summary

The human asked on 2026-10-18 (General, ask 03c2a877, answered 09:12Z) to let the human choose what each side panel of the Neovim workbench shows. Today the left panel is always Items and the right one switches among the other panels. Any panel should open on either side. Neovim only; the web keeps its own rail and split design.

## What to build

- Any workbench panel (Items, Sessions, Topics, Inbox, Events, Artifacts, Accounts, Verification and the rest that the right side hosts today) can be opened on the left or on the right, from the palette and by key.
- The chosen layout is remembered per human in the workbench's UI state and restored on the next start; the current layout stays the default.
- Panel keys, focus motions, widths and the dock keep working whichever side a panel is on; the same panel is never shown on both sides at once.

## Definition of done

- [ ] D1. Opening Sessions on the left and Items on the right from the palette works, and both keep their keys and live updates.
- [ ] D2. The layout survives a workbench restart, and a reset command restores the default.
- [ ] D3. Existing layout, width and focus tests stay green, and new headless-grid cases cover both sides.
