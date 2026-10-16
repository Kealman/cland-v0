---
id: T-574
kind: task
title: task-prefixes "removing a planned legacy epic" test races the plan recompute and fails often on dev
state: open
status: review
size: S
criterion_seq: 2
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
updated: 2026-10-16T05:29:45.960Z
---

## Summary
hub/test/task-prefixes.test.ts:200, "removing a planned legacy epic drops its candidate; prefix renames preserve a live plan", expects `plan: null` for a replacement epic with an invalid plan, but gets the removed epic's earlier plan (stage "build", lane T-2). T-296's Linux run 033386f2 hit it (A-3733, lines 4351–4375). On a quiet Mac on 2026-10-16 the Coordinator saw:
- dev 9b415c1e: 3/3 fail;
- eee3fd1d: 1/1 fail, although its Linux cover passed;
- 8aff7b26, d8e43644 and c3a04cce: fail;
- a06020a3, 50a94688, 8b5fe173 and b214d3d3: pass.
So it's a race with a high failure rate, not one breaking commit. The test reads the plan right after the item becomes visible again (`eventually('replacement epic is indexed')`). Either the plan for a re-created id is served from state kept from the removed item, or it's recomputed after the item is published. Under the shared-fix rule this is a dev defect.

## Acceptance criteria
- [x] C1. Find whether a removed epic's plan or candidate state outlives its file (product) or the test reads before a defined recompute point (test), fix that cause, and record it on this item. If the product serves a stale plan for a re-created id, fix the product.
  - done: impl-574 · 2026-10-16T05:28:02.337Z
- [ ] C2. task-prefixes.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet in the task's verify; the fix is posted as a shared fix.

## Comments

### impl-574 · 2026-10-16T05:27:42.124Z

Diagnosis: this is an observation-boundary race in the test, not retained state surviving an indexed removal. Exact isolated test failed 3/3 probes at 9b415c1e. At the old eventually('epic removal is indexed') boundary, task.view returned false because its file read hit ENOENT, while an immediate task.list still contained E-1 with the old build/T-2 plan. Journal had no removal for E-1-epic.md. Recreating the file before the debounced watcher sees absence is an invalid hand edit to a still-indexed item; retaining its last accepted plan is intentional (#planState). Tracker #dropFile already clears the index plan and candidate synchronously before #changed publishes removal. Fix waits for E-1 to disappear from task.list (the indexed publication boundary) before recreating it. The final strict null-plan assertion and rename-plan assertion remain unchanged; they continue detecting real cleanup regressions. No product relaxation.
