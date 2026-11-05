---
id: T-1687
kind: task
title: Hub-local process identity keeps the exit-time /proc ESRCH race that T-1684 fixed for the agent (git daemon stop incomplete)
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1684
topic: null
branch: null
created: 2026-11-05T11:55:24.090Z
updated: 2026-11-05T11:55:31.235Z
---

## Summary

Hub-local process identity on Linux has the same exit-time `/proc` race that T-1684 fixed for the host agent. `hub/src/process-identity.ts` (lines 59 and 82) reads `/proc/<pid>/stat`, and any read error, ESRCH from a process mid-exit included, becomes an identity failure. T-1684 added a bounded retry that resolves only on a positive ENOENT or native birth, but only in `host/agent/native.ts`. The hub-local path that `localHost` uses kept the bare failure.

Observed failures, intermittent on Linux x64 under load:
- T-1686 batch 21f52bc7 at 084165e2 (A-16851): host-git-daemon "eight admitted daemons per host; excess is refused, logged and close joins native exits" failed with `Git daemon termination incomplete` (git-daemon.ts:75, `native.stop(proof)` returned false; `native` is `localHost`). The test passed in A-16828, A-16844 and A-16849.
- dev-t3 687e1dc0 at 4cd99e20 (A-16822): host-ssh-contract "Host processes reports resident bytes and CPU percent for the whole parent-child tree", where `host.stop(owned)` returned false (host-contract.ts:415). That case ran through the agent before T-1684 landed. It may also be this class.

## What to build

Apply T-1684's bounded exit-time retry, with the same semantics, to `process-identity.ts`, ideally through one shared helper used by both paths so there is a single definition. A persistent ESRCH or unreadable state stays unknown. No signal authority comes from observation.

## Acceptance criteria

- [ ] C1. Injected ESRCH on a `/proc/<pid>/stat` read of an exiting process makes hub-local identity report unknown before the fix and resolve to exited after it (test, red before the fix).
- [ ] C2. Hub-local and agent identity share one exit-race helper, and a persistent ESRCH still yields unknown (test).
- [ ] C3. host-git-daemon and host-ssh-contract pass 20/20 locally under CPU load in a Linux container (evidence).
