---
id: T-743
kind: task
title: "Test lint misses sockets bound by constructors such as new WebSocketServer({ port: 0 })"
state: open
status: backlog
size: XS
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: null
branch: null
created: 2026-10-17T16:00:31.334Z
updated: 2026-10-17T16:00:31.334Z
---

## Summary

impl-690 found (T-690, 2026-10-17) that the test lint says `hub/test/spoke-readiness.test.ts` qualifies T1, although it creates `new WebSocketServer({ port: 0 })` and uses real sockets. The socket rule only checks `.listen(...)` calls, so a constructor that binds a port goes unseen. Once T-684 makes the lint refuse, this would let socket tests sit at T1.

## What to build

Count servers bound at construction as socket use, the same as `.listen`: `ws` WebSocketServer with a port or server option, `net.createServer(...).listen` chains and http(s) createServer. Keep the inert-data negatives.

## Acceptance criteria

- [ ] C1. A planted T1 file constructing `new WebSocketServer({ port: 0 })` gets the socket finding, an inert string mentioning it doesn't, and spoke-readiness.test.ts no longer qualifies T1, proved by lint tests. The review request lists every dev file whose qualification changes.
