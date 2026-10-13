---
id: T-158
kind: task
title: "Criteria on screen: glyphs and marks in the item view, verified/total on
  panel rows and board cards, the human edits criteria, a verdict's criteria in
  the thread"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-112
blocked_by:
  - T-155
topic: topic-85
branch: t/T-158-criteria-on-screen-glyphs-and-marks-in
created: 2026-10-10T07:49:36.367Z
updated: 2026-10-10T13:55:04.579Z
---

## Parent

T-112 (Criteria that live), slice 5 of 5. Spec §3.4 (Display).

## What to build

Criteria on screen in Neovim. The item view lists the criteria with glyphs (○ open, ◐ done, ● verified, ✗ failed) and their marks. The items panel's rows and the board's cards show verified/total for tasks in work, replacing the checkbox count; the vertical board's fraction switches its source behind the one replaceable function T-146 left. The human can add, edit and remove criteria from the item view. A verdict's message in the thread shows the criteria it marked, as the thread mockup shows.

## Acceptance criteria

- [ ] The item view shows each criterion's glyph and marks, from `criteria` in the hub's view.
- [ ] Panel rows and board cards show verified/total for tasks in work; 4/4 reads green.
- [ ] The human adds, edits and removes a criterion from the item view through `task.criterion`.
- [ ] A verdict's message in the thread lists its marked criteria.
- [ ] A headless QA case covers the item view and a board row going 3/4 to 4/4; 80- and 120-column checks pass.
- [ ] `nvim/README.md` describes the glyphs and keys.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-155 (Marks the hub writes)

## Comments

### impl-158 · 2026-10-10T12:30:38.936Z

Implementation started on dev 95f88ee. Display uses hub criteria and task.criterion; tracing item, vboard, graph and verdict thread paths. Package suites paused at Coordinator request pending T-175; targeted tests and typecheck permitted.

### impl-158 · 2026-10-10T12:42:25.050Z

Implemented and pushed 86b14ad40b38298344423989ddec19a4328128e4, rebased onto dev 70bb169 after T-175. Evidence artifact A-608 at .cland/artifacts/A-608-t-158-implementation-and-validation.md. Typecheck and targeted criteria/vboard/graph/items/palette tests plus headless ITEMS-002/PANELS-013 pass. Package test:nvim queued now on the fixed runner. Criterion marks are deferred until the Coordinator restarts the live hub, which predates task.criterion.

### rev-8 · 2026-10-10T12:45:23.805Z

verdict: review
result: not clear
by: rev-8 [reviewer]
run: rev-8-20261010-158-1
commit: 86b14ad40b38298344423989ddec19a4328128e4

Medium — nvim/lua/cland/item_view.lua:220: criterion text uses wrap() whose long-word split counts characters instead of display cells; 100 consecutive 界 characters produce rows of 151 cells at width79 and 146 at width119, breaching the 80/120 fit requirement and distorting the fields layout. Text and mark labels need cell-aware splitting.

Low — nvim/lua/cland/item_view.lua:251: each Acceptance criteria heading renders the full structured array, so two parser-valid sections display C1/C2 twice; render the list once.

Low, Standards heuristic — nvim/lua/cland/criteria.lua:25: first-touch ID allocation duplicates tracker.ts:1303, coupling legacy action targeting to two synchronized policies; current behavior matches, maintenance note only.

Standards: 1 low heuristic, no hard violations. Spec: 1 medium and 1 low. Ordinary glyphs/marks, shared verified fractions, actions and structured T-156 report contract checked with native read-only probes. No edits or suites; final-head test:nvim result pending. Evidence A-612: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-612-t-158-review-86b14ad-unicode-criteria-overflow.md.

### impl-158 · 2026-10-10T12:47:58.943Z

Review fix pushed: 1719d9336f0db7178f8f78b4dbe991f5fa7cc226. A-612 medium fixed with shared display-cell fitter; repeated acceptance headings now render the list once. Wide CJK and combining-character criterion text and failure notes fit 80/120 layouts and preserve every codepoint. Typecheck passes; criteria.test.ts 4/4 pass. Restarting the previously queued package suite on this head.

### impl-158 · 2026-10-10T12:49:51.328Z

Rebased fixes onto dev 8253474 (T-163/T-168): final pushed head 716a2f6300bc576a2083bc056693ca65e1009e05. Preserved all graph README sections and QA cases. Unicode regression now uses full-width 80/120 windows (compose79/119) and checks wrapped continuation criterion targets. Post-rebase typecheck, criteria 4/4, graph 10/10 and headless GRAPH-001/ITEMS-002/PANELS-015/016 4/4 pass. Full test:nvim starts on this head.

### rev-8 · 2026-10-10T12:51:55.934Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-158-2
commit: 716a2f6300bc576a2083bc056693ca65e1009e05

Low, Standards heuristic — nvim/lua/cland/criteria.lua:25: legacy mutation refs still repeat the hub’s first-touch allocation policy; current behavior matches, nonblocking maintenance note.

No high or medium findings remain. Standards clear (one low heuristic); Spec clear (zero findings). Both A-612 display findings are resolved. Pinned native probes fit compose79/119, preserve all200 CJK/320 combining marks, render the list once and retain continuation targets. Range-diff preserves T-163 README/GRAPH-001 and PANELS-015/016; prior full-item checks carry. Final-head test:nvim is running, separate from this read-only review. Evidence A-616: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-616-t-158-re-review-716a2f6-display-fixes-and-rebase-clear.md.

### coord · 2026-10-10T13:55:04.579Z

Merged 377370dd5e07b4b8ace6d7cce70b200258e2a816 onto dev.
