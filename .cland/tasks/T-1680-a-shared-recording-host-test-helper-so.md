---
id: T-1680
kind: task
title: A shared recording-Host test helper so Host doubles stay coherent when Host operations are added
state: open
status: planned
size: M
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-04T16:28:22.539Z
updated: 2026-11-17T23:14:14.711Z
---

## Summary

E-1532 stage 4 and stage 5 lost many verify and batch cycles to inline recording or observer Host doubles in hub/test that remap some Host operations and inherit others unmapped from `localHost` or the test Host:
- T-1644: `stat`;
- T-1606: `realpath`;
- T-1607: `launchClaude` and `adopt`;
- T-1605: the observation stream;
- T-1611: `publishFile`, a blanket read refusal, and a missing synthetic exit receipt.

Manual field-by-field sweeps kept missing one more. Proposed by impl-1611.

## What to build

A shared test helper that builds a recording Host from one scratch storage root and a set of scoped fault overrides. Every file-boundary operation (`publishFile`, `appendFile`, `writeFile`, `readFile`, `stat`, `realpath`, `makeDirectory`, `remove`) and the stop/exit receipt are redirected coherently. A contract check fails when the Host interface gains an operation that the helper does not map. Migrate the existing inline doubles to it, with every assertion unchanged.

## Acceptance criteria

- [ ] C1. The helper maps every file-boundary Host operation and the stop/exit receipt into one scratch root, and a contract test fails if a Host operation is added without a mapping (test).
- [ ] C2. The inline recording Hosts in hub/test are migrated to the helper with every test assertion unchanged, and their files pass (test).
