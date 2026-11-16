---
id: T-1922
kind: task
title: When pgrep fails while exiting 0 (macOS sysmond missing), the hub reads every process group as empty and declares live remote runs and watchdogs dead
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: null
branch: null
created: 2026-11-16T17:36:21.368Z
updated: 2026-11-16T17:36:21.368Z
---

## Summary

On 2026-11-16 around 17:26Z the macOS sysmond service disappeared on the hub's machine. `pgrep` then printed "sysmon request failed with error: sysmond service not found" and "pgrep: Cannot get process list" on stderr, with no output, and exited 0, while `ps -A` kept working. The hub calls pgrep in `hub/src/suite-lock.ts`, `hub/src/git-maintenance-owner.ts` and `hub/src/system-processes.ts`. Within seconds, three remote runs' streams stopped (17:26:25Z) and were declared "remote machine lost" at 17:31:32Z. The next batch failed at start, and the executor showed `watchdog=dead` on a 1-second-old droplet. A host tool failing must read as "unknown", never as "no processes".

## What to build

Every pgrep caller treats any stderr output, or a known failure message, as a failed inspection, whatever the exit code. Liveness and ownership decisions then keep the current state, and name the cause as "process inspection unavailable", instead of concluding that processes are absent. Prefer a `ps`-based fallback where it exists. Rule 20: list every pgrep, ps and process-listing caller and the decisions each feeds.

## Acceptance criteria

- [ ] C1. With a fake pgrep that writes the sysmond error to stderr and exits 0, a running remote run keeps its lease and stream, and no watchdog or owner is declared dead (test, red before the fix).
- [ ] C2. The same fake makes suite-lock and git-maintenance owner checks report "process inspection unavailable" without releasing or reclaiming anything, and a genuinely empty pgrep result still behaves as today (test).
