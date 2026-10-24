---
id: T-538
kind: task
title: Tracker index hydrate re-queries the row's own kind to canonicalize an id it already has
state: open
status: planned
size: S
labels:
  - hub
  - tech-debt
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: null
branch: null
created: 2026-10-15T21:15:50.790Z
updated: 2026-10-24T06:46:56.006Z
---

## Summary
Found aside by impl-469 on T-469 (2026-10-15 21:15Z). In `hub/src/tracker/index-db.ts:423`, `#hydrate` receives the selected row's kind and n, yet canonicalizes the row's own id with another `select kind … where n` query. In one landing, the stage-budget trace counted 2,992 kind lookups and 1,848 hydrated label and blocker rows. Deriving the row's own canonical id from its existing columns removes those queries. Lookups for referenced ids stay as they are.

## Acceptance criteria
- [ ] C1. `#hydrate` builds the row's own canonical id from its selected columns, with no extra query, while reference ids (blockers, parent, follows) still resolve as today.
- [ ] C2. A query-count test on a landing, or on a list of N items, shows the own-id lookups gone and every existing tracker test passes.
