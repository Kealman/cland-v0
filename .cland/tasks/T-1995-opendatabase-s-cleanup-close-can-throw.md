---
id: T-1995
kind: task
title: openDatabase's cleanup close can throw and replace the original initialization error
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1726
branch: t/T-1995-opendatabase-s-cleanup-close-can-throw
created: 2026-11-19T03:19:07.689Z
updated: 2026-11-24T09:03:03.864Z
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

### coord · 2026-11-19T21:03:15.407Z

Reproduction from T-2015 (impl-2015, 2026-11-19 21:03Z): a test that makes every `db.exec` throw hits the initial PRAGMA setup in `openDatabase`. The original error is replaced by the cleanup close: the literal caught error was `Error: injected close refusal` at hub/src/database.ts:10, instead of `injected constructor rejection`. T-2015 narrowed its own control to the tracker_items schema, so this item still owns the `openDatabase` fix.

### coord · 2026-11-24T07:23:53.250Z

Reproduced again by impl-2069 during T-2069's M1 fault control on 2026-11-24. A planted constructor rejection was expected; the actual error was "Error: planted native close rejection at database.ts:10". The close error still replaces the initialization error.
