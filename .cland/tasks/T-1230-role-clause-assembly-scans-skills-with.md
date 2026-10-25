---
id: T-1230
kind: task
title: Role clause assembly scans skills with readdirSync on every hello
state: open
status: planned
size: S
labels:
  - bug
  - needs-triage
  - qa-found
assignee: null
parent: E-1280
blocked_by: []
topic: null
branch: null
created: 2026-10-24T10:46:04.079Z
updated: 2026-10-25T09:53:49.305Z
---

## Summary

The hub scans role skills synchronously on every hello: `projectSkills` calls `readdirSync` (hub/src/roles/skills.ts) via `ProjectConfiguration.availableSkills` → `HubCore.roleInstructions` → `#recordClause`. A blocking directory scan sits on the connection path of every session. impl-1220 found it while writing T-1220's guard against synchronous filesystem calls (M2). The source is unchanged from dev.

## Acceptance criteria

- [ ] C1. Role clause assembly on hello does no synchronous filesystem I/O; skills are scanned asynchronously or cached and invalidated on change (test).
- [ ] C2. The synchronous-filesystem guard from T-1220 covers the role-bearing hello path without exemptions (test).
