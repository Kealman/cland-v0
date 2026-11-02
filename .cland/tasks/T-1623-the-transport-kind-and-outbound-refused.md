---
id: T-1623
kind: task
title: The transport kind, and outbound refused
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:34:18.244Z
updated: 2026-11-02T03:34:47.602Z
---

## Summary

One module declares the transport kind, with `ssh` as the only value 0.4.0 accepts, and one parser that every reader of a transport kind uses. A `transport` in any `[hosts.<pool>]` table is checked at hub start and reload. `outbound` is refused with a message naming 0.4.x, and any other value with a message naming `ssh`.

Hot files: new `hub/src/host/transport-kind.ts` [E-1532 and E-1533 import it], `hub/src/init/config.ts` [E-1534 owns `[hosts]`; one interim call only]

## Acceptance criteria

- [ ] C1. A transport kind type with `ssh` as its only member lives in one module, with one parser that every place reading a transport kind uses (test).
- [ ] C2. `transport = "outbound"` in any `[hosts.<pool>]` table is refused at hub start and at `cland hub reload` through the existing config refusal, with a message naming 0.4.x (test).
- [ ] C3. Any other transport value is refused with a message naming `ssh` as the only value 0.4.0 accepts (test).
- [ ] C4. `transport = "ssh"`, or a pool without `transport`, is accepted, and the rest of a `[hosts]` table is read as today (test).

## Notes

Shared files: see Hot files
