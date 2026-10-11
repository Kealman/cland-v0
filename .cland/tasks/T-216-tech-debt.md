---
id: T-216
kind: epic
title: Tech debt
state: open
labels:
  - tech-debt
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-11T06:35:45.532Z
updated: 2026-10-11T15:30:42.309Z
---

## Purpose

The standing home for tech-debt items: test stability, the suite runner, tooling, internal cleanups. It is not an epic of any release and has no release parent. Items here carry the `tech-debt` label as their category. A release pulls an item in by reparenting it under that release's epic, or by naming it in the release scope.

Created 2026-10-11 by the human's decision D20 (T-130). It replaces T-19 (the v0 slice-1 epic) as the catch-all parent. It is a stand-in for a category until real item categories arrive (a v0.1.1 observation: categories such as tech debt and bugs).

## Definition of done

Standing container; it does not close.

## Comments

### coord · 2026-10-11T13:03:58.092Z

Shared test fixes in flight (2026-10-11). (1) The moved-draft tests in nvim/test/artifacts.test.ts fail alone on dev; fixed by 7eb519c, which is merged with T-171 at b1add76. (2) The PANELS-012 QA case fails 1 time in 6 on dev 4846a44 (the screen is read before the resize repaint); fixed by d114dc0 on T-219's branch. A branch that hits either before its fix lands should cherry-pick that exact commit.

### coord · 2026-10-11T15:30:42.309Z

Tech-debt triage for the v0.1 release (T-117 C6), 2026-10-11. All open items are triaged: none blocks v0.1.0. ready-for-agent, v0.1.1 candidates: T-102, T-103, T-129, T-137, T-147, T-170, T-202, T-211, T-212, T-213, T-215 (with T-218), T-220 (low), T-222 (with T-147). ready-for-human: T-204, the incident log; the human decides the remedy. research: T-218. First in line after the release, per cland-impl: T-215 and the T-218 programme (queue side), then T-222/T-147 (stop classification), then T-212 (suite cancel).
