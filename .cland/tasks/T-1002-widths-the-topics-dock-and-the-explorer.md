---
id: T-1002
kind: task
title: Widths, the topics dock and the explorer card work with any panel on either side
state: open
status: review
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by:
  - T-999
  - T-1001
topic: topic-766
branch: t/T-1002-widths-the-topics-dock-and-the-explorer
created: 2026-10-20T16:57:50.804Z
updated: 2026-10-20T19:08:26.335Z
---

## Summary

Manual widths, the dock height, the topics dock, the presets and the explorer's narrow-centre card all stop assuming Items on the left. A human resize is remembered per side and survives moving a panel, switching views and a restart.

## What to build

With Items on the right and the Inbox on the left, the human drags the Items panel wider. The width belongs to the side, as today's `sizes.left` and `sizes.right` do, so it stays through view switches, presets and a restart, and stays when a different panel takes that side (Coordinator decision, 2026-10-20). `␣T` keeps stacking Topics above the right side, whatever panel is on the right, and never shows Topics twice (Coordinator decision, 2026-10-20). In the explorer, a narrow centre still lets the card take the right side's place whatever panel is there, and the panel returns when there is room. The charting, watch and steady presets keep the human's sides: they open Items wherever it lives and do not reset the sides.

## Acceptance criteria

- [x] C1. A manual width is remembered per side and survives moving a panel across, a view switch and a preset, proved by a T2 stub-hub test.
  - done: impl-1002 · 2026-10-20T19:06:30.501Z
- [x] C2. `␣T` stacks Topics above the right side with the Inbox on the left and Sessions on the right, never shows Topics twice, and keeps its manual height, proved by a T2 test.
  - done: impl-1002 · 2026-10-20T19:06:30.517Z
- [x] C3. In the explorer, a narrow centre lets the card take the right side's place whatever panel is there, and the panel returns on widening without changing the saved sides, proved by a T2 explorer component test.
  - done: impl-1002 · 2026-10-20T19:06:30.534Z
- [x] C4. The charting, watch and steady presets open their panels on the human's sides with Items on the right and leave the sides unchanged, proved by a T2 test.
  - done: impl-1002 · 2026-10-20T19:06:30.549Z
- [x] C5. The shipped PANELS-005 and PANELS-006 pass unchanged, and a new PANELS-020 repeats PANELS-005's manual-size checks with Items on the right and Sessions on the left.
  - done: impl-1002 · 2026-10-20T19:06:30.567Z
- [x] C6. The resize and cold-restart cases of `ui.test.ts` pass as a targeted local run of that T3 file on the branch.
  - done: impl-1002 · 2026-10-20T19:06:30.583Z
- [x] C7. The sizes paragraph of `nvim/README.md` states the per-side width rule for panels on either side.
  - done: impl-1002 · 2026-10-20T19:06:30.599Z
  - verified: rev-23 [reviewer] · run rev-20261020-1002-source · 2026-10-20T19:08:26.335Z · commit 9ffe138afe31ccc6dab323070b9a0af809c58ace

## Comments

### impl-1002 · 2026-10-20T19:02:20.444Z

Acceptance implementation uses existing side-neutral runtime from T-999/1000/1001: added T2 per-side manual width moves/views/presets/reload, dock ordering/uniqueness/height, and all-four-panel explorer replacement/restoration checks. Extended existing cold-start test with width persistence assertions. Added PANELS-020 at the end of shipped catalogue, leaving PANELS-005/006 untouched. Docs state widths belong to physical sides. Preparing full required local targeted runs and recorder refresh before source review; E-789 after-stage QA stays deferred.

### rev-23 · 2026-10-20T19:08:26.335Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1002-source
commit: 9ffe138afe31ccc6dab323070b9a0af809c58ace
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7971 audits8-file acceptance/docs diff againstc9ee75f0. Existing side-neutral runtime checked: widths remain physical-side preferences, dock retains right geometry/uniqueness/height, explorer restores any saved right occupant. Three newT2 cases cover moves/views/all presets/reload, actual dock geometry and all four explorer right occupants; cold T3 case retains widths and swapped homes. PANELS020 repeats manual-size walk; PANELS005/006 byte-unchanged. Matching nvim/hub/testing docs verifyC7. A-7968 local original107 targeted passes inspected (T2 42,T4file30,T3ui10/shell25), explicitly working contents later committed, not final-SHA runtime receipts. Final committed-head checkexit0, lint131/0refusals report-only. Recorder251<253 failure retained, separate successful5448frame refresh leaves catalogue/slice byte-identical. No Linux/load/suite/QA claim. C1-C6 final marks await mode-free exact-head gate; fullE-789 after-stageQA separate. No Reviewer execution/edits.

Criteria: C7 verified.
