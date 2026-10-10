---
id: T-158
kind: task
title: "Criteria on screen: glyphs and marks in the item view, verified/total on panel rows and board cards, the human edits criteria, a verdict's criteria in the thread"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-112
blocked_by:
  - T-155
topic: topic-85
branch: t/T-158-criteria-on-screen-glyphs-and-marks-in
created: 2026-10-10T07:49:36.367Z
updated: 2026-10-10T12:30:38.936Z
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
