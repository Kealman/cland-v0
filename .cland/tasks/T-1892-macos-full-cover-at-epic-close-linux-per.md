---
id: T-1892
kind: task
title: macOS full cover at epic close; Linux per stage
state: open
status: backlog
size: M
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:29:45.299Z
updated: 2026-11-16T07:29:45.299Z
---

## Summary

After-stage gates require Mac plus sharded Linux at one tree (T-469; `docs/hub/running.md:198`). Make after-stage gates Linux-only, plus an optional macOS targeted run, and require the macOS full cover at the epic DoD gate. Merges impl #4 and §7 #1 options 1–2. The macOS workers-1 default is already in config (`verification.workers = 1`).

Kind: product. Triage ticket H-4 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes T-469 (2026-10-16) stage-gate contract. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. An after-stage gate closes on a green sharded Linux cover and, when the plan names one, a green macOS targeted run (test).
- [ ] C2. The epic DoD gate still requires a green macOS full cover at the DoD tree (test).
- [ ] C3. running.md and the plan-epic and qa skills state the new gate (docs check).

## Dependencies

none; tracker `#stageCover`/`#stageCurrent`
