---
id: T-512
kind: task
title: Explicit --executor droplet still falls back to the Mac when the remote budget is full
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T16:25:28.989Z
updated: 2026-10-15T16:25:28.989Z
---

## Summary

`cland verify --executor droplet` falls back to the local Mac slot when the remote budget is full, the same as a run with no flag. A run that needs Linux evidence therefore can't wait for a droplet. On 2026-10-15 at 16:21Z, impl-485's 34841ef7, submitted with `--executor droplet`, was admitted locally with "remote budget 4/4 full", and earlier runs did the same. The fallback also adds a full local run to an already busy Mac.

## Acceptance criteria

- [ ] C1. A run submitted with an explicit `--executor droplet` waits in the queue for a remote slot or budget and never falls back to local. The queue shows it as waiting for remote, with its position.
- [ ] C2. It still refuses, rather than waits, when the daily spend cap can't cover its reservation, naming the cap. Runs with no flag keep today's fallback.
- [ ] C3. A test fills the remote budget, submits an explicit-droplet run, and sees it wait and then run remotely once a slot frees.
