---
id: T-556
kind: task
title: The new-test load gate can't match suite-runner tests with dynamic names (0/5 repetitions)
state: open
status: in progress
size: S
labels:
  - bug
  - hub
assignee: null
parent: E-482
blocked_by: []
regression_of: T-471
topic: topic-350
branch: t/T-556-the-new-test-load-gate-can-t-match-suite
created: 2026-10-16T01:06:55.783Z
updated: 2026-10-16T01:14:40.514Z
---

## Summary
In T-533's local verify bbfee74e (2026-10-16 ~01:05Z; log A-3523), the T-471 load gate reported 0/5 for suite-runner tests with dynamic names. A test whose name embeds a generated value (a path, id or time) gets a new identity on every repetition, so the gate's five repetitions never match the first identity. T-533 doesn't touch those tests. It's a sibling of T-546, which covers skipped new tests.

## Acceptance criteria
- [ ] C1. Identify the dynamic-name suite-runner tests. Either give them stable names (preferred, test-only), or make the load gate match repetitions by file plus a normalized name, and record which.
- [ ] C2. A branch touching suite-runner passes the load gate with 5/5 matched repetitions, shown by a test or a recorded run.

## Comments

### impl-556 · 2026-10-16T01:14:40.514Z

Coordinator decision: test-only stable-name fix, no load-gate implementation changes. Auditing runtime-generated names across hub/test and nvim/test. Existing runner CLI seam will supply before/after name matching and five serial whole-file Mac receipts; post-review verify supplies load-gate Linux evidence.
