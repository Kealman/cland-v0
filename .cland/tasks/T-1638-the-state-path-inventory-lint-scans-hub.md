---
id: T-1638
kind: task
title: The state-path inventory lint scans hub source within its T1 budget
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1621
topic: null
branch: null
created: 2026-11-02T17:05:38.472Z
updated: 2026-11-16T07:29:07.173Z
---

## Summary

`hub/test/state-paths-lint.test.ts` "hub source conforms to the named state path inventory" took 8.459 s on a Linux droplet in stage cover cd742656 (A-15910), against its 5 s T1 budget. Other runs are 1.1–2.2 s. T-1636 added a dated 13 s allowance owned by C-216 that expires 2026-11-09. Before then the scan must fit the budget, and the allowance must be removed.

## What to build

Bound the lint's work: read only the source files the inventory names or can reach, parse each file once, and share the parsed result across assertions, so wall time no longer scales with the whole of hub/src.

## Acceptance criteria

- [ ] C1. The lint test runs under 5 s on the Linux droplet in three samples, recorded in the item (test).
- [ ] C2. The T-1636 allowance for this identity is removed from `hub/test/durations.json`.
- [ ] C3. The lint still fails a planted unnamed per-user state path (test).
