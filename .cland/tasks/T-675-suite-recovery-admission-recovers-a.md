---
id: T-675
kind: task
title: suite-recovery 'admission recovers a borrowed planned root…' kills the launch snapshot's pid; use T-526's pid observer
state: open
status: backlog
size: XS
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by:
  - T-526
topic: null
branch: null
created: 2026-10-16T19:13:55.940Z
updated: 2026-10-16T19:15:37.767Z
---

## Summary

hub/test/suite-recovery.test.ts:123 (at aeaf3dec) ('admission recovers a borrowed planned root after the worker dies during package mkdir') calls `process.kill(job.pid!)` on the launch response snapshot after waiting for its marker. It has the same nullable-PID race that T-526 fixed in two other cases: the marker doesn't refresh the snapshot, and the worker pid is published later on the job record. The source review of T-526 (A-4139) found it by inspection, with no observed failure yet.

## What to build

The case uses the shared PID observer T-526 added (aeaf3dec) to read the published pid from the durable job record before it kills the worker. Its assertions keep their meaning.

## Acceptance criteria

- [ ] C1. The case reads the worker pid through T-526's observer before signalling, with its assertions unchanged in meaning, proved by the file's own run.
- [ ] C2. suite-recovery.test.ts passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
