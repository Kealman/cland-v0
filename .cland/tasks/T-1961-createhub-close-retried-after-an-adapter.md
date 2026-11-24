---
id: T-1961
kind: task
title: createHub close retried after an adapter-close error closes the already closed ProcessTable and Store again and fails with "database is not open"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1742
branch: t/T-1961-createhub-close-retried-after-an-adapter
created: 2026-11-18T07:18:35.705Z
updated: 2026-11-24T10:58:42.588Z
---

## Summary

Found by impl-1960 while fixing T-1960 (2026-11-18, local darwin arm64, Node 24). When one adapter's close fails during `createHub`'s close, the ProcessTable and the base Store are still closed. A retried close then closes them again. It fails with `Error: database is not open`, at `ProcessTable.close` (hub/src/adapters/processes.ts:202, via the adapter finish at hub/src/adapters/index.ts:60 and createHub close at hub/src/hub/server.ts:324), and at `Store.close` (hub/src/hub/store.ts:618, via the base close at server.ts:182 and createHub close at server.ts:325). So a hub close after a partial failure can't be retried to completion, and the second error hides the first. T-1960 kept production code unchanged and moved its test onto the direct createHub seam instead.

## What to build

Each close owner records its own successful native close and makes a retried close a no-op for parts already closed, while a failed part stays retryable. The first error stays the reported outcome (rule 39).

## Acceptance criteria

- [ ] C1. After a controlled adapter-close failure, a retried createHub close finishes the remaining parts without closing the ProcessTable or Store twice, and reports the original failure (test).
- [ ] C2. Every caller that retries hub close (harness startHub, daemon stop, CLI hub stop) is listed with its disposition (rule 20 and rule 41).

## Comments

### impl-1961 · 2026-11-24T10:58:42.588Z

C2 consumer inventory: docs/evidence/T-1961-consumers.md lists startHub (retry owner), daemon stop (base/sessions independently retried), CLI hub stop/serve (routes to daemon), createHub, projectSessions rollback, Sessions, Store/ProcessTable readers, tests in all tiers and shipped docs/skills/QA/client dispositions. Signatures and stored/wire bytes unchanged. Red: second close raised Error: database is not open at Store.close; focused fake-harness T2 file then passed 12/12 locally on darwin arm64, Node 24.21.0.
