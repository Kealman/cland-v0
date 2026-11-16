---
id: T-1697
kind: task
title: Host agent checkpoint writes share one fixed '.new' temp name; a concurrent or late checkpoint fails with ENOENT
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1538
branch: t/T-1697-host-agent-checkpoint-writes-share-one
created: 2026-11-05T19:31:45.062Z
updated: 2026-11-16T07:33:04.895Z
---

## Summary

In impl-1692's Linux container evidence (T-1692; `docker run --init`, arm64 Node 24.21.0, about 6.6 of load, repetition 5 of 5), `hub/test/claude-code-remote.test.ts` "lost native release reply settles without replaying native stop" failed in 5.10 s. The error was `ENOENT` opening `<fixture>/f1/home/.cland-host/run/processes.json.new`. The earlier four full-file repetitions passed 26/26.

`hub/src/host/agent/storage.ts` `checkpoint(path, value)` always writes through the fixed name `path + '.new'` and then renames it. Two weaknesses follow:
1. **Concurrent writers.** Two in-process writers (or an old and a restarted agent) checkpointing the same file share one temp name. One can rename it away under the other, or truncate it mid-write.
2. **Late writes.** A checkpoint can start after the run directory has been removed (release, reboot simulation or fixture teardown). `open(…, 'w')` then fails with ENOENT on the missing parent directory, which matches this error.

## What to build

1. Determine which ordering produced this ENOENT, with a deterministic reproduction.
2. Give `checkpoint` a unique temp name per write: the pid plus a random suffix, renamed atomically, with orphaned temp files cleaned up on start.
3. Make every caller either serialize its own checkpoints of one file or tolerate concurrency.
4. If the cause is a late write after the run directory's owner released it, fence that writer and report it, rather than recreating the directory.

## Acceptance criteria

- [ ] C1. The failing order is named with a deterministic reproduction (test, red before the fix).
- [ ] C2. Concurrent checkpoints of one file never fail and never leave a partial file, and the last completed write wins (test).
- [ ] C3. claude-code-remote passes 10/10 under CPU load in a Linux container run with `docker run --init` (evidence).
