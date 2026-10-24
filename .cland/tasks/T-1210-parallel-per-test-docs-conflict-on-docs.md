---
id: T-1210
kind: task
title: Parallel per-test docs conflict on docs/agents/tests/index.md
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-24T08:09:00.298Z
updated: 2026-10-24T08:09:00.298Z
---

## Summary

Since T-1199 (356efd0e) every lane that adds a per-test doc also adds a line to docs/agents/tests/index.md. On 2026-10-24 that conflicted twice within an hour: T-421 against T-339/T-337, and T-1018 against T-1184. Each conflict costs a dev merge, a delta review and a fresh verify (about 15 minutes).

## Acceptance criteria

- [ ] C1. Two branches that each add a different per-test doc and its index entry merge without a conflict, shown with a scratch Git repository (test).
- [ ] C2. The test-docs check still fails when an index entry is missing, duplicated or out of order, or names a file that does not exist (test).
