---
id: Q-596
kind: question
title: The onboarding skill, tried on an empty project and on an existing one
state: closed
labels:
  - wayfinder:prototype
assignee: null
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.521Z
updated: 2026-10-16T15:00:42.234Z
closed: 2026-10-16T15:00:42.234Z
---

## Question

What is the Aide's onboarding conversation? Write the `onboarding` skill on prototype/onboarding: the two scenarios (an empty project: the human's role and what they decide, Wayfinder for what to build, the first items; an existing project: the study of structure, stack, tests, docs and history, the tracker found and the open GitHub issues imported with `cland task import-github` on confirmation, what was done and what comes next) and the common tail (the rules from the human's answers, the stack, the crew proposal recorded with `cland crew set`, the ladder, the "Welcome aboard" artifact in General, when to start the Coordinator). Prepare two sandboxes outside this repository: an empty folder and a clone of a small public TypeScript project with open issues, both initialised with the prototype's skills, with a one-line "how to try" for each. The human tries both live and reacts; the accepted wording and the resulting items, rules, crew.toml and welcome artifact feed the spec.

## Comments

### human · 2026-10-16T15:00:42.140Z

## Resolution

Accepted by the human on 2026-10-16 after the second live run in sandbox-empty ("Вроде все хорошо прошло, принимаем"); transcript kept at /Users/evgeniyivanov/Projects/cland/sandbox-empty/onboarding.txt (the first run: sandbox-empty-try1-onboarding.txt). The skill is `.agents/skills/onboarding/` (SKILL.md, EMPTY.md, EXISTING.md, WELCOME.md, TOUR.md) on prototype/onboarding at 0ff421f8, also on prototype/setup.

The accepted flow, as run: a silent setup check; the Aide introduces itself in one paragraph and speaks the human's language while rules, items and briefs stay in English; round 1 the human's role; round 2 the rules (three recorded: what to build and releases are the human's; the crew decides the stack, architecture, tests and implementation and explains notable choices in the item's topic; "Decisions, not keystrokes": sessions run commands for the human); what to build with a recommendation (Conway's Life in the terminal); the first release R-1 with five tasks in order, sizes, blockers and acceptance criteria, set to planned and shown in the items panel (no map: no fog); the stack as rule 4 with its check commands; the four categories; the crew: one line per role, then the table (harness, model, count, how it works), the human's changes applied by direct edits to roles.toml (bgIsolation none), permissions = "skip" for the Claude Code roles accepted; a short welcome note A-1 in General; "Ready to start?" with the Coordinator's brief ("Commit what cland init and the onboarding wrote, on dev, and run cland push; then work release R-1"; the human skipped the launch for the trial); the tour on request: eight stages (the workbench; items, the explorer and the card; topics, General, the inbox and asks; sessions, roles and the crew; the life of a task; artifacts; the rulebook; how the crew grows), one per round, each ending with "look now" items; the closing state summary.

Observed for the spec and the cut: the Aide still cannot launch the Coordinator or import issues (hub permissions, Q-600 q14, q1); verify assumes npm scripts (the Aide planned a `pretypecheck` running `npm ci` to fit it; Q-600 q11); finding a harness's model id took several probes (OpenCode `models` printed nothing; a `cland models <harness>` listing would serve the crew step); Claude Code's auto mode refused the Aide's own `cland role list` after it set skip for its role ("self-modification"); the welcome note and the tour texts are the accepted wording for the spec.
