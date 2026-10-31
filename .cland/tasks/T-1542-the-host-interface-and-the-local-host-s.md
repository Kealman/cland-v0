---
id: T-1542
kind: task
title: The Host interface and the local host's process operations
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by: []
topic: null
branch: null
created: 2026-10-31T23:47:40.429Z
updated: 2026-10-31T23:48:13.122Z
---

## Summary

Declare the Host interface with its process operations: a detached spawn with an environment and a working directory, a short command with its output, birth identity, liveness, stop of a process tree by birth identity, and the process table with memory and CPU per tree. The `local` host implements them by delegating to today's functions, and a reusable contract suite, parametrised by a Host factory, runs against it.

Hot files: `hub/src/host/host.ts` (new), `hub/src/host/local.ts` (new), `hub/test/host-contract.ts` (new), `hub/test/host-local-contract.test.ts` (new); possibly `hub/src/process-table.ts` (the `ps` columns for RSS and CPU)

## Acceptance criteria

- [ ] C1. `hub/src/host/host.ts` exports an interface `Host` with `name` and the operations spawn, run, identity, alive, stop and processes, under the hub's tsconfig, with no enum, namespace, parameter property or new dependency.
- [ ] C2. A contract suite in `hub/test/host-contract.ts` takes a Host factory, has at least one case per operation, and the `local` host passes every case (test).
- [ ] C3. The spawn case shows a child in its own session and process group that gets the given environment and working directory, outlives the caller's handle, and carries no environment value in its argv (test).
- [ ] C4. The liveness and stop cases show that a reused pid with another birth identity is not alive and is never signalled, and that a row with only a legacy `pid_started` keeps today's answer (test).
- [ ] C5. The processes case reports, for a spawned parent with a child, the resident memory and CPU of the whole tree under the parent's pid (test).
- [ ] C6. The `local` host's identity, alive and stop delegate to `processIdentityAsync`, `processAlive`, `sameProcess` and `endProcess`, and `process-identity.test.ts`, `system-processes.test.ts` and `session-async-processes.test.ts` pass with no test edited.
