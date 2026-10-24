---
id: T-1204
kind: task
title: T0 guard against literal live item ids in copied-tracker tests; byte budgets also run on the copy
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:46:05.203Z
updated: 2026-10-24T06:46:05.203Z
---

## Summary

Tests over the copied live tracker that assert literal live ids break as the tracker grows; byte budgets measured only on synthetic fixtures. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. A copied-tracker test that asserts a literal E- or T- id fails T0, naming the file and line, shown with a planted test (test).
- [ ] C2. Payload byte-budget tests run against the copied live tracker as well as the synthetic fixture (test).
