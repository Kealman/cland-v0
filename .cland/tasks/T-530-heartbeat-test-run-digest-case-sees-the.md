---
id: T-530
kind: task
title: "heartbeat test: run-digest case sees the first run still launching when its 100 ms timeout passes (Linux)"
state: open
status: in progress
size: S
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-508
topic: topic-325
branch: t/T-530-heartbeat-test-run-digest-case-sees-the
created: 2026-10-15T20:54:17.308Z
updated: 2026-10-15T20:55:33.259Z
---

## Summary
In E-387 stage-close run 7d5ac27f (shard 1, droplet cland-v0-2df7755a, c-8 lon1, peak 1m load 10.8; log A-3341), `hub/test/heartbeat.test.ts:169`, 'the digest includes running and queued runs and ages timeouts and ended runs without results', failed at :183. The digest already showed `past its timeout` while the run's state was still `launching · impl · T-1`, so the `running · impl` match failed. T-508 fixed this case's hang and its first failure on the Mac. This is a new mode under load: the 100 ms executor timeout can pass before the worker reports running.

## Evidence
```
heartbeat · coord · In flight (1)
- run 97a04488-… launching · impl · T-1
Stale (1)
- run 97a04488-… past its timeout · age 1s
```
dev head 66545745.

## Acceptance criteria
- [ ] C1. The case waits for a digest that shows the run running and past its timeout, or otherwise orders the two facts, so a slow worker start no longer fails it. Every other assertion stays.
- [ ] C2. The file passes 5/5 targeted runs, on Linux (droplet verify) or under Mac load.
