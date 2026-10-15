---
id: T-544
kind: task
title: "session-model test: sub-agent usage rows in task view arrive in hook order, not agent order (Linux)"
state: open
status: in progress
size: XS
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-480
topic: topic-335
branch: t/T-544-session-model-test-sub-agent-usage-rows
created: 2026-10-15T22:41:39.095Z
updated: 2026-10-15T22:42:54.394Z
---

## Summary
E-387 stage-close cover 725bd529 at dev 21ae664d (2026-10-15 22:40Z; shard-1 cland-v0-7f8dcbd7, peak load 9.9; log A-3413) failed in `hub/test/session-model.test.ts`, 'launched Claude sub-agents retain their parent role and launch item through real hook commands'. That's T-480's new case, merged at 22:26Z. The journal assertion sorts by agentId. The `task view` usage assertion (`usage.subagents` deepEqual) doesn't, and the two SubagentStart hooks can journal in either order: the run saw unknown-child before known-child.

## Acceptance criteria
- [ ] C1. The usage assertion compares the sub-agent rows in a defined order: sorted by agentId in the test, or the hub orders `usage.subagents` deterministically by start time then agentId and the test relies on that. Every row's fields are still asserted.
- [ ] C2. session-model.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-544 · 2026-10-15T22:42:54.394Z

Implementation plan: normalize task-view sub-agent usage rows by agentId in the existing assertion. Preserve both rows and all five asserted fields. Evidence: five serial whole-file Mac passes labelled with load, followed by source review and same-head droplet verification.
