---
id: T-1201
kind: task
title: cland qa lint checks named test files, tests and selectors at the build and flags literal counts
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:46:04.795Z
updated: 2026-10-24T06:46:04.795Z
---

## Summary

QA briefs written before an item's code existed carried guessed test names and literal counts that drifted with landings (E-419 stage briefs, inbox.test.ts 22→23). Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. qa lint fails a brief that names a test file or test title absent at the build SHA, or a selector absent from web/src (test).
- [ ] C2. qa lint flags literal test, member and item counts and points to task plan show or the generated cases instead (test).
