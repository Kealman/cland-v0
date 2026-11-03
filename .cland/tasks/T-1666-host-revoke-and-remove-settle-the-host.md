---
id: T-1666
kind: task
title: Host revoke and remove settle the host agent's session generations first, or name what they leave
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1607
  - T-1606
  - T-1603
topic: null
branch: null
created: 2026-11-03T22:56:19.713Z
updated: 2026-11-03T22:56:22.608Z
---

## Summary

Revoking or removing a host currently cuts its authority before any later Host call, so detached session workers survive and the agent's per-generation state is left on the host: launch records, released receipts and private config files. Revoke and remove should first settle every generation on that host through the agent's own cleanup operations, or report by name each generation they could not settle.

## What to build

Before the authority cut, revoke and remove run a bounded pre-revoke step through the still-authorised Host:
- they stop the live sessions on that host;
- they release and forget each released or cleanup-incomplete generation, using the agent operations from T-1607;
- they then cut authority.

A step that cannot finish within its deadline still cuts authority. Its report names each generation left behind and what remains: a worker, a receipt or private files. Nothing is cleaned through a revoked Host.

Found during T-1607 (coord decision 2026-11-03).

## Acceptance criteria

- [ ] C1. Revoking a host with a live Claude, Codex and OpenCode session stops each one and leaves no launch record, receipt or private config file on the host (test, fake host).
- [ ] C2. When the pre-revoke step cannot reach the agent, revoke still cuts authority within its deadline, and its output names each generation it left and what remains (test).
- [ ] C3. No Host call reaches the agent after the authority cut (test).
