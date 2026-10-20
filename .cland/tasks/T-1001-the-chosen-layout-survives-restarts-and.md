---
id: T-1001
kind: task
title: The chosen layout survives restarts, and a reset restores the default sides and widths
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
created: 2026-10-20T16:57:48.199Z
updated: 2026-10-20T16:58:47.349Z
---

## Summary

Which side each panel lives on, and which panel each side shows, are saved in `.cland/ui.json` and in the `:restart` snapshot, and restored on the next start. A reset command and a palette action bring back the default sides and widths. An older `ui.json` loads into the default sides without losing its other preferences.

## What to build

The human puts Sessions on the left and Items on the right, quits, and starts the workbench again, and the layout is the same. `:restart` keeps it too. "Reset panel layout" in the palette (or `:Cland panel reset`) restores the default sides (Items on the left; Sessions, Inbox and Topics on the right) and the default widths (Coordinator decision, 2026-10-20). A broken or older `ui.json` never blocks the start: unknown or contradictory sides fall back to the default with one amber notice.

`ui.json` keeps version 2 and gains optional fields for the sides, so a version-2 file written before this change loads unchanged and E-413's one-time import of `events.last_look` and `plan_seen` can read the file either way (Coordinator decision, 2026-10-20). E-789 should land before E-413's third tracer bullet, which edits the same `ui.lua` and schema.

## Acceptance criteria

- [ ] C1. A headless-grid case PANELS-019 sets Sessions left and Items right, reloads the UI state in-process, rebuilds the layout, and reads the same layout from the grid.
- [ ] C2. Today's version-2 `ui.json` loads with the default sides and keeps its panels, sizes, filters, events preferences, plan receipts and release pick, proved by a T2 test over a fixture file.
- [ ] C3. A `ui.json` with the new side fields stays at version 2, round-trips them through save and load, and keeps `events.last_look` and `plan_seen` readable for an import, proved by a T2 test.
- [ ] C4. An invalid side assignment (an unknown panel, or one panel on both sides) falls back to the default sides with one amber notice and keeps every other preference, proved by a T2 test.
- [ ] C5. The `:restart` snapshot carries the sides and the restore applies them, proved by a T2 test of the snapshot and restore functions.
- [ ] C6. "Reset panel layout" (palette) and `:Cland panel reset` restore the default sides and the default widths and write `ui.json` at once, proved by a T2 test.
- [ ] C7. The real cold restart in `ui.test.ts` and the real `:restart` in `shell.test.ts` keep a swapped layout, proved by targeted local runs of those T3 files with a swapped-layout case added.
- [ ] C8. The UI-preferences paragraph of `nvim/README.md` documents the new fields, the version handling and the reset.
