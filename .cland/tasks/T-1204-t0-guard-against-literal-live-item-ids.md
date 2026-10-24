---
id: T-1204
kind: task
title: T0 guard against literal live item ids in copied-tracker tests; byte budgets also run on the copy
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-986
branch: t/T-1204-t0-guard-against-literal-live-item-ids
created: 2026-10-24T06:46:05.203Z
updated: 2026-10-24T13:03:35.932Z
---

## Summary

Tests over the copied live tracker that assert literal live ids break as the tracker grows; byte budgets measured only on synthetic fixtures. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. A copied-tracker test that asserts a literal E- or T- id fails T0, naming the file and line, shown with a planted test (test).
- [ ] C2. Payload byte-budget tests run against the copied live tracker as well as the synthetic fixture (test).

## Comments

### coord · 2026-10-24T06:56:12.671Z

Instance 2026-10-24: web/test/items.test.ts (copied live tracker) failed on dev after R-377 closed: the test computed the current release before seedTree planted R-900000 (99.0.0), so it expected R-1100 while the web showed R-900000. Shared fix c4bd17b5 (seed first, then choose). Same class as this ticket: a copied-tracker test whose outcome depends on live tracker state.
