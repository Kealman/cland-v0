---
id: T-1203
kind: task
title: tiers.json maps shared read paths to the T4 load files that guard them, and verify selection adds them
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-944
branch: t/T-1203-tiers-json-maps-shared-read-paths-to-the
created: 2026-10-24T06:46:05.046Z
updated: 2026-10-24T08:31:28.120Z
---

## Summary

Changes to shared read paths (T-1147) were selected without the T4 load files that guard their cost. Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. A change to a mapped read path adds its T4 load files to the task's selection, and the report names why (test).
- [ ] C2. The T-1147 read path is mapped, and the mapping is documented in docs/agents/tests.md (docs).
