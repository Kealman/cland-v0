---
id: T-799
kind: task
title: A droplet run that hits its run timeout loses the machine shard's results, so the hung test can't be named
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-508
branch: t/T-799-a-droplet-run-that-hits-its-run-timeout
created: 2026-10-18T10:52:38.748Z
updated: 2026-10-18T12:57:52.261Z
---

## Summary

Twice on 2026-10-18 a task verify hit the 75 min run timeout with exit 124: T-759 7efa2911 (A-5076) and T-709 2119e998 (A-5221). Only the free shard's results were collected. The machine shard's `suite start` lines are present, but its `✔`/`✖` and `suite timing` lines were lost with the killed reporter: in A-5221, 2145 tests started and only 275 completed. So the hung file has to be found by bisecting on the Mac, which takes about an hour per incident.

## Acceptance criteria

- [ ] C1. When a run reaches its run timeout (or is cancelled), the result names every test that started but never finished, with its file and how long it had been running. A T2 test with a planted hanging test on the in-process provider proves it.
- [ ] C2. Completed tests in the timed-out shard are kept in the result and its log, without depending on the reporter flushing at exit.
- [ ] C3. The suite result's first lines after "exit 124" say "hung: <file> :: <test> (running N s)" for the longest-running unfinished test.
