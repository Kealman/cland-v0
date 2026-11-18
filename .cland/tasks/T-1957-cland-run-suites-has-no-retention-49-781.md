---
id: T-1957
kind: task
title: ".cland/run/suites has no retention: 49,781 entries and 68 GB, constantly rewritten, feeding fseventsd's growth on macOS"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-18T04:38:52.596Z
updated: 2026-11-18T06:20:38.716Z
---

## Summary

On 2026-11-18 04:38Z cland-impl found macOS fseventsd (pid 337, up about 35 h) holding 36 GB of memory (35 GB compressed) at 142% CPU. Swap was 30.6 of 31.7 GB, and free disk fell from 87 GB at 03:06Z to 69 GB at 04:38Z. This is the same class as 2026-10-28. `.cland/run/suites` holds 49,781 entries totalling 68 GB, and `.cland/run/executor/leases` 4,217 directories (T-1950 stops the hot reads, not the growth). The hub writes and reads under `.cland/run` constantly, and something watches that tree recursively. Nothing removes old suite run directories, so disk and file-event load grow without bound. The machine's own load also degraded local macOS covers all day, adding to T-1950's hub CPU.

## What to build

A retention rule for `.cland/run/suites`. Keep every run still referenced by a live verify, batch, cover or QA verdict, plus the last N runs per occasion, and archive or delete older ones after their artifacts (logs and coverage maps under `.cland/artifacts`) are confirmed durable. Name the recursive watcher on `.cland/run`, and narrow it to the paths it needs.

## Acceptance criteria

- [ ] C1. With a fake run root of 50,000 run directories, retention keeps exactly the referenced and recent runs, removes the rest only after their artifacts exist, and is idempotent and crash-safe (test).
- [ ] C2. The recursive watcher on `.cland/run` is identified and limited to the subpaths its consumer reads, and every reader of old suite run directories (rule 41) is listed with its disposition (test or artifact).
