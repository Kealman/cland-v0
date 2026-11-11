---
id: T-1817
kind: task
title: login-metadata-owners test helper closes the borrowed Store even when hub.stop rejected
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
created: 2026-11-11T19:29:02.179Z
updated: 2026-11-11T19:29:02.179Z
---

## Summary

impl-1791 found in source (topic-1480, 2026-11-11 19:28Z; not a reproduced failure) that the shared test helper `hub/test/login-metadata-owners.ts` calls the borrowed `Store.close` even when `hub.stop` rejected. Its directory guard keeps the fixture root, but the storage the failed hub join still owns is closed underneath it, so a fault test can lose the evidence it means to keep or race a still-running owner. T-1791's new fixture uses phased Gateway → hub → Store ownership instead and leaves this helper unchanged.

## What to build

Make the helper's teardown phased: when `hub.stop` rejects, keep the Store open and owned (retaining root and storage together), report the failed join, and close the Store only after a positive hub stop.

## Acceptance criteria

- [ ] C1. A fixture whose hub stop rejects leaves its Store open and its root retained, and reports the rejection (test).
- [ ] C2. A normal stop still closes the Store after the hub and removes the root (test).
- [ ] C3. Every existing consumer of the helper passes unchanged (test).
