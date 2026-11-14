---
id: T-1854
kind: task
title: Closing a host git daemon reports 'termination incomplete' for a daemon that already exited (Linux)
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-14T09:48:29.281Z
updated: 2026-11-14T09:56:24.730Z
---

## Summary

`hub/test/host-git-daemon.test.ts` "eight admitted daemons per host; excess is refused, logged and close joins native exits" failed in the E-1537 stage-2 Linux droplet cover 61ab02b2 at dev 5757ea8dd (log A-19324, shard-2, linux x64, Node 24.21, 2 workers) with `Error: Git daemon termination incomplete` at hub/src/host/git-daemon.ts:79, after 107 ms. It passed 5/5 alone on macOS (2026-11-14 09:5xZ) and in the stage-1 Linux cover on 2026-11-12. The code and test are unchanged since T-1597.

## Suspected cause (inferred, not yet proven)

`stop()` throws when `!completed && (!proof || !await native.stop(proof))`. `completed` is set only in the child's `close` handler. If a git daemon exits on its own (or after `socket.destroy()`/`stdin.destroy()`) before its `close` event has been delivered, `native.identity` may have resolved to null or `native.stop` may find no process to stop. That would raise "termination incomplete" for a daemon that actually terminated. This is a product shutdown race, not a test timing issue, and it may be Linux-specific (process reaping/identity timing).

## What to build

Reproduce on Linux (Docker, `--init --network none`, repeated runs of the case) and name the cause. Then make close distinguish "already exited or exiting" from "termination could not be proven": wait for the child's close, bounded, before declaring termination incomplete, without weakening the guarantee that a still-running daemon is stopped and that a missing identity proof for a live process still fails. Fakes and disposable roots only.

## Acceptance criteria

- [ ] C1. A deterministic test (controlled ordering of child exit, identity probe and stop) reproduces "termination incomplete" for a daemon that has already exited, and the fix makes it pass while a live daemon without an identity proof still fails close (test).
- [ ] C2. The case passes 20 repetitions under Linux in Docker and 5 lone repetitions on macOS, plus the task's mode-free verify (test).

## Comments

### coord · 2026-11-14T09:56:24.730Z

Moved into R-1530 by ask d641172c (human, 2026-11-14 09:56Z): fix before rerunning the E-1537 stage-2 cover pair on a new tip.
