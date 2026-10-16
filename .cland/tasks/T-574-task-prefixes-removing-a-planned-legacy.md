---
id: T-574
kind: task
title: task-prefixes "removing a planned legacy epic" test races the plan recompute and fails often on dev
state: open
status: in progress
size: S
labels:
  - bug
  - hub
  - flaky
  - v0.1.3
assignee: null
parent: E-482
blocked_by: []
topic: topic-358
branch: t/T-574-task-prefixes-removing-a-planned-legacy
created: 2026-10-16T05:25:32.740Z
updated: 2026-10-16T05:26:02.397Z
---

## Summary
hub/test/task-prefixes.test.ts:200, "removing a planned legacy epic drops its candidate; prefix renames preserve a live plan", expects `plan: null` for a replacement epic with an invalid plan, but gets the removed epic's earlier plan (stage "build", lane T-2). T-296's Linux run 033386f2 hit it (A-3733, lines 4351–4375). On a quiet Mac on 2026-10-16 the Coordinator saw:
- dev 9b415c1e: 3/3 fail;
- eee3fd1d: 1/1 fail, although its Linux cover passed;
- 8aff7b26, d8e43644 and c3a04cce: fail;
- a06020a3, 50a94688, 8b5fe173 and b214d3d3: pass.
So it's a race with a high failure rate, not one breaking commit. The test reads the plan right after the item becomes visible again (`eventually('replacement epic is indexed')`). Either the plan for a re-created id is served from state kept from the removed item, or it's recomputed after the item is published. Under the shared-fix rule this is a dev defect.

## Acceptance criteria
- [ ] C1. Find whether a removed epic's plan or candidate state outlives its file (product) or the test reads before a defined recompute point (test), fix that cause, and record it on this item. If the product serves a stale plan for a re-created id, fix the product.
- [ ] C2. task-prefixes.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet in the task's verify; the fix is posted as a shared fix.
