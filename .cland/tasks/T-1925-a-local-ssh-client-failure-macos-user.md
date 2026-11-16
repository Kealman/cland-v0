---
id: T-1925
kind: task
title: A local SSH client failure (macOS user lookup down) marks healthy droplet runs "remote machine lost" after 300 s
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-16T22:17:45.854Z
updated: 2026-11-16T22:18:05.877Z
---

## Summary

On 2026-11-16 at 17:26Z the hub's Mac lost sysmond and its local user lookup (`ssh-keygen`: "No user exists for uid 501"). The hub's SSH status checks to healthy droplets then failed locally for 300 s, and runs 9759d489, 8ca3360e and c830a7ae were all finished at 17:31:31–17:31:32Z with cause "remote machine lost", although the failure was on the hub's side. A local SSH client failure should not discard remote runs as if their machines were gone.

## Evidence

- impl-1922 (topic-1568): the three runs' result.json say cause='remote machine lost'; their suite.log files hold no inspection or recovery diagnostic. The droplet run status in executor/droplet/run.ts marks a run lost after 300000 ms of failed SSH status against an active provider, or on a 404 or absent resource.
- The next run, f78c050a, failed at `ssh-keygen` with `No user exists for uid 501`.

## Acceptance criteria

- [ ] C1. When the SSH status check fails because the local client cannot run (a fake ssh that fails before connecting, with a user-lookup or key error) while the provider reports the droplet active, the run is not marked "remote machine lost"; it holds as "local SSH client unavailable" and resumes once the client works again (test, red before the fix).
- [ ] C2. A droplet that the provider reports gone, or that stays unreachable while the local client works, is still marked lost as today (test).
