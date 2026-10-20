---
id: T-1000
kind: task
title: Panel keys, a move key and every panel opener follow the panel's side
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by:
  - T-999
topic: null
branch: null
created: 2026-10-20T16:57:44.090Z
updated: 2026-10-20T16:58:47.237Z
---

## Summary

The panel keys (`␣i`, `␣n`, `␣s`, `␣t`) open or hide a panel on the side it lives on, and one new key inside a panel sends it to the other side. Everything else that opens a panel (the top-bar chips, `gp` beside a plan, palette actions scoped to a panel) finds it on its side.

## What to build

The panel keys stay toggles on the panel's side (Coordinator decision, 2026-10-20). Inside any panel, `gm` ("go move") sends that panel to the other side; it is a registered action with a title in `␣?` and the palette, and `gm` was found free in the panel buffers' keymaps and the registered actions of `nvim/lua/cland`. The human presses `gm` in Items and it moves to the right; `␣i` then toggles Items on the right. Clicking the needs-you or sessions chip, or pressing `gp`, opens the Inbox, Sessions or Items where the human put it, never back on its old side. `C-h` and `C-l` from the centre reach whichever panel sits on each side.

Neovim's `CTRL-W H`, `L`, `r` and `x` on a panel window are left alone. `nvim/README.md` says that sides move only through cland's key, the palette or `:Cland panel <kind> left|right`.

## Acceptance criteria

- [ ] C1. `␣i`, `␣n`, `␣s` and `␣t` open or hide their panel on its current side, including after a move to the other side, proved by a T2 stub-hub test.
- [ ] C2. `gm` inside a panel sends it to the other side with the same result as the palette action (the 789-1 move rule), and works in all four panels, proved by a T2 stub-hub test.
- [ ] C3. The chip clicks (needs you, sessions, the Coordinator chip with no Coordinator), `gp`, and a palette action scoped to a panel open that panel on its side, proved by T2 tests with Items on the right and Sessions on the left.
- [ ] C4. `C-h` and `C-l` from the centre focus the left and the right panel whatever they show, in Normal and Terminal mode, proved by a T2 test.
- [ ] C5. `gm` appears with its title in `␣?` and the palette, and `actions.audit()` reports no drift (the existing headless audit test passes).
- [ ] C6. A headless-grid case PANELS-018 moves Items to the right and the Inbox to the left with `gm`, and reads both from the grid.
- [ ] C7. The Keys and Commands sections of `nvim/README.md` describe `gm`, the palette and `:Cland panel <kind> left|right`, and state that Neovim's `CTRL-W H/L/r/x` are not part of moving panels.
