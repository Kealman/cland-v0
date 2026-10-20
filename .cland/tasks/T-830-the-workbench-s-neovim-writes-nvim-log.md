---
id: T-830
kind: task
title: The workbench's Neovim writes nvim.log into the hub's state directory ~/.local/state/cland
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-609
topic: topic-697
branch: t/T-830-the-workbench-s-neovim-writes-nvim-log
created: 2026-10-19T06:11:28.700Z
updated: 2026-10-20T06:13:04.432Z
---

## Summary

Found while dry-running the E-612 QA brief: the Neovim workbench runs as app `cland`, so Neovim's own `nvim.log` lands in `~/.local/state/cland`. That folder has been the hub's per-user state directory since T-609, beside `spend.json`. Neovim's logs and other state should stay out of it.

## Acceptance criteria

- [x] C1. The workbench's Neovim writes its log and state under its own app directory (for example `NVIM_APPNAME`-derived `~/.local/state/cland-nvim`, or Neovim's default), never into the hub's state directory; a T2 test with a scratch XDG_STATE_HOME shows `~/.local/state/cland` holds only the hub's files after the workbench opens.
  - done: impl-830 · 2026-10-20T06:11:55.729Z

## Comments

### impl-830 · 2026-10-20T06:09:44.356Z

Implemented NVIM_APPNAME=cland-nvim and one-time allowlisted legacy-state migration. Client regression reproduced the old shared-directory behavior before the fix and now passes through the real launcher with scratch XDG directories, inherited log-path isolation, destination preservation, untouched hub files and no migration replay. Current UI preferences remain project-local.
