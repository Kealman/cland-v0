---
id: T-1818
kind: task
title: host-restart reads the live host's login file before its tunnel is up after restart
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
regression_of: T-1793
found_by: droplet
topic: topic-1483
branch: t/T-1818-host-restart-reads-the-live-host-s-login
created: 2026-11-11T19:32:48.950Z
updated: 2026-11-11T19:34:35.375Z
---

## Summary

`hub/test/host-restart.test.ts::restart keeps the live host and exits the deleted host, settles spend, and restores watchdog ownership` failed on periodic dev T3 run 24f075af at e744bc339 (Linux droplet, A-18857) with `Error: host host-…: tunnel is not up` from `ssh-host.ts` `check` via `readFile`, at host-restart.test.ts:107. That line is T-1793's C2 proof: right after the hub reopens, it reads the live host's login file through `liveHost.readFile`, but the reopened hub's SSH tunnel to that host may not be up yet. The same case passed in A-18798, A-18810 and A-18814 (10.5–12.0 s). It is a setup race in the test, not a product defect: the restart restores the tunnel asynchronously.

## What to build

Before the C2 read, wait with a named setup bound (`eventually` with `SETUP_MS`) for the reopened live host to be reachable, through the Host's own readiness signal (tunnel up or `loginDiskReachable()`), never a sleep. Then read the file and keep every existing assertion. Don't weaken the proof that the post-restart mounted disk holds the exact rotated bytes.

## Acceptance criteria

- [ ] C1. The case waits for the reopened live host's tunnel or disk readiness through a named bounded wait before `readFile`, and every existing assertion is kept (test).
- [ ] C2. The case passes five lone repetitions on macOS at the fix head, and the Linux run of the mode-free verify passes it, both recorded in an item comment.

## Comments

### impl-1818 · 2026-11-11T19:34:35.375Z

Pre-fix red evidence: A-18857, periodic dev T3 24f075af at e744bc339 on Linux droplet, Error: host host-…: tunnel is not up from ssh-host check via readFile at host-restart.test.ts:107. Local macOS baseline at e744bc339 passed once (8.492 s case); race is intermittent. Fix 0679105b1 waits on the reopened Host's loginDiskReachable() via eventually/SETUP_MS before readFile, retaining every assertion. Rule 20: no shared contract changes; only this test and its per-test guidance change.
