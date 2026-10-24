---
id: T-1225
kind: task
title: cland qa lint rejects every Aide verification row although the Aide clause allows cland verify
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-24T10:32:00.959Z
updated: 2026-10-24T10:32:00.959Z
---

## Summary

Found aside by impl-781 during T-781 (2026-10-24 10:31Z, topic-956). `cland qa lint`'s Aide branch refuses every brief row that assigns `cland verify` to the Aide role. But the shipped Aide clause explicitly allows `cland verify`, and the hub admits an Aide's suite through its artifact and send grants. The static lint and the runtime policy disagree; this predates T-781, which kept the existing negative control unchanged.

## Acceptance criteria

- [ ] C1. `cland qa lint` accepts an Aide verification row exactly when the runtime would admit that Aide's `cland verify`, and refuses it when the runtime would refuse it, shown by one test that runs both the lint and the runtime admission decision over the same cases.
