---
id: T-1151
kind: task
title: hub.stop never reaches stopped while a droplet create is in flight, and SIGTERM is ignored
state: open
status: backlog
size: S
labels:
  - needs-triage
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T18:04:51.275Z
updated: 2026-10-22T18:04:51.275Z
---

## Summary

At hub restart #46 (2026-10-22 18:01Z, dev fe32111d, cland-impl), stop-requested arrived at 18:01:58.56Z, followed by "stopping". During the stop, the culprit-search droplet create completed: executor-lease-active for lease 310e2a8e (run 44563eb7) at 18:01:59.4Z. No "stopped" line followed. The CLI's SIGTERM at 18:02:08.6Z was ignored, and the recipe had to SIGKILL the hub at 18:02:24Z, 26 s after the stop. T-1060/T-1062 covered a stopped hub whose process lingers; here the hub never reaches stopped. The bridge gap reached 46.7 s of the 60 s mod-bridge grace, and the killed hub left droplet cland-v0-310e2a8e active with no owning run.

## What to build

hub.stop aborts or detaches in-flight executor provisioning within a bounded time. It records the lease for the next hub's reconciliation, still logs "stopped", and exits. SIGTERM always leads to exit.

## Acceptance criteria

- [ ] C1. A hub stopped while a fake droplet create is in flight logs "stopped" and exits within 3 s, and its lease is recorded for reconciliation (test).
- [ ] C2. SIGTERM to a hub blocked in executor provisioning exits within 3 s (test).
