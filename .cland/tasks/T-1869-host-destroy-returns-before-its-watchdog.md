---
id: T-1869
kind: task
title: Host destroy returns before its watchdog's exit is joined (watchdog alive ~10 s after destroyed)
state: open
status: planned
size: XS
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: null
branch: null
created: 2026-11-15T11:15:22.624Z
updated: 2026-11-16T07:31:14.880Z
---

## Summary

In E-1537's epic demo (2026-11-15), both scratch hosts reached `destroyed` with their absence receipts confirmed at 11:13:12Z, and `cland host stop <id>` with the hub up returned exit 0. About 9 s later, at 11:13:23.6Z, a host watchdog process (PID 55011) was still alive. By the next read, about a minute later, it had exited on its own. The destroy path calls `retireHostWatchdog`, which stops the recorded watchdog (`hub/src/host/provision-host.ts` around lines 172 and 251), so the CLI appears to return before the watchdog's exit is joined. The surviving PID's argv and birth weren't captured, so which host it belonged to is unknown. The impact is small: no spend and no leak, since the process exited by itself. But a caller that checks for survivors right after destroy sees a live watchdog.

## What to build

Confirm whether `retireHostWatchdog` and `stopHostWatchdog` join the watchdog's actual exit before destroy returns. If they don't, join it within a bounded wait with a typed incomplete outcome, as T-1855 did for prune.

## Acceptance criteria

- [ ] C1. After `host stop`/`destroy` returns `destroyed`, no watchdog for that host is alive, or the command reports a typed "watchdog stop incomplete" outcome (test with a native watchdog).
