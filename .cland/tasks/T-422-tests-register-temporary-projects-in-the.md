---
id: T-422
kind: task
title: Tests register temporary projects in the real host executor ledger
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-936
branch: t/T-422-tests-register-temporary-projects-in-the
created: 2026-10-14T16:43:00.822Z
updated: 2026-10-24T07:38:04.886Z
---

## Summary

The host-wide executor ledger `~/.cland/executor/spend.json` lists 24 projects. Most are temporary test projects (`$TMPDIR/cland-proj-*`, `cland-t347-real-*`, `/private/tmp/q384-*`), and one entry is `/`. Every sweep reads leases from every listed project (`hostLeases`, `hub/src/executor/droplet/spend.ts:62`). So tests leak into the human's real ledger, and the list only grows. This was read on 2026-10-14 16:42Z while answering E-271 QA.

## What to fix

- Tests that touch the executor point the ledger at a scratch path, never the real `~/.cland`.
- `rememberProject` refuses `/` and other non-project roots.
- The sweep drops a registered project whose directory no longer exists, after a grace period, instead of reading it forever.

## Acceptance criteria

- [ ] C1. A full suite run leaves `~/.cland/executor/spend.json` `projects` unchanged.
- [ ] C2. `rememberProject('/')` is refused, and the ledger never lists `/`.
- [ ] C3. A registered project whose directory is gone is pruned from `projects` by the sweep, with an event naming it.
