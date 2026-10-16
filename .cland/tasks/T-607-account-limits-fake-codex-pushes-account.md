---
id: T-607
kind: task
title: account-limits "fake Codex pushes account windows and sparse per-model updates while reads are held" counts 6 where 4 are expected on a loaded Mac
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T12:29:35.335Z
updated: 2026-10-16T12:29:35.335Z
---

## Summary

The v0.1.3 macOS release run dbf1b763 at 0e2a0aee (A-3904, darwin arm64, peak load 13.3) failed hub/test/account-limits.test.ts, "fake Codex pushes account windows and sparse per-model updates while reads are held", with `6 !== 4` after 2.17 s. The droplet release run c01507ab at the same head passed it. It looks like a count that depends on timing under load: extra pushes are observed while the reads are held.

## Acceptance criteria

- [ ] C1. The test waits for the exact pushes it counts (rule 9) and passes 10/10 under parallel load on macOS and on a droplet.
