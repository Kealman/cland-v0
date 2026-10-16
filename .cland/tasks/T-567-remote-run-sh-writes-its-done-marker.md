---
id: T-567
kind: task
title: Remote run.sh writes its done marker before the timestamp, so a poll can read code 0 with an empty finished time and the run never enters the cache
state: open
status: planned
size: S
labels:
  - bug
  - hub
  - executor
  - v0.1.3
assignee: null
parent: E-425
blocked_by: []
topic: null
branch: null
created: 2026-10-16T03:27:02.619Z
updated: 2026-10-16T03:27:31.165Z
---

## Summary
Found by impl-562 on 2026-10-16 (evidence A-3644), reproducible on dev 58696d94 and on T-562's 0f42e138. The droplet's run.sh creates `done` with `date >done`, so the file exists before the timestamp is written. A status poll in that window reads done with code 0 and finished ''. DropletRun.status then reports the run (reported=true) but leaves job.finished unset, and `#cached` rejects the run that just completed. That is the cause of T-562's Linux failure at verification-workers.test.ts:73 (`cached.cached?.run` undefined). Holding the fake machine's `date` reproduces it in about 8 s.

## Acceptance criteria
- [ ] C1. run.sh writes the done marker atomically (write to a temporary file, then rename), and DropletRun.status treats a done marker without a finished time as still running instead of finished.
- [ ] C2. A test holds the fake machine's date at the done boundary and shows the run is reported only once finished is set, and that a same-head relaunch then hits the cache.
