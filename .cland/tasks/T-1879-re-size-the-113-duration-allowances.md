---
id: T-1879
kind: task
title: Re-size the 113 duration allowances renewed on 2026-11-16 from the v0.4.0 release logs
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
created: 2026-11-16T07:04:58.109Z
updated: 2026-11-16T07:04:58.109Z
---

## Summary

113 duration allowances (109 owned by C-216 and 4 by E-880) were due to expire on 2026-11-18 at 00:00 UTC. An expired allowance makes manifest validation throw (`expired duration allowance …`, `hub/src/suite-durations.ts`), which would fail every suite. On 2026-11-16 the Coordinator renewed their dates only (added 2026-11-16, expires 2026-11-23) and left their sizes unchanged, with a renewal note in each reason. This item re-sizes them from evidence.

## What to build

For each renewed allowance, read the slowest passing Linux sample in the v0.4.0 release-period logs: the release suite A-19794, the stage covers A-19785 and A-19789, the soak A-19799 (partial) and recent batch logs. Then either:
- set the allowance to about 1.5× that sample, with owner C-216, at most 7 days, and a reason naming the sample;
- or drop it when the test now fits its tier default.

Do it with the hub's duration tooling rather than by hand where it supports this. The T-931 decision on allowance refresh applies.

## Acceptance criteria

- [ ] C1. Every renewed allowance is re-sized or removed from a named log sample, and `npm run test:tiers` and the manifest validation pass (test).
- [ ] C2. Before the next expiry, no allowance relies on the renewal note alone (test).
