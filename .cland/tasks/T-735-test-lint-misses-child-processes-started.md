---
id: T-735
kind: task
title: Test lint misses child processes started through wrapped calls such as promisify(execFile)
state: open
status: in progress
size: XS
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-446
branch: t/T-735-test-lint-misses-child-processes-started
created: 2026-10-17T11:42:54.922Z
updated: 2026-10-17T15:13:55.602Z
---

## Summary

impl-704 found (T-704, 2026-10-17) that the report-only test lint says `hub/test/tracker-criterion-crash.test.ts` "qualifies T2" although `promisify(execFile)(process.execPath, …)` launches a real SIGKILL writer. The file stays T3 by its header, but a lint that refuses from T-684 onward must not under-report process use, or files get retagged too low.

## What to build

The lint follows `node:child_process` imports through common wrappers: `promisify(execFile)`, `util.promisify`, renamed and destructured imports, and helper re-exports inside the same file. A wrapped spawn counts as process use exactly like a direct one.

## Acceptance criteria

- [ ] C1. Planted files that start a child through `promisify(execFile)`, a renamed import and a destructured import each produce the process-use finding, proved by lint tests, and tracker-criterion-crash.test.ts no longer qualifies below T3.
- [ ] C2. The review request lists every dev file whose "qualifies" tier changes, with the reason.
