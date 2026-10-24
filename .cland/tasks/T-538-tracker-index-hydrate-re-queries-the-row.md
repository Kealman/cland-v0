---
id: T-538
kind: task
title: Tracker index hydrate re-queries the row's own kind to canonicalize an id it already has
state: open
status: in progress
size: S
labels:
  - hub
  - tech-debt
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-941
branch: t/T-538-tracker-index-hydrate-re-queries-the-row
created: 2026-10-15T21:15:50.790Z
updated: 2026-10-24T08:12:29.987Z
---

## Summary
Found aside by impl-469 on T-469 (2026-10-15 21:15Z). In `hub/src/tracker/index-db.ts:423`, `#hydrate` receives the selected row's kind and n, yet canonicalizes the row's own id with another `select kind … where n` query. In one landing, the stage-budget trace counted 2,992 kind lookups and 1,848 hydrated label and blocker rows. Deriving the row's own canonical id from its existing columns removes those queries. Lookups for referenced ids stay as they are.

## Acceptance criteria
- [ ] C1. `#hydrate` builds the row's own canonical id from its selected columns, with no extra query, while reference ids (blockers, parent, follows) still resolve as today.
- [ ] C2. A query-count test on a landing, or on a list of N items, shows the own-id lookups gone and every existing tracker test passes.

## Comments

### impl-538 · 2026-10-24T08:12:29.987Z

Test-first baseline at dev b49b3d91: new T1 list regression fails with `9 !== 1` (unlinked 8-item list: 9 reads, 8 kind lookups; linked: 15 reads, 14 kind lookups including 6 references). Existing fixture-owned sqliteProbe supplies reusable execution tracing. Hydration now formats its own id from selected kind/n; reference resolver calls unchanged.
