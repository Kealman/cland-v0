---
id: T-1199
kind: task
title: Split docs/agents/tests.md into one file per test file under docs/agents/tests/ with an index
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:46:04.520Z
updated: 2026-10-24T06:46:53.686Z
---

## Summary

123 of 166 v0.2 landings edited docs/agents/tests.md (2,929 lines); parallel lanes conflicted on adjacent paragraphs and cost extra review and verify rounds (E-419 stage 2). Absorbs T-1070. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. Every paragraph moves to the file named after its test file with an index listing them, and two branches that each document a different test merge without conflict in a scratch merge (test).
- [ ] C2. Palette help expectations are split per area, so area items do not share one list (test).
