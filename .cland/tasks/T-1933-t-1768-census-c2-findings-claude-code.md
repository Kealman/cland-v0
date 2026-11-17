---
id: T-1933
kind: task
title: "T-1768 census C2 findings: claude-code-schedule lock caller, codex-remote process cleanup and host fixture lock probes still make native calls in T2"
state: open
status: planned
size: M
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-17T04:43:27.159Z
updated: 2026-11-17T23:14:16.116Z
---

## Summary

Split from T-1915 (A-20619). T-1768's enforce census found native calls in T2 fixture paths that are independent of the `nativeIdentityProjectHub` opt-ins. These cover the claude-code-schedule lock caller, codex-remote process cleanup, and the host fixture lock probes, along with their common-stack consumers such as pool-scale and session-host-routing.

## Evidence (historical stacks from A-20205, carried in A-20619)

- claude-code-schedule: `T2 forbids child_process.spawn`. Case: `upgrade restart adopts persisted legacy Claude rows without generation on spoke hook and bridge`. Path: tier-tripwire → host/agent/command.ts run → hub/lock.ts:80 → hub/lock.ts:98.
- codex-remote: `T2 forbids child_process.execFileSync`. Case: `remote Codex frame launch uses a session forward and host sandbox paths`. Path: process-cleanup.ts processes:43 → rememberResultProcesses:181 → harness.ts:720.
- Host lock probes: host-relaunch-component, host-status, host-sto… (A-20619 has the exact cases and stacks).
- The census also has Git, web-build and CLI-launch findings outside these groups. This item does not cover them; A-20205 keeps them.

## Acceptance criteria

- [ ] C1. Reproduce each named finding at the current dev head under the T2 tripwire, or record that it no longer reproduces, with the run quoted.
- [ ] C2. Each reproduced path gets a hermetic seam, or its file moves to T3 with a recorded reason, and its case then passes the enforce-mode tripwire with no native call (test).
- [ ] C3. Any remaining census finding outside these groups is filed with its case and stack, or named as out of scope with a reason.
