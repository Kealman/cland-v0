---
id: T-1965
kind: task
title: Move the remaining request-driven executor writers (#acquire, reap, prepare snapshot, shard receipts) onto T-1964's bounded run-directory helper
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: null
branch: null
created: 2026-11-18T08:49:27.338Z
updated: 2026-11-24T09:00:19.455Z
---

## Summary

T-1964 (2026-11-18) stopped background lease and recovery writers from recreating a deleted project, through a bounded `runDirectory` helper that never creates anything above `.cland/run`. Per its scope decision, four request- or completion-driven executor writers still create their directories with `mkdir(..., { recursive: true })`: `#acquire`, explicit reap, prepare snapshot publication, and `releaseShardReservations` receipt creation. Each could recreate a deleted project if a request or completion arrives after the project is removed. The writers and their readers are inventoried in A-21148.

## What to build

Move each of the four writers onto `runDirectory`, so a missing project becomes a structured refusal rather than a recreated tree. Keep each writer's behaviour otherwise unchanged.

## Acceptance criteria

- [ ] C1. For each of the four writers, a held-writer test deletes the project root mid-write and shows that no directory is recreated and the operation reports a structured missing-project outcome (test, red before, green after).
- [ ] C2. The readers of each writer's output (A-21148) are listed with their disposition and pass unchanged (rule 41).
