---
id: T-523
kind: task
title: executor-run startReplyLost case leaks pipe handles past the case under load (projectHub leak check, Linux)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-342
branch: t/T-523-executor-run-startreplylost-case-leaks
created: 2026-10-15T18:39:08.367Z
updated: 2026-10-16T00:28:44.294Z
---

## Problem

`hub/test/executor-run.test.ts:190`, the `startReplyLost` case, failed on Linux in T-508's droplet verify 263c9910 (A-3259:4028–4060). T-393's projectHub leak check reported "projectHub leaked resources; active before=CloseReq,PipeWrap,PipeWrap,PipeWrap,TCPServerWrap after=PipeWrap,PipeWrap,PipeWrap". The case loses the start reply on purpose, and a pipe from the lost exchange outlives the case under load.

## Acceptance criteria

- [ ] C1. The case, or the executor code it drives, closes or awaits every pipe of the lost-reply exchange before the case ends, so projectHub sees no new handles. Keep the leak check. Record the root cause, and whether a product path leaks too, in the commit.
- [ ] C2. executor-run.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### coord · 2026-10-15T20:01:02.219Z

Second case of the same class: executor-prepare.test.ts:198, "failed replacement releases its builder, deletes a partial image and keeps the previous snapshot". The body assertions pass, but the projectHub cleanup (hub-resources.ts:30) detects a PROCESSWRAP leak on Linux in T-474's run fb5a0840 (A-3313). Cover both executor handle leaks.

### impl-523 · 2026-10-16T00:23:17.641Z

Read task, E-482 decisions and v0.1.3 spec. Investigating both executor lost-start-reply pipes and failed snapshot replacement PROCESSWRAP; will retain projectHub leak assertions. First gathering targeted baseline and tracing resource ownership. Coordinator requested npm ci --ignore-scripts before typecheck; doing so in this worktree.

### impl-523 · 2026-10-16T00:28:44.294Z

Original Linux receipts A-3259:4028 and A-3313:4074 both leak one PROCESSWRAP, not PIPEWRAPs. Root cause: stopWatchdog identity-checks and sends SIGTERM without awaiting child exit/close, so provider release/result may finish before native watchdog cleanup. Product path is affected as well as test teardown. Deterministic regression at existing lost-reply seam: SIGSTOP the owned watchdog, finish the suite, assert PID gone before result; old code fails true !== false (18.2 s run). Implementing bounded graceful wait + SIGKILL escalation in watchdog.ts only, retaining exact ChildProcess close receipts for owned watchdogs and identity-protected waits for restored ones. Failed replacement now asserts builder watchdogs gone too; leak checker unchanged.
