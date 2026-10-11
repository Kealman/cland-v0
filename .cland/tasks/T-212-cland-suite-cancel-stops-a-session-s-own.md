---
id: T-212
kind: task
title: cland suite cancel stops a session's own queued or running suite and posts the cancellation
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-11T05:16:28.859Z
updated: 2026-10-11T06:35:55.910Z
---

## What to build

`cland suite` (T-203) can only start a run. Cancelling one means sending SIGTERM to the worker by pid. That works because the worker forwards the signal to its npm/runner group and writes an interrupted receipt, but sessions have to find and verify the pid themselves. Seen on 2026-10-11, when impl-182 cancelled an obsolete run after a review fix.

Add `cland suite cancel [<suite id>]`. It cancels the caller's own queued or running suite (the latest one by default) through the hub, releases its queue ticket or lock, and posts one 'cancelled' result to the original recipients. It refuses another session's suite.

## Acceptance criteria

- [ ] A queued suite cancelled before admission leaves the queue at once; a running one is interrupted cleanly with its receipt.
- [ ] Exactly one result reaches the original recipients, marked cancelled.
- [ ] Cancelling another session's suite is refused with the reason.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size XS.
