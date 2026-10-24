---
id: T-1189
kind: task
title: "Production dependency advisories: zod below 4.6.6 (high) and ip-address 10.7.3 (moderate)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1192
blocked_by: []
topic: null
branch: t/T-1189-production-dependency-advisories-zod
created: 2026-10-23T21:49:58.684Z
updated: 2026-10-24T06:31:15.452Z
---

## Summary

`npm audit --omit=dev` on dev (2026-10-23, reported by impl-1185) lists two production advisories:
- **zod 4.5.4** (high, GHSA-mrhx-c7xc-m3w5): memory exhaustion when validating oversized constrained collections. The fix is in 4.6.6 or later, outside the current range.
- **ip-address 10.7.3** (moderate, GHSA-rxp7-6hxx-x8q5): quadratic zone-identifier matching. `npm audit fix` resolves it.

Changing dependency versions needs the human's approval (AGENTS.md).

## What to build

With the human's approval:
- Raise zod to a fixed version, either by moving the hub workspace's range or the parent package that pins it.
- Refresh ip-address through `npm audit fix`.
- Check whether the hub validates input that an outside client could make oversized before its frame caps apply.

## Acceptance criteria

- [ ] C1. `npm audit --omit=dev` reports no high or moderate advisory, and the full suite stays green (test).
