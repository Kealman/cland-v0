---
id: T-806
kind: task
title: "session-stop-races: Codex post-merge forced stop waits 15 s for the descendant identity probe file under macOS load"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T14:13:11.905Z
updated: 2026-10-18T14:13:11.905Z
---

## Summary

hub/test/session-stop-races.test.ts:91, "Codex: post-merge forced stop succeeds when a captured descendant exits before its final identity probe", failed in E-678's second macOS stage run b73dd6cd (A-5340, 3 workers, peak load 15.4): `descendant identity probe written: not within 15000 ms` (ENOENT on probe.json). The file took 37.8 s against a 17.5 s baseline. It's a wall-clock `eventually` on a file written by a spawned descendant.

## Acceptance criteria

- [ ] C1. The test waits on an observed event (the probe write or the descendant's exit), or on a FakeClock step, instead of a 15 s wall-clock deadline, keeping every assertion. It passes 20/20 with the machine phase at 4 workers on macOS.
