---
id: T-125
kind: task
title: "The layout persists: .cland/ui.json keeps the preset, panels, sizes, filters and scope; a manual resize beats the layout formulas"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by:
  - T-124
topic: null
branch: null
created: 2026-10-09T21:57:18.371Z
updated: 2026-10-09T21:57:18.371Z
---

## Parent

T-109 (Workbench basics), slice 2 of 5. Map T-81, "Settled while charting" (UI state); spec §3.1 (Tree and scope, the pick kept in `.cland/ui.json`).

## What to build

`.cland/ui.json` keeps the workbench state across restarts: the preset, which panels are open, their sizes, the items panel's filters, and a slot for the human's pick of the current release. The pick itself is set by `e` and `E` in slice 5. The file is per machine, ignored by git, and listed in the managed `.cland/.gitignore` that `cland init` and `cland update` write. A manual resize wins over the layout formulas and survives later layout changes, view switches and preset switches. Switching to a preset applies the preset's panel set without discarding the stored manual sizes of the panels it keeps. Writes are debounced and atomic, by temp file and rename. A missing or corrupt file falls back to defaults with one notice and never blocks startup.

## Acceptance criteria

- [ ] Resize the items panel, switch views and presets, restart headless Neovim against the stub hub: the sizes, open panels, preset and filters come back.
- [ ] A manual size survives a preset switch and a view switch.
- [ ] A corrupt `ui.json` gives defaults and a notice; startup is not blocked.
- [ ] `.cland/ui.json` is in the managed `.cland/.gitignore` after `cland init` and `cland update`, and this project's file gets the line; list it in your report.
- [ ] `nvim/README.md` documents `ui.json`; headless QA cases cover persistence, succeeding `PANELS-00x` on `prototype/panels`.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Risk from the sizing: manual sizes winning over the formulas without breaking presets. Reference: `prototype/panels` `panels.lua`. Lands after slice 1, because both edit the Neovim layout and `init`.
