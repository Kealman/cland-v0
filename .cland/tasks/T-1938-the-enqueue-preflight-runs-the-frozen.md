---
id: T-1938
kind: task
title: The enqueue preflight runs the frozen CLI usage compatibility test on the head merged with dev
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-17T08:28:33.210Z
updated: 2026-11-17T08:28:33.210Z
---

## Summary

The human approved (General, 2026-11-17 08:27Z, rule batch A-20783) adding `hub/test/cli-usage-compatibility.test.ts` to the check an item passes before enqueue. On 2026-11-17 three items (T-1630, T-1931, T-1869) failed late on the frozen help fixture `hub/test/fixtures/cli-usage/commands.json`, even after the instruction was added to briefs. Until then the Coordinator runs it in its own rule 36 preflight. This item moves it into the hub's enqueue preflight (H-13), beside the whole-source lints.

## Acceptance criteria

- [ ] C1. `cland merge` refuses to enqueue a head whose merge with current dev fails cli-usage-compatibility.test.ts, naming the test and the first differing export (test).
- [ ] C2. A head that passes is enqueued as today, and the check's duration shows in the enqueue receipt (test).
