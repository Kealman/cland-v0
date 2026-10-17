---
id: T-731
kind: task
title: "startup-smoke listening-hang case: the 2 s test budget ends before a loaded Linux hub reaches its first connection"
state: open
status: in progress
size: XS
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
regression_of: T-706
topic: topic-430
branch: t/T-731-startup-smoke-listening-hang-case-the-2
created: 2026-10-17T09:52:07.766Z
updated: 2026-10-17T09:52:36.289Z
---

## Summary

T-706 cut the startup-smoke test budget from 10 s to 2 s. In integrated cover c91c6e1e (A-4440, droplet c-8, peak load 7.6) the planted listening-hang case failed: the smoke expired after 2000 ms with last event `executor-sweep`, before the hub had accepted the connection where the hang is planted. It passes 5/5 alone on the Mac. The case proves a hang *after* listening is named, so its budget must cover start-up to the first connection on a loaded runner.

## What to build

Give the listening-hang case a budget that a loaded Linux runner reaches the first connection within, with a matching duration bound, or start its bound once the planted connection is seen. The pre-discovery case keeps 2 s, because its hang is planted before the daemon starts.

## Acceptance criteria

- [ ] C1. The listening-hang case still asserts the planted event is named as the last startup event, and passes 5/5 on the Mac and in the task's droplet verify.
- [ ] C2. The case's wall time stays under its old 12 s bound, and the header comment says why its budget differs from the pre-discovery case.
