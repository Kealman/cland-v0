---
id: T-1683
kind: task
title: A local Codex app-server stop can resolve before its child is reaped (T-1673 pattern)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: t/T-1683-a-local-codex-app-server-stop-can
created: 2026-11-05T02:01:43.900Z
updated: 2026-11-05T03:24:07.138Z
---

## Summary

A local Codex app-server launch reads `child.exited` only during startup and drops the child-exit receipt after a successful launch. Its stop then joins only `Host.stop`, so a stop can resolve while the server is an unreaped zombie. This is the same gap T-1673 found and fixed for OpenCode.

## What to build

Apply T-1673's pattern to the local Codex app-server:
- keep the successful launch's child-exit receipt;
- after `Host.stop`, join that receipt within the same bounded settlement deadline;
- when the deadline passes, report the stop as `cleanup-incomplete`, never settled;
- recovered or adopted servers without a captured receipt keep their current confirmation path.

Found by impl-1673 during T-1673 (2026-11-05).

## Acceptance criteria

- [ ] C1. With the child-exit receipt held, stopping a local Codex session does not resolve until the receipt arrives, and the server pid is dead when it does (test, held receipt).
- [ ] C2. A held receipt past the settlement deadline ends the stop as cleanup-incomplete and never as settled; a late exit allows a retry (test, fake timers).
- [ ] C3. A recovered or adopted Codex server without a captured receipt stops through its existing confirmation path unchanged (test).
