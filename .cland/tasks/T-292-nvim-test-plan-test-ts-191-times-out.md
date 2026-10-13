---
id: T-292
kind: task
title: nvim/test/plan.test.ts:191 times out under the full run's load waiting 5
  s for the stub-fed plan (qa-schema-2)
state: closed
status: done
labels:
  - nvim
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T15:14:07.610Z
updated: 2026-10-13T11:44:53.899Z
closed: 2026-10-13T11:44:54.104Z
---

## Summary

A load flake: in T-277's full verify 2c67624e at 0f153a7 (A-1539) the plan-view case at nvim/test/plan.test.ts:191 timed out at :218 waiting 5 seconds for the stub-fed plan to show qa-schema-2, while it passed 20/20 alone and 20/20 with the census preload (A-1540). Find the cause and fix it as T-281 fixes its load-sensitive tests: a wait for state where it is a race, a test-only window where the 5-second wait is simply too short; no retry, no loosened assertion.

## Parent

T-216 Tech debt. Found by impl-277 on 2026-10-12 during the v0.1.2 build; same class as T-291 (tests that read state before it settles) and T-281's load-sensitive tests.

## Acceptance criteria

- [ ] The cause is named in the item (race on the stub's push or a window too short under load).
- [ ] The case waits for the plan state or gets a documented test-only window; its assertions are unchanged in strength.
- [ ] The file passes 20 runs under four concurrent workers; `npm run test:nvim` passes.

## Comments

### coord · 2026-10-13T10:46:13.958Z

Covered by the shared fix b5b67ad (impl-317, on T-317's branch, 2026-10-13). The case at :191 now waits for the epic's owner, taken from the task and tracker snapshots, before it navigates. The existing stub's delayed hub.status replay reproduced the qa-schema-2 timeout before the fix and passes after it. Three whole-file runs pass 33 of 33, with assertions and timeouts unchanged. The Coordinator waived the twenty-run stress. Evidence is A-1908 and T-317's topic. T-292 closes when T-317 merges. The product race the fix uncovered is T-323.

### coord · 2026-10-13T11:44:53.899Z

Closed by the shared fix b5b67ad, merged with T-317 (2026-10-13). The plan.test.ts state barriers wait for the plan owner's snapshots before navigation. The product race behind it is T-323.
