---
id: T-953
kind: task
title: "Hub CPU under a session burst: reach the ≥50 % CPU target with presence/visibility batching (after T-768's statement cache)"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:44:48.962Z
updated: 2026-10-20T09:44:48.962Z
---

## Summary

Split from T-768 at the D76 debt sweep (2026-10-20). T-768 ships a bounded statement cache with measured SQL-operation and prepare counts. Its original target, at least 50 % less hub CPU per request under a session burst, plus batching of presence and visibility updates and profiles from a copied large database, is kept here as an idea to weigh against v0.2's needs.

## Acceptance criteria

- [ ] C1. Profiles from a copied large hub database show where CPU goes after T-768, and presence/visibility batching (or another change) cuts CPU per request by at least 50 % in a quiet-machine burst measurement.
