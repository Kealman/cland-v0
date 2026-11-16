---
id: T-1660
kind: task
title: Transport.kind is typed as the literal 'ssh', so a second carrier must change the shared contract type
state: open
status: backlog
size: XS
labels: []
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1625
topic: null
branch: null
created: 2026-11-03T08:38:44.056Z
updated: 2026-11-16T07:29:12.692Z
---

## Summary

Found while writing the E-1538 stage-2 QA brief. `Transport.kind` in `hub/src/transport/transport.ts` is declared as the literal `'ssh'`, not as `TransportKind`. T-1625's contract suite checks the kind only at runtime (C6). A 0.4.x `outbound` carrier would have to change the shared type before it could even compile, which works against T-1625's aim that a second carrier passes the same suite unchanged.

## What to build

Type `Transport.kind` as `TransportKind`, keep `'ssh'` as its only current member, and have the contract suite check the kind through that type. The members and their order don't change (T-1595's approved decisions).

## Acceptance criteria

- [ ] C1. `Transport.kind` is `TransportKind`; a typecheck fixture shows a carrier with a new `TransportKind` member compiles against the unchanged contract types, and an unknown kind is still refused at runtime (test).
