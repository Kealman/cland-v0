---
id: T-2032
kind: task
title: remote-scripted 'scripted machines report red, lost and slow runs without a worker' hangs to the 120 s timeout under macOS suite load (passes 5/5 alone)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-20T10:56:29.594Z
updated: 2026-11-20T10:56:29.594Z
---

## Summary

The macOS stage cover 520ec02d at dev 78ea6dce2 (log A-22146) failed at T2 with one cancelled test: `hub/test/remote-scripted.test.ts::scripted machines report red, lost and slow runs without a worker` hung to the 120 s test timeout (baseline 0.2 s). The case passed 5/5 alone on the same machine right after, at 1–2 s each. It is an intermittent hang under suite load.

## What to build

Find what the case waits on when it hangs (a scripted machine event, a timer, or a settlement that never arrives under load), and make the wait settle or fail with a named diagnostic well inside the case budget. Keep the assertions.

## Acceptance criteria

- [ ] C1. The hang is reproduced or its waiting point is named from evidence, and the case fails with a named diagnostic instead of hitting the 120 s timeout (test).
- [ ] C2. The case passes 5/5 under the two-worker load gate on macOS (test).
