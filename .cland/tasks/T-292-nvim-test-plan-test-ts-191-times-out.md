---
id: T-292
kind: task
title: nvim/test/plan.test.ts:191 times out under the full run's load waiting 5 s for the stub-fed plan (qa-schema-2)
state: open
status: backlog
labels:
  - nvim
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T15:14:07.610Z
updated: 2026-10-12T15:14:07.610Z
---

## Summary

A load flake: in T-277's full verify 2c67624e at 0f153a7 (A-1539) the plan-view case at nvim/test/plan.test.ts:191 timed out at :218 waiting 5 seconds for the stub-fed plan to show qa-schema-2, while it passed 20/20 alone and 20/20 with the census preload (A-1540). Find the cause and fix it as T-281 fixes its load-sensitive tests: a wait for state where it is a race, a test-only window where the 5-second wait is simply too short; no retry, no loosened assertion.

## Parent

T-216 Tech debt. Found by impl-277 on 2026-10-12 during the v0.1.2 build; same class as T-291 (tests that read state before it settles) and T-281's load-sensitive tests.

## Acceptance criteria

- [ ] The cause is named in the item (race on the stub's push or a window too short under load).
- [ ] The case waits for the plan state or gets a documented test-only window; its assertions are unchanged in strength.
- [ ] The file passes 20 runs under four concurrent workers; `npm run test:nvim` passes.
