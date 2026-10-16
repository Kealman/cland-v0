---
id: T-605
kind: task
title: executor-safety "all remote admission refusals…" subtest 500 leaks a PROCESSWRAP past projectHub's leak check on a droplet
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:49:18.512Z
updated: 2026-10-16T12:10:03.756Z
---

## Summary

The v0.1.3 release run 24b2df33 at 62a434cd, shard-2 (A-3895, Linux c-8, peak load about 11), failed one subtest. hub/test/executor-safety.test.ts:105, "all remote admission refusals persist a local job, one warn notice and one journal event", subtest `500`, after 5.86 s: `projectHub leaked resources; … actual { resources: ['PROCESSWRAP'] } expected { resources: [] }`. A child process the subtest started was still active when projectHub's leak check ran. The other 975 tests in the shard passed.

## Acceptance criteria

- [ ] C1. The subtest awaits its child's exit before the hub fixture closes, and the file passes 10/10 under parallel load on a droplet.

## Comments

### coord · 2026-10-16T12:10:03.756Z

This also fails alone on the Mac. hub/test/executor-safety.test.ts run whole from a detached dev worktree at 0e2a0aee: 22/22, then 21/22 (one failure; the log wasn't kept). So it isn't load-only on a droplet.
