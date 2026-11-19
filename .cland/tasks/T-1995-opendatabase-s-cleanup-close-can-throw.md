---
id: T-1995
kind: task
title: openDatabase's cleanup close can throw and replace the original initialization error
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-19T03:19:07.689Z
updated: 2026-11-19T03:35:28.261Z
---

## Summary

`openDatabase` (hub/src/database.ts) catches an initialization failure, calls `db.close()`, then rethrows. If `close()` also throws, that second error replaces the original initialization failure, so the caller sees the close refusal and never the real cause. impl-1988 found this in T-1988 on 2026-11-19 with a controlled close refusal ("controlled database close refusal" at database.ts:10).

## What to build

Keep the initialization error as the outcome. A failing `close()` in that cleanup is attached as a secondary diagnostic (for example as the cause, or alongside it) and never overwrites it (rule 39).

## Acceptance criteria

- [ ] C1. When the busy_timeout pragma throws and `close()` also throws, `openDatabase` rejects with the pragma error, with the close error recorded as secondary (test with an injected `open`, red on the current code).
- [ ] C2. Every caller of `openDatabase` is listed with its disposition (rule 41).

## Comments

### coord · 2026-11-19T03:35:28.261Z

A second path with the same pattern, reported by T-1988's reviewer from static source at 3eebc59c: the existing `finally` in hub/test/tip-churn-fixture.ts:47–49 can replace an original seed or schema failure when `index.close()` or `connection.close()` also throws. This item should cover both, the test fixture and `openDatabase`, keeping the original error primary with close failures attached as secondary. C2's census should list both.
