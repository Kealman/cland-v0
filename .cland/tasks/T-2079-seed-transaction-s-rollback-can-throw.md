---
id: T-2079
kind: task
title: seed-transaction's rollback can throw and replace the original seed failure
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by:
  - T-1995
topic: null
branch: null
created: 2026-11-24T09:50:39.750Z
updated: 2026-11-24T09:50:47.609Z
---

## Summary

Found by T-1995's reviewer at 00c594e49 and reported by impl-1995 (static finding, no failing run). In hub/test/seed-transaction.ts, lines 18 to 20, the catch block runs `exec('rollback')` when `connection.isTransaction` is set, then rethrows. If the rollback throws, its error replaces the seed failure the caller needs to see. This is the same shape T-1995 fixes for `openDatabase`'s cleanup close.

## What to build

Keep the seed error as the outcome. A failing rollback is attached as a secondary diagnostic, using the shared cleanup-diagnostic helper that T-1995 adds, and never replaces the seed error (rule 39).

## Acceptance criteria

- [ ] C1. When `seed()` rejects and the rollback also throws, the helper rejects with the seed error, with the rollback error recorded as secondary. The test uses an injected connection and fails on the current code.
