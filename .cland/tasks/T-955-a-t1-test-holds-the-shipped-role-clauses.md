---
id: T-955
kind: task
title: A T1 test holds the shipped role clauses' byte reserve and wording pins
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:53:17.153Z
updated: 2026-10-20T09:53:57.584Z
---

## Summary

The Coordinator clause's byte reserve (roles.test.ts, 7707 bytes against 7680) and its wording pins (surface.test.ts:81) are pure functions of hub/src/roles/default-roles.ts. Both assertions are T3, so two release candidates of v0.1.4 went red on them after T1-only batches had landed the change. Move them into a T1 test over the shipped clauses.

## What to build

A T1 test reads the shipped default role clauses. For each one it asserts the byte reserve and the wording pins that the T3 files assert today. A merge batch then catches a clause that is over its reserve or has a stale pin in about 2 minutes. The T3 files keep only the claims that need a live hub. This comes from retro finding 3 (A-7261) and cluster 6 of the rule batch (A-7281), which the human approved on 2026-10-20.

## Acceptance criteria

- [ ] C1. A T1 test fails when any shipped role clause exceeds its byte reserve, naming the role, the size and the reserve.
- [ ] C2. Every wording pin of a shipped clause now asserted in a T3 file is asserted in T1, and the T3 copy is removed or reduced to its live-hub claim, with an assertion map in the evidence.
- [ ] C3. Red evidence: a scratch edit that pushes the Coordinator clause over its reserve, or rewords a pinned line, fails the T1 test.
