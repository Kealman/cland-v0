---
id: T-995
kind: task
title: The split main area and the drawer
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-994
topic: topic-800
branch: t/T-995-the-split-main-area-and-the-drawer
created: 2026-10-20T16:51:40.862Z
updated: 2026-10-21T13:15:34.464Z
closed: 2026-10-21T13:15:34.464Z
---

## Summary

⌘\ splits the main area into two panes that swap and close, with a draggable divider at 2:1. The drawer shows the selected row's card or thread with Split and Close, and stays closed when nothing is selected and while split.

## What to build

- **The split.** ⌘\ splits the main area, ⌘Enter on a row opens it in the other pane, and each pane has Swap and Close. The divider drags and starts at 2:1. The rail collapses while split and returns to the human's choice afterwards.
- **The drawer.** It opens on the selected row with Split and Close. It stays closed when nothing is selected and while split, and once closed by hand it stays closed until the selection moves.
- **Esc** closes the drawer and never answers anything.
- **Rows.** The areas have no content until E-416 to E-418, so each area shows a stand-in list of its objects (ids and titles from the hub's frames) that gives the split, the drawer and the folds something to act on; E-416 to E-418 replace them (Coordinator decision).

## Acceptance criteria

- [x] C1. ⌘\ splits the main area into two panes at 2:1, the divider drags, and each pane's Swap and Close work (browser test).
  - done: impl-995 · 2026-10-21T13:04:26.452Z
  - verified: rev-23 [reviewer] · run rev-20261021-995-final · 2026-10-21T13:10:55.974Z · commit 4dcefccdaa66634f39b13d68a331f7189b5541fd
- [x] C2. The rail collapses while the main area is split and returns to the human's choice when the split closes (browser test).
  - done: impl-995 · 2026-10-21T13:04:26.480Z
  - verified: rev-23 [reviewer] · run rev-20261021-995-final · 2026-10-21T13:10:55.974Z · commit 4dcefccdaa66634f39b13d68a331f7189b5541fd
- [x] C3. The drawer opens on a selected row with Split and Close, stays closed when nothing is selected and while split, and after Close stays closed until the selection moves (browser test).
  - done: impl-995 · 2026-10-21T13:04:26.505Z
  - verified: rev-23 [reviewer] · run rev-20261021-995-final · 2026-10-21T13:10:55.974Z · commit 4dcefccdaa66634f39b13d68a331f7189b5541fd
- [x] C4. ⌘Enter on a row opens it in the other pane (browser test).
  - done: impl-995 · 2026-10-21T13:04:26.534Z
  - verified: rev-23 [reviewer] · run rev-20261021-995-final · 2026-10-21T13:10:55.974Z · commit 4dcefccdaa66634f39b13d68a331f7189b5541fd
- [x] C5. Esc closes the drawer and sends no frame to the hub (browser test).
  - done: impl-995 · 2026-10-21T13:04:26.566Z
  - verified: rev-23 [reviewer] · run rev-20261021-995-final · 2026-10-21T13:10:55.974Z · commit 4dcefccdaa66634f39b13d68a331f7189b5541fd

## Comments

### impl-995 · 2026-10-21T13:01:51.543Z

Test-first at E-415's agreed Web seam. Red receipts: secondary pane timeout before implementation; selected T-4 row timeout before stand-in lists. Targeted macOS/arm64 Headless Shell shell.test.ts now passes 8 cases (9 node:test entries including parent); web typecheck/token/contrast/hooks checks pass. Split geometry/actions, rail choice restoration, drawer dismissal, physical-code command Enter and Esc outbound-frame audit implemented. Full mode-free local verification follows source review.

### rev-23 · 2026-10-21T13:09:00.638Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-995-source
commit: 4dcefccdaa66634f39b13d68a331f7189b5541fd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards0 / Spec0 findings. A-8398 audits seven-file change from fixed basea85ca526 against C1–C5/E-415/spec3.2. Local split state2:1/drag20–80%, shared Swap/Close/promoted survivor, saved rail restoration, per-selection drawer dismissal and opposite-pane detail agree with docs. Physical Meta+Backslash/Enter/Escape use sole shared listener; Escape only dismisses/focuses locally. Seven-area ID/title adapter is read-only and preserves existing connection/recovery/top-strip behavior. Existing owned browser seam retains final geometry/render/no-outbound assertions. A-8394 targeted results precede final polish and are supporting only. All C1–C5 remain execution-dependent. Submit exact-head normal mode-free launch-directed local verification including actual Web before final settlement. After-stage QA is separate. No Reviewer runtime/source edits.

### rev-23 · 2026-10-21T13:10:55.974Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-995-final
commit: 4dcefccdaa66634f39b13d68a331f7189b5541fd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head clear; no findings. A-8403 audits queued A-8402/run1e4d8d94 at unchanged source-reviewed4dcefccd: local Darwin arm64 check/typecheck/build+full T1+actual Web exit0,721 ordinary passing test entries/123 files. Web three files pass; C1/C2 split/drag/swap/both-close/rail-restoration case line4069 and C3/C4/C5 drawer/dismissal/physical Meta+Enter/Escape zero-frame case4081 pass, shell parent/file also pass. Existing connection/smoke/rail tests retained. Web-only T2 command selected no tests: no hub/Neovim T2 pass inferred. No load-gate finishes/Web repetitions claimed. Lint132/59,durations/ratchet report-only. No Linux browser/T3/T4/stage/after-stage QA/Reviewer runtime claim; E-415 QA separate. All C1–C5 verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-21T13:15:34.464Z

Merged 0080a0c7d7d393aeaac474decd34a020ab183fe9 onto dev.
