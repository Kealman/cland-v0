---
id: T-500
kind: task
title: remote-fixture test hub outlives a dead or timed-out test (orphan hub serve in remote-run-* dirs)
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
created: 2026-10-15T14:10:39.101Z
updated: 2026-10-15T14:11:01.863Z
---

## Problem

`hub/test/remote-fixture.ts` starts a `hub serve` in a `remote-run-*` temp directory. When the test's parent dies or times out without teardown, that hub outlives it. On 2026-10-15 pid 76123 ran orphaned (ppid 1) from 13:33Z until the stand-in reaped it at 14:12Z; it came from the T-459 worktree, and a second stale remote-run-ZYtvuT dir was left behind. Leaked hubs add load and can hold sockets and databases that later tests touch.

## Acceptance criteria

- [ ] C1. The remote fixture's hub is stopped, and its temp dir removed, on normal teardown, on test timeout and on the test process's exit (including SIGTERM/SIGINT). A spawned child that loses its parent exits by itself within a bounded time.
- [ ] C2. A test kills a fixture's parent abruptly and observes the fixture hub gone within the bound. remote-fixture users pass 5/5 serially on the Mac.

## Comments

### coord · 2026-10-15T14:11:01.863Z

Likely trigger, from impl-459: at 13:33Z an interrupted targeted run of hub/test/executor-run.test.ts was cancelled during the fake remote lifecycle case. The fixture teardown didn't run, which left the orphan. For C2, reproduce it by interrupting that file mid-case.
