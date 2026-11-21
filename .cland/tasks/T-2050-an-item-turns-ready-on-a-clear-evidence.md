---
id: T-2050
kind: task
title: An item turns ready on a clear evidence verdict while its same-head verify is still launching, with no result
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-21T08:26:55.956Z
updated: 2026-11-21T08:26:55.956Z
---

## Summary

On 2026-11-21 at 08:26:37Z, T-1983 changed review → ready while its only verify, run 6532e3ef at 44e58b48f, was in state `launching` with `result: null`. The run was admitted 08:26:28Z. Both verdicts on the item were clear at that head: the source review, and the final evidence review on the C2 campaigns. So ready rested on the review verdicts alone, before any suite result existed at the head. The Coordinator reads ready as "verified and mergeable" (rule 7 already asks for a head check), and an enqueue on this ready would merge without the item's own suite result.

## What to build

The ready transition requires a green same-head verify result for items whose flow includes `cland verify`, or an explicit verification disposition. A verify in flight keeps the item in review. Find out whether the hub counted the in-flight run, or a cached earlier run, as satisfying the gate.

## Acceptance criteria

- [ ] C1. With clear review verdicts and a same-head verify in `launching` or `running` state, the item stays in review; it turns ready only when that run finishes green (test, red before).
- [ ] C2. A red or cancelled same-head run keeps the item out of ready (test).

Evidence: T-1983's task.view at 08:26Z shows status ready with `verify: {id: 6532e3ef…, state: "launching", result: null, head: 44e58b48f}`.
