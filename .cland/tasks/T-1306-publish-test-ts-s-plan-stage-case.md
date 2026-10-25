---
id: T-1306
kind: task
title: publish.test.ts's plan-stage case commits the root before the plan's status write lands
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1281
blocked_by: []
regression_of: T-1276
found_by: cover
topic: null
branch: null
created: 2026-10-25T14:03:43.066Z
updated: 2026-10-25T14:04:12.360Z
---

## Summary

`hub/test/publish.test.ts` "a task published through cland publish counts as merged and closes its plan stage" (from T-1276) failed in the Linux stage cover 5689e281 (A-11990) at dev 31e63e92 with `cland: publish-state: publish needs a clean project root on dev` (exit 1). It passes 9/9 locally on macOS (plain, with CLAND_TEST_SOAK=1, and as the whole file). Cause, from reading the test: `task plan set` makes the fixture hub move the task to `planned` and write its tracker file asynchronously; the test's `clean(root)` commit can run before that write, leaving the root dirty when `cland publish` checks it. On the slower Linux droplet the write lands after `clean`.

Fix the test, not the product: after `task plan set`, wait on the task's `planned` status (or the tracker write receipt) before `clean(root)`.

## Acceptance criteria

- [ ] C1. The case waits for the plan's status write before committing the root, with its assertions unchanged; it passes in the item's mode-free verify on the Linux droplet and 5/5 locally, and a negative control that commits before the status write fails with the dirty-root refusal.
