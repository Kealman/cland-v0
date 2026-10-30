---
id: T-1476
kind: task
title: The hub loads only active suite jobs and summaries at startup
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:54:04.502Z
updated: 2026-10-30T07:54:17.435Z
---

## Summary

At startup the hub reads every archived suite job from hub.db (3,308 rows, 885 MB on this project) and JSON-parses and keeps them all, about 2.5–2.7 GiB of startup heap (A-14160, `Store.suiteJobHistory` store.ts:739, Suites constructor suites.ts:252–257). Load only active and recoverable jobs plus indexed summaries at startup, read an archived job in full only by id, and stop retaining the original JSON strings.

## Acceptance criteria

- [ ] C1. Hub startup reads only active or recoverable suite jobs in full, and bounded summary rows for finished ones. A finished job's full record is read by id on demand, and every existing consumer of suite history (selection, durations, culprit search, reports, `verify queue`, web and Neovim views) is listed in the item and migrated or shown unaffected (rule 20).
- [ ] C2. The decoded jobs no longer retain their source JSON strings alongside the parsed objects.
- [ ] C3. On a T-1467-style scratch copy of this project, the startup heap after the suite-history stage drops by at least 2 GiB against A-14160's 3,567 MiB checkpoint, with the same probe and machine, and the per-stage table is published.
- [ ] C4. A test with a synthetic history of at least 3,000 large finished jobs asserts a bounded number of rows and bytes read at startup (a work-count guard, rule 23).
