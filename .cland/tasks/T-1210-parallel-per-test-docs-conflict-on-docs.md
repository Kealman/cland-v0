---
id: T-1210
kind: task
title: Parallel per-test docs conflict on docs/agents/tests/index.md
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: t/T-1210-parallel-per-test-docs-conflict-on-docs
created: 2026-10-24T08:09:00.298Z
updated: 2026-10-24T08:12:03.514Z
---

## Summary

Since T-1199 (356efd0e) every lane that adds a per-test doc also adds a line to docs/agents/tests/index.md. On 2026-10-24 that conflicted twice within an hour: T-421 against T-339/T-337, and T-1018 against T-1184. Each conflict costs a dev merge, a delta review and a fresh verify (about 15 minutes).

## Acceptance criteria

- [ ] C1. Two branches that each add a different per-test doc and its index entry merge without a conflict, shown with a scratch Git repository (test).
- [ ] C2. The test-docs check still fails when an index entry is missing, duplicated or out of order, or names a file that does not exist (test).

## Comments

### coord · 2026-10-24T08:11:40.703Z

Scope note (coord, 08:12Z): the conflicts are not only index.md. Two branches that each add guidance for the same test file collide add/add on the per-test doc itself: T-542 against T-1184 (hub-test-merge-batches.test.ts.md) and T-421 (hub-test-planned-stage.test.ts.md); T-1018 against T-1184 the same way. C1 should cover both forms: index lines, and two branches each creating or extending the same per-test doc.
