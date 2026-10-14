---
id: T-373
kind: task
title: "Executor interface: declare prepare and reap so the droplet backend implements all nine operations"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-14T03:43:39.962Z
updated: 2026-10-14T03:43:39.962Z
---

## Summary

The droplet backend implements 7 of the executor interface's 9 operations through `Executor`: acquire, deliver, start, status, log, cancel and release. `prepare` and `reap` keep backend-specific signatures behind `cland executor`. Unify them, so a second backend (MicroVMs, then Fly Machines) plugs in through the interface alone.

## Context

E-271's DoD C1 was accepted on this reading by the stand-in under D24 on 2026-10-14 (comment on E-271). The interface lives under `hub/src/executor/`.

## Acceptance criteria

- [ ] C1. `prepare` and `reap` are declared on the `Executor` interface with backend-neutral arguments and results, and `DropletExecutor` implements the whole interface without `Pick<Executor, …>`.
- [ ] C2. The local executor implements both as no-ops returning a typed "not applicable" result, and the existing executor tests pass unchanged.
