---
id: T-1229
kind: task
title: Automatic staffing, pools and hierarchy for custom roles
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
created: 2026-10-24T10:45:30.112Z
updated: 2026-10-24T10:45:30.112Z
---

## Summary

T-781 ships custom roles in roles.toml with manual staffing: the human or Coordinator launches a session under a custom role by name. A later step would let the crew policy staff custom roles automatically, with pools, caps and a place in the lead hierarchy, as it does for the built-in roles.

## What to build

Crew policies (per-item, per-group, pool, singleton) apply to custom roles, and a custom role can declare where it sits under the Coordinator/Lead hierarchy for routing (`lead T-n`, verdict delivery).

## Acceptance criteria

- [ ] C1. A custom role with a pool policy is launched and capped by the hub like a built-in pool role (test).
- [ ] C2. A custom role declares its supervising level, and `lead T-n` routing honours it (test).
