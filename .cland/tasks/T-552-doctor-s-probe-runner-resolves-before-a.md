---
id: T-552
kind: task
title: doctor's probe runner resolves before a timed-out child's close event
state: open
status: backlog
size: S
labels:
  - hub
  - tech-debt
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-16T00:33:56.971Z
updated: 2026-10-16T00:33:56.971Z
---

## Summary
Found aside by impl-523 on T-523 (2026-10-16 00:31Z, code reading, not yet reproduced as a failure). In `hub/src/doctor/report.ts:94–103`, `run()` kills a timed-out probe's process group, destroys its pipes, then resolves at once, without awaiting the ChildProcess `close` event. Its error handler also resolves before close. `processStartedAsync` uses this helper, so a probe timeout can leave native process resources alive briefly after the promise settles. That's the same class as T-523's watchdog stop, which T-523 keeps out of scope.

## Acceptance criteria
- [ ] C1. `run()` resolves on timeout or error only after the child's `close` (bounded, with SIGKILL escalation), and callers' timeouts still hold.
- [ ] C2. A test times out a probe whose child ignores SIGTERM and shows that no PROCESSWRAP or PIPEWRAP handle remains once the promise settles.
