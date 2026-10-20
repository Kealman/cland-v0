---
id: T-1002
kind: task
title: Widths, the topics dock and the explorer card work with any panel on either side
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by:
  - T-999
  - T-1001
topic: null
branch: null
created: 2026-10-20T16:57:50.804Z
updated: 2026-10-20T16:58:47.508Z
---

## Summary

Manual widths, the dock height, the topics dock, the presets and the explorer's narrow-centre card all stop assuming Items on the left. A human resize is remembered per side and survives moving a panel, switching views and a restart.

## What to build

With Items on the right and the Inbox on the left, the human drags the Items panel wider. The width belongs to the side, as today's `sizes.left` and `sizes.right` do, so it stays through view switches, presets and a restart, and stays when a different panel takes that side (Coordinator decision, 2026-10-20). `␣T` keeps stacking Topics above the right side, whatever panel is on the right, and never shows Topics twice (Coordinator decision, 2026-10-20). In the explorer, a narrow centre still lets the card take the right side's place whatever panel is there, and the panel returns when there is room. The charting, watch and steady presets keep the human's sides: they open Items wherever it lives and do not reset the sides.

## Acceptance criteria

- [ ] C1. A manual width is remembered per side and survives moving a panel across, a view switch and a preset, proved by a T2 stub-hub test.
- [ ] C2. `␣T` stacks Topics above the right side with the Inbox on the left and Sessions on the right, never shows Topics twice, and keeps its manual height, proved by a T2 test.
- [ ] C3. In the explorer, a narrow centre lets the card take the right side's place whatever panel is there, and the panel returns on widening without changing the saved sides, proved by a T2 explorer component test.
- [ ] C4. The charting, watch and steady presets open their panels on the human's sides with Items on the right and leave the sides unchanged, proved by a T2 test.
- [ ] C5. The shipped PANELS-005 and PANELS-006 pass unchanged, and a new PANELS-020 repeats PANELS-005's manual-size checks with Items on the right and Sessions on the left.
- [ ] C6. The resize and cold-restart cases of `ui.test.ts` pass as a targeted local run of that T3 file on the branch.
- [ ] C7. The sizes paragraph of `nvim/README.md` states the per-side width rule for panels on either side.
