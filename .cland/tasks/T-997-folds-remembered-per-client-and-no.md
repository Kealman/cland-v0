---
id: T-997
kind: task
title: Folds remembered per client, and no explanatory prose
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-996
topic: null
branch: null
created: 2026-10-20T16:51:41.075Z
updated: 2026-10-20T16:51:41.075Z
---

## Summary

Every group and block folds with a chevron and the keyboard, and the browser remembers the folded state per client without the hub. A check keeps explanatory prose out of the interface.

## What to build

One fold component with a chevron and keys from the key map, its state stored under the area's versioned key. Nothing goes to the hub, and `ui.json` stays Neovim's. The reference component in `AGENTS.md` uses it. Headers carry a name and a count, and a browser check fails on a visible sentence outside the tooltips and the `?` panel (the check is mechanical: a visible text node outside `title` attributes, tooltips and the `?` panel that ends with a full stop or holds more than six words fails).

## Acceptance criteria

- [ ] C1. A group folded with its chevron and with the keyboard stays folded across a reload (browser test).
- [ ] C2. Folding sends no frame to the hub (browser test counts outgoing frames).
- [ ] C3. A mechanical browser check (a visible text node outside `title` attributes, tooltips and the `?` panel that ends with a full stop or holds more than six words) fails on a fixture that adds an explanatory sentence to a header and passes on the shell.
- [ ] C4. The reference component named in `AGENTS.md` uses the fold component.
