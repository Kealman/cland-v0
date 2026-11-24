---
id: T-2080
kind: task
title: "Hub #101 RSS grows from 0.57 GB to 2.0 GB within an hour of a restart under a crew-sized load"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T11:03:59.437Z
updated: 2026-11-24T11:03:59.437Z
---

## Summary

After restart #101 at 10:04Z on 2026-11-24 (2514c3d9a, the T-2069 fix), hub RSS was 0.57 GB at +6 min, 1.79 GB at about +30 min, and 2.0 to 2.1 GB at about +58 min, according to cland-impl's readings and ps. CPU was 60 to 100% with no local runs. Two 5 s tracker stalls came at 11:02Z (task.comment 7.6 s, task.view 10.6 s). Machine swap reached 4.1 GB, up from 1.5 GB that morning. Load came from about 20 live implementer sessions, 8 droplet verifies, a merge batch, and enqueue preflights. The retry loop T-2069 fixed has stopped. Suite-retention passes over all ~5,560 runs per landing (see T-2029) may contribute, but this is unverified.

## What to build

Use a heap profile of the running hub (the SIGUSR1 inspector recipe, hub-startup-profiling) to find which structures grow per event: a retention pass, verification checkpoints, delivery rings, coverage maps or session journals. Bound the growth, or release it after each pass.

## Acceptance criteria

- [ ] C1. A heap profile at about +1 h under a crew-sized load names the top growing retainers (diagnostic).
- [ ] C2. Hub RSS stays within a documented bound over a 2 h crew-sized replay, using the fake harness (test or measurement).
