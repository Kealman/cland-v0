---
id: T-858
kind: task
title: The tour's stage on the life of a task names the project's own checks, and every key the tour names is a workbench key
state: open
status: backlog
size: XS
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-857
topic: null
branch: null
created: 2026-10-19T08:10:03.111Z
updated: 2026-10-19T08:10:03.111Z
---

## Summary

TOUR.md is the accepted wording, but stage 5 says verify runs "`npm run typecheck`, then `npm test`". After E-614 it runs the project's `[verification]` check and test. The tour's eight stages, "look now" lines and language rule otherwise stay as accepted.

## What to build

- **TOUR.md stage 5.** "cland verify runs the project's own checks, the check and test commands recorded with the stack, and posts the result there."
- **The merge sentence** changes only if the Coordinator decides that a new project's merge goes through the hub's queue (open question 6).
- **The keys.** Check each key the tour names (space then i, e, g, t, n, s, a, R, l, ?, space; Ctrl with h/j/k/l; Ctrl and \; g then a) against the Neovim workbench's keymaps at the head. Correct any that changed since 0ff421f8.
- **SKILL.md §8 and "How to talk"** keep the language rule unchanged: the tour is in the human's language, while rules, items and briefs stay in English.

## Acceptance criteria

- [ ] C1. TOUR.md stage 5 names the project's recorded check and test commands and no npm script (source review, and N3's T1 assertion still passes).
- [ ] C2. Each workbench key TOUR.md names is bound in the Neovim workbench at the branch head (source review against the keymap source, listed in the review).
- [ ] C3. TOUR.md keeps eight stages, each ending with a "Look now" line, and SKILL.md keeps the tour and welcome note in the human's language and rules, items and briefs in English (T1 assertion on the stage count and "Look now" lines; source review).
