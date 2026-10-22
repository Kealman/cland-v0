---
id: T-1095
kind: task
title: The Items help dialog's last rows stay below the window after T-1074's keys
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by: []
regression_of: T-1074
topic: topic-838
branch: t/T-1095-the-items-help-dialog-s-last-rows-stay
created: 2026-10-22T06:41:51.812Z
updated: 2026-10-22T06:42:31.048Z
---

## Summary

E-416 stage "views and messages" QA run qa-s2-2026-10-22-1 (dev 918951c2, real Chrome, cland QA profile, existing window size) found that the Items help dialog's last two rows ("Show archived roots / A" and "Enter card or return to tree / Enter") stay below the visible window after PageDown, End and native scrolling; captures end at "Hide done items / D", and clicking the last row fails as offscreen. All 32 labels are in the accessibility tree. web/src/Palette.module.css gives `.dialog` a 12vh top margin and `.results` a bounded height, but the help list `.keys` has no bound, so T-1074's ten new rows push the dialog past the viewport.

## Acceptance criteria

- [ ] C1. In a Headless Shell window of 1280×720 and of 1024×600, every row of the Items help dialog can be brought into view by keyboard scrolling (PageDown/End) and the last row is visible after End; the dialog itself stays inside the viewport (Web test).
- [ ] C2. Styling stays in CSS Modules with tokens only, and the typecheck colour and contrast guard passes (typecheck).
