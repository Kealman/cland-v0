---
id: T-1001
kind: task
title: The chosen layout survives restarts, and a reset restores the default sides and widths
state: open
status: review
size: S
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by:
  - T-999
topic: topic-761
branch: t/T-1001-the-chosen-layout-survives-restarts-and
created: 2026-10-20T16:57:48.199Z
updated: 2026-10-20T18:33:02.300Z
---

## Summary

Which side each panel lives on, and which panel each side shows, are saved in `.cland/ui.json` and in the `:restart` snapshot, and restored on the next start. A reset command and a palette action bring back the default sides and widths. An older `ui.json` loads into the default sides without losing its other preferences.

## What to build

The human puts Sessions on the left and Items on the right, quits, and starts the workbench again, and the layout is the same. `:restart` keeps it too. "Reset panel layout" in the palette (or `:Cland panel reset`) restores the default sides (Items on the left; Sessions, Inbox and Topics on the right) and the default widths (Coordinator decision, 2026-10-20). A broken or older `ui.json` never blocks the start: unknown or contradictory sides fall back to the default with one amber notice.

`ui.json` keeps version 2 and gains optional fields for the sides, so a version-2 file written before this change loads unchanged and E-413's one-time import of `events.last_look` and `plan_seen` can read the file either way (Coordinator decision, 2026-10-20). E-789 should land before E-413's third tracer bullet, which edits the same `ui.lua` and schema.

## Acceptance criteria

- [x] C1. A headless-grid case PANELS-019 sets Sessions left and Items right, reloads the UI state in-process, rebuilds the layout, and reads the same layout from the grid.
  - done: impl-1001 · 2026-10-20T18:27:59.853Z
- [x] C2. Today's version-2 `ui.json` loads with the default sides and keeps its panels, sizes, filters, events preferences, plan receipts and release pick, proved by a T2 test over a fixture file.
  - done: impl-1001 · 2026-10-20T18:28:00.482Z
- [x] C3. A `ui.json` with the new side fields stays at version 2, round-trips them through save and load, and keeps `events.last_look` and `plan_seen` readable for an import, proved by a T2 test.
  - done: impl-1001 · 2026-10-20T18:28:00.996Z
- [x] C4. An invalid side assignment (an unknown panel, or one panel on both sides) falls back to the default sides with one amber notice and keeps every other preference, proved by a T2 test.
  - done: impl-1001 · 2026-10-20T18:28:01.613Z
- [x] C5. The `:restart` snapshot carries the sides and the restore applies them, proved by a T2 test of the snapshot and restore functions.
  - done: impl-1001 · 2026-10-20T18:28:02.134Z
- [x] C6. "Reset panel layout" (palette) and `:Cland panel reset` restore the default sides and the default widths and write `ui.json` at once, proved by a T2 test.
  - done: impl-1001 · 2026-10-20T18:28:02.754Z
- [x] C7. The real cold restart in `ui.test.ts` and the real `:restart` in `shell.test.ts` keep a swapped layout, proved by targeted local runs of those T3 files with a swapped-layout case added.
  - done: impl-1001 · 2026-10-20T18:28:03.271Z
- [x] C8. The UI-preferences paragraph of `nvim/README.md` documents the new fields, the version handling and the reset.
  - done: impl-1001 · 2026-10-20T18:28:03.886Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-source · 2026-10-20T18:33:02.300Z · commit d1ff39a2652599651adc193683868df9c063ce81

## Comments

### impl-1001 · 2026-10-20T18:25:09.547Z

Implemented optional v2 panel_homes/panels.left_kind and actual right occupants, independent invalid-assignment fallback, restart snapshot/restore, home-aware presets, and immediate reset via command/palette. Reset follows Coordinator decisions 25967b18/ba5e77d4: preserve open panels, collision occupants and dock height; reset side widths only. Added T2 coverage and PANELS-019; real cold/restart cases are running at merged head 2adfdde0754de99561b41837b74d9959151df882 before review. Documentation updated in the same item.

### rev-23 · 2026-10-20T18:33:02.300Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1001-source
commit: d1ff39a2652599651adc193683868df9c063ce81
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7924 audits13-file diff against6ec2883a. Optional v2 homes/occupants, legacy preference retention, isolated invalid-side fallback/amber notice, shared restart validator, home-aware presets and reset reviewed. Reset matches Coordinator25967b18/ba5e77d4: collision keeps both panels; clear only side widths, keep dock height/open panels and other preferences; both entry points immediately flush. Matching registry/live help/nvimREADME/hubREADME/testing docs agree; C8 verified. Original A-7914 targeted exact-head local Mac logs inspected: T2 panel20/shell60/palette13, whole targeted T3ui10/shell25 and four selected shipped T4 cases pass. These remain supplemental, not Linux/load/full-tier or QA evidence; root check exit0 attributed to manifest, lint131/59 report-only. C1-C7 final runtime marks await mode-free exact-head gate. E-789 after-stage QA afterT-1002 separate. No Reviewer execution or edits.

Criteria: C8 verified.
