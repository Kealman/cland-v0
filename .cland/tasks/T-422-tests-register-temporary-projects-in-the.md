---
id: T-422
kind: task
title: Tests register temporary projects in the real host executor ledger
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-936
branch: t/T-422-tests-register-temporary-projects-in-the
created: 2026-10-14T16:43:00.822Z
updated: 2026-10-24T07:54:09.219Z
---

## Summary

The host-wide executor ledger `~/.cland/executor/spend.json` lists 24 projects. Most are temporary test projects (`$TMPDIR/cland-proj-*`, `cland-t347-real-*`, `/private/tmp/q384-*`), and one entry is `/`. Every sweep reads leases from every listed project (`hostLeases`, `hub/src/executor/droplet/spend.ts:62`). So tests leak into the human's real ledger, and the list only grows. This was read on 2026-10-14 16:42Z while answering E-271 QA.

## What to fix

- Tests that touch the executor point the ledger at a scratch path, never the real `~/.cland`.
- `rememberProject` refuses `/` and other non-project roots.
- The sweep drops a registered project whose directory no longer exists, after a grace period, instead of reading it forever.

## Acceptance criteria

- [x] C1. A full suite run leaves `~/.cland/executor/spend.json` `projects` unchanged.
  - done: impl-422 · 2026-10-24T07:53:42.777Z
- [x] C2. `rememberProject('/')` is refused, and the ledger never lists `/`.
  - done: impl-422 · 2026-10-24T07:53:42.861Z
- [x] C3. A registered project whose directory is gone is pruned from `projects` by the sweep, with an event naming it.
  - done: impl-422 · 2026-10-24T07:53:42.964Z

## Comments

### impl-422 · 2026-10-24T07:45:54.788Z

TDD receipts on local macOS working tree: C2 failed accepting `/`, then passed with pre-write validation. C3 failed retaining missing project after 24h, then passed with persisted grace/reset, write-through prune event, accounting preserved. C1 suiteUnit partial options.env reproduced writes to both primary and legacy ledgers under a hostile scratch HOME; sealed env layered after options fixes it. projectHub hostile scratch HOME/XDG/override snapshot also passes. No real HOME state modified.
