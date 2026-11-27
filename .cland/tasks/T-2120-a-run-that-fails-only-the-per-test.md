---
id: T-2120
kind: task
title: A run that fails only the per-test duration budget exits 1 with an empty structured cause in result.json
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
created: 2026-11-27T11:44:42.898Z
updated: 2026-11-27T11:44:42.898Z
---

## Summary

T-2003's verify 85d1bc80 (A-23797, 2026-11-27) exited with code 1 and `cause: ""`. It had 9,368 passes and no failures ("suite test failures []"). The only failure was a tier-level duration-budget line: `duration budget: hub/test/executor-run.test.ts::remote delivery keeps submitted source despite later tracked writes 7.337 s > 5 s (add to hub/test/durations.json with a reason)`. Readers had to search a 54,000-line log to find why the run failed. Rule 39 requires the outcome to come from the owner's structured receipt.

## What to build

When a tier fails only on the duration budget or allowance gate, set a structured cause in result.json (for example `duration budget: <identity> <seconds> s > <budget> s`) and show it in the hub's suite result message.

## Acceptance criteria

- [ ] C1. A run whose only failure is a new identity over the duration budget records a non-empty structured cause naming the identity, its measured time and the budget, and the suite result message shows that cause (test with fakes).
