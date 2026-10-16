---
id: Q-596
kind: question
title: The onboarding skill, tried on an empty project and on an existing one
state: open
labels:
  - wayfinder:prototype
assignee: null
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.521Z
updated: 2026-10-16T11:26:11.521Z
---

## Question

What is the Aide's onboarding conversation? Write the `onboarding` skill on prototype/onboarding: the two scenarios (an empty project: the human's role and what they decide, Wayfinder for what to build, the first items; an existing project: the study of structure, stack, tests, docs and history, the tracker found and the open GitHub issues imported with `cland task import-github` on confirmation, what was done and what comes next) and the common tail (the rules from the human's answers, the stack, the crew proposal recorded with `cland crew set`, the ladder, the "Welcome aboard" artifact in General, when to start the Coordinator). Prepare two sandboxes outside this repository: an empty folder and a clone of a small public TypeScript project with open issues, both initialised with the prototype's skills, with a one-line "how to try" for each. The human tries both live and reacts; the accepted wording and the resulting items, rules, crew.toml and welcome artifact feed the spec.
