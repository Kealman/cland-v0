---
id: T-765
kind: task
title: "orphan-servers: a foreground hub stopped after doctor --fix was SIGKILLed instead of exiting cleanly (1 in 35 Mac runs)"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T00:55:58.384Z
updated: 2026-10-18T00:55:58.384Z
---

## Summary

During T-703's post-merge proof on 2026-10-18 at 00:33Z, the head was 671d8e9d, which merges T-703 with dev fc183873. There, hub/test/orphan-servers.test.ts:446, "doctor --fix lets a foreground hub for a deleted project stop cleanly without recreating its directory", failed once at line 466. The run got `{code: null, signal: SIGKILL}` where it expected a clean exit, at peak load 4.8, on the fifth of five whole-file runs (A-4878). It didn't reproduce in 30 further serial runs: 10 whole-file runs on clean dev fc183873, 10 isolated-case runs and 10 whole-file runs at the T-703 head (A-4879). T-703 changes the stop and kill path (a bounded PID-reaped precondition in daemon.ts and adapters/processes.ts), but it's unproven whether that path causes this.

## What to build

Find what escalates a doctor-repaired foreground hub's stop to SIGKILL: the stop-grace timer, a race between the hub's own exit and the escalation, or an unrelated reaper. Make the clean exit deterministic, or make the test wait on the hub's own exit receipt before the grace window.

## Acceptance criteria

- [ ] C1. The cause is named with evidence, and the case passes 50/50 serially under a load of 8–12, or under a scripted delay that reproduced the SIGKILL before the fix.
