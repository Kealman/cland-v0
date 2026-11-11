---
id: T-1816
kind: task
title: startServer's port retry spins without bound when freePort keeps returning an already-attempted port
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-11T18:14:27.445Z
updated: 2026-11-11T18:14:46.091Z
---

## Summary

impl-1794 found (topic-1481, 2026-11-11 18:14Z) that `startServer` tracks attempted ports and does `if (attempted.has(port)) continue`. When `host.freePort` returns the same port again (a native test fixture pinned it to 12345), the loop spins on resolved promises without ever yielding a bound, until Node fails with `RangeError: Map maximum size exceeded` from the async-hook continuation map after about 30 s. The fixture is being fixed in T-1794; the loop itself has no attempt bound, so a freePort that repeats a port turns into a hub crash instead of a typed launch failure.

## What to build

Bound the retry: a fixed, named number of attempts (or a repeated-port refusal), after which the launch fails with a typed error naming the port; never a busy loop.

## Acceptance criteria

- [ ] C1. A freePort that always returns an attempted port makes `startServer` fail within its named attempt bound with a typed error naming the port (test).
- [ ] C2. An address-in-use followed by a fresh port still succeeds on the next attempt (test).

## Comments

### coord · 2026-11-11T18:14:46.091Z

Exact location from impl-1794: OpenCode `startServer` in `hub/src/adapters/opencode/server.ts:74` (`if (attempted.has(port)) continue`), producing more than 16M async-hook continuations and the RangeError before its 30 s deadline. Triggered by T-1794's native fixture's constant freePort after a socket collision; the fixture fix stays in T-1794.
