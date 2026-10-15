---
id: T-523
kind: task
title: executor-run startReplyLost case leaks pipe handles past the case under load (projectHub leak check, Linux)
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
created: 2026-10-15T18:39:08.367Z
updated: 2026-10-15T18:39:08.367Z
---

## Problem

`hub/test/executor-run.test.ts:190`, the `startReplyLost` case, failed on Linux in T-508's droplet verify 263c9910 (A-3259:4028–4060). T-393's projectHub leak check reported "projectHub leaked resources; active before=CloseReq,PipeWrap,PipeWrap,PipeWrap,TCPServerWrap after=PipeWrap,PipeWrap,PipeWrap". The case loses the start reply on purpose, and a pipe from the lost exchange outlives the case under load.

## Acceptance criteria

- [ ] C1. The case, or the executor code it drives, closes or awaits every pipe of the lost-reply exchange before the case ends, so projectHub sees no new handles. Keep the leak check. Record the root cause, and whether a product path leaks too, in the commit.
- [ ] C2. executor-run.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
