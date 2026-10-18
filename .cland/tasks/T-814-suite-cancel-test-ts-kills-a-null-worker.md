---
id: T-814
kind: task
title: suite-cancel.test.ts kills a null worker pid when the job snapshot precedes pid recording
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T18:33:03.823Z
updated: 2026-10-18T18:33:03.823Z
---

## Summary

`hub/test/suite-cancel.test.ts` › "a worker killed while the hub is down is reported after restart and its package children are cleaned" calls `process.kill(job.pid!, 'SIGKILL')` while `job.pid` is still null. It fails with ERR_INVALID_ARG_TYPE at line 181. That happens when the launched job's snapshot is read before the worker pid is recorded. Seen on a droplet (Linux, 2 workers) in run b329e5fa for T-809 at bfbc434d (A-5477, lines 48835–48839); that change didn't touch this file.

## Acceptance criteria

- [ ] C1. The test waits for the worker's recorded pid (an observed state, not a sleep) before stopping the hub, and fails with a named message if the pid never appears; all original assertions are kept.
- [ ] C2. The file passes 20 serial runs on macOS and one droplet run, with a red-to-green proof that a delayed pid recording no longer reaches process.kill(null).
