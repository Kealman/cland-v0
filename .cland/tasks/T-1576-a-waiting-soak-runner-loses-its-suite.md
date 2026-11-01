---
id: T-1576
kind: task
title: A waiting soak runner loses its suite ticket ("suite ticket disappeared while waiting") and the occasion is lost
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-01T03:15:12.553Z
updated: 2026-11-01T03:15:12.553Z
---

## Summary

The nightly soak run 31352d5e at dev bda184aa (A-15180, Linux droplet c-8, occasion soak) stopped in its T2 package phase with `Error: suite ticket disappeared while waiting` at `hub/src/suite-lock.ts:202` (from `run-suite.ts:176` → `runPackageSuite` :579/:597). No test failed: 3,864 passed, and T3, T4 and Web never ran. The T2 line reports `suite duration 5023.59s` against a soak deadline plan of 3537.1 s and a droplet lifetime of 828 s, so the runner's waiting ticket vanished while one package phase still held the machine. Whatever removed the ticket (a stale-ticket sweep, a lease expiry or a clock mismatch) is the defect: a waiting runner lost its place, and the whole occasion was lost.

## Acceptance criteria

- [ ] C1. A test reproduces the loss: a runner waits on the suite lock while another phase holds it beyond the age or deadline that removed the ticket here, and the waiting runner keeps its ticket and acquires the lock once it is released.
- [ ] C2. When a waiting runner's ticket does disappear anyway, the run ends as an infrastructure outcome naming the cause (who removed the ticket and why), not as a failed tier with a bare stack trace.
- [ ] C3. The T2 line's `suite duration` and the droplet lifetime are reconciled in the evidence, or the item records why they differ (5023.59 s against 828 s in A-15180).
