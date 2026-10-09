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
topic: topic-43
branch: t/T-125-the-layout-persists-cland-ui-json-keeps
created: 2026-10-09T21:57:18.371Z
updated: 2026-10-09T22:44:59.673Z
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

## Comments

### impl-125 · 2026-10-09T22:30:19.027Z

Read the item, epic, map's UI-state decision, spec §3.1 and prototype panels/layout reference. Implementing a per-project UI-state store and preserving manual panel sizes across layout changes; tests will exercise the stub-hub restart sequence, corrupt input and an interrupted atomic write.

### impl-125 · 2026-10-09T22:34:58.917Z

Added ui.lua, persistent settings and manual-size precedence, cold-process restart and atomic-interruption tests, and shipped PANELS-005/006 QA cases. Both shipped cases pass. Root .cland/.gitignore now has the ui.json line after hub.json (Coordinator to commit that instance file). Targeted testing caught a delayed WinClosed notification replacing the manual-resize baseline; stale closes now leave the baseline untouched.

### rev-65 · 2026-10-09T22:39:07.306Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-125-1
commit: 52adb19e9410bfe04bea0a99896b2925cff9b0eb

Medium — nvim/lua/cland/layout.lua:519: a delayed recognized centre/composer/session-split close resets every surviving panel's measured baseline without storing a pending manual resize, so the next fix discards it; preserve surviving measurements and cover this sibling interleaving.
Low — nvim/lua/cland/ui.lua:21: possible Duplicated Code (heuristic): the saved-preset validator duplicates layout.PRESETS, so a newly supported preset could invalidate its own persisted state; use the existing table.

Read-only actual pinned Lua probe: formula width 35 → manual 48 → queued recognized split-close → resized stores no override → fix restores 35. Centre/composer closes reproduce the same loss; stale unrecognized close correctly retains 48. Standards: 0 high/medium, 1 low. Spec: 1 medium. No suite or files changed. Evidence A-241: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-241-t-125-review-of-52adb19-recognized-close-loses-resize.md.

### impl-125 · 2026-10-09T22:39:45.983Z

Fix round rev-65-125-1 (A-241): cancelled the still-queued full-suite waiter for 52adb19. Correcting delayed recognised centre/composer/session-split close handling to capture a pending manual resize first, adding regression coverage for each split type, and deriving valid saved presets from layout.PRESETS.

### impl-125 · 2026-10-09T22:41:56.709Z

Resolved rev-65-125-1 on new head d4ac23e35b956a349ac5f6462a0c3f7002d3a779: capture pending sizes before immediate and scheduled close processing, suppress captures during programmatic layout operations, and retain capture ordering when rebuilding. Added actual-Neovim delayed-close regression cases for centre, composer, session split, left/right/dock panels and stale callbacks. Preset validation now uses layout.PRESETS. All 4 targeted UI tests, shipped PANELS-005/006 and npm run typecheck pass. The queued old-head suite was cancelled before it started; starting the full suite on the new committed head.

### rev-65 · 2026-10-09T22:44:59.673Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-125-2
commit: d4ac23e35b956a349ac5f6462a0c3f7002d3a779

Medium — nvim/lua/cland/layout.lua:115 (via delayed on_win_closed capture at :506): closing the sole board centre automatically expands a surviving panel, which capture_sizes records as a manual override; preserve preferred sizes across closure-induced redistribution while still capturing genuine post-close resizes.

Actual pinned headless-Neovim probe: saved/actual widths 48/46 → close board centre without composer → actual 48/111 → delayed close stores 48/111 → reopening centre retains right111 and constrains left to27. No human resize occurred. The new test's Watch centre retains its composer column and checks only the left survivor, so misses this case.

Both prior findings are resolved: A-241 virtual-window probe now preserves pending48 across split/centre/composer and stale closes; preset validation uses PRESETS. Standards: 0 findings. Spec: 1 medium. No suite, hub writes or file changes by Reviewer. Evidence A-243: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-243-t-125-resolution-review-of-d4ac23e-automatic-close-resize-persists.md.
