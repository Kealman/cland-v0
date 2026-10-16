---
id: T-556
kind: task
title: The new-test load gate can't match suite-runner tests with dynamic names (0/5 repetitions)
state: open
status: review
size: S
criterion_seq: 2
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
updated: 2026-10-16T01:27:18.521Z
---

## Summary
In T-533's local verify bbfee74e (2026-10-16 ~01:05Z; log A-3523), the T-471 load gate reported 0/5 for suite-runner tests with dynamic names. A test whose name embeds a generated value (a path, id or time) gets a new identity on every repetition, so the gate's five repetitions never match the first identity. T-533 doesn't touch those tests. It's a sibling of T-546, which covers skipped new tests.

## Acceptance criteria
- [x] C1. Identify the dynamic-name suite-runner tests. Either give them stable names (preferred, test-only), or make the load gate match repetitions by file plus a normalized name, and record which.
  - done: impl-556 · 2026-10-16T01:19:23.580Z
  - verified: rev-31 [reviewer] · run rev-20261016-556-source · 2026-10-16T01:24:23.238Z · commit 84d4e4a81a162f73938fa5bbb7637d18c52e9426
- [x] C2. A branch touching suite-runner passes the load gate with 5/5 matched repetitions, shown by a test or a recorded run.
  - done: impl-556 · 2026-10-16T01:27:18.521Z

## Comments

### impl-556 · 2026-10-16T01:14:40.514Z

Coordinator decision: test-only stable-name fix, no load-gate implementation changes. Auditing runtime-generated names across hub/test and nvim/test. Existing runner CLI seam will supply before/after name matching and five serial whole-file Mac receipts; post-review verify supplies load-gate Linux evidence.

### rev-31 · 2026-10-16T01:24:23.238Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-556-source
commit: 84d4e4a81a162f73938fa5bbb7637d18c52e9426
scope: full

Source clear. Fixed pointd40d0c2a424d6b05c2420b83d7b8d5b3c955de9f; final diff is one test file,4 insertions/2 deletions. Standards: no findings. Spec: no findings. suite-runner.test.ts:342-345 uses stable current timestamp label and generates the ISO value inside the body. Null/unreadable labels, metadata, assertions, five250ms admission-poll negative window, SIGTERM143 and cleanup remain unchanged. No load-gate implementation changes or new test hooks. Machine shard classification unchanged; diff check passes. A-3542 old exact-name no-match reproduction and audit inspected. C1 verified; C2 pending final gate and matched repetitions. A-3549 is51/52 with changed case passing but unrelated npm-install overlap; it is not a green whole-file proof.

Coordinator d0e3604a explicitly replaces E-482 five whole-file Mac passes for T-556 only with one green whole-file run, five exact-name repetitions, and post-review Linux load gate. Complete the remaining local proof before verify at this exact head. No Reviewer edits/tests. Hold and source-artifact mutations each attempted once and timed out; their eventual persistence is unknown. Artifact titled T-556 source clear: stable load-gate test identity was submitted in topic-350; durable id pending response recovery.

Criteria: C1 verified.
