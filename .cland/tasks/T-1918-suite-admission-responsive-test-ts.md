---
id: T-1918
kind: task
title: suite-admission-responsive.test.ts awaits the fake executor-entry setup without its own named local bound
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: null
branch: null
created: 2026-11-16T16:19:25.881Z
updated: 2026-11-24T09:01:13.261Z
---

## Summary

impl-1907 and the T-1907 final review (A-20239, nonblocking) found that `hub/test/suite-admission-responsive.test.ts` (around line 30) awaits the fake `LocalExecutor.start` entry receipt under the admission and output setup's wait, with no separately named bound. If that entry never comes, the file fails only at a broader bound, and the failure doesn't name the step.

## Acceptance criteria

- [ ] C1. The fake executor-entry receipt has its own named load-scaled bound, independent of the admission and output setup, and a held entry fails with that bound's name (test, red before the fix).
