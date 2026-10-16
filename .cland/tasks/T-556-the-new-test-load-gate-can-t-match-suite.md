---
id: T-556
kind: task
title: The new-test load gate can't match suite-runner tests with dynamic names (0/5 repetitions)
state: closed
status: done
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
updated: 2026-10-16T02:27:49.110Z
closed: 2026-10-16T02:27:49.110Z
---

## Summary
In T-533's local verify bbfee74e (2026-10-16 ~01:05Z; log A-3523), the T-471 load gate reported 0/5 for suite-runner tests with dynamic names. A test whose name embeds a generated value (a path, id or time) gets a new identity on every repetition, so the gate's five repetitions never match the first identity. T-533 doesn't touch those tests. It's a sibling of T-546, which covers skipped new tests.

## Acceptance criteria
- [x] C1. Identify the dynamic-name suite-runner tests. Either give them stable names (preferred, test-only), or make the load gate match repetitions by file plus a normalized name, and record which.
  - done: impl-556 · 2026-10-16T01:19:23.580Z
  - verified: rev-31 [reviewer] · run rev-20261016-556-source · 2026-10-16T01:24:23.238Z · commit 84d4e4a81a162f73938fa5bbb7637d18c52e9426
- [x] C2. A branch touching suite-runner passes the load gate with 5/5 matched repetitions, shown by a test or a recorded run.
  - done: impl-556 · 2026-10-16T01:27:18.521Z
  - verified: rev-31 [reviewer] · run rev-20261016-556-final · 2026-10-16T02:26:56.703Z · commit 84d4e4a81a162f73938fa5bbb7637d18c52e9426

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

### rev-31 · 2026-10-16T02:26:56.703Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-556-final
commit: 84d4e4a81a162f73938fa5bbb7637d18c52e9426
scope: evidence

Final evidence clear at unchanged84d4e4a8. No high/medium findings. C2 verified fromA-3567: five fresh exact-name repetitions, each exit0 with exactly1 stable matching passing receipt,0skip/0fail. A-3561 whole suite-runner file52/52 green109.775s. C1 source verdictrev-20261016-556-source/A-3559 remains current; source/assertions/bounds unchanged.

Explicit Coordinator decision1e88d775-2460-49e6-b762-dbbe5af1de68 read in topic history: merges under batch rule6; per-item Linux requirement superseded, Linux coverage deferred to next integrated dev cover withT-548/T-559. This is the stated six-line test-only exception. de3df9c9 is aT-562 phantom, code1 lock acquisition deadline/no droplet;49f41bff cancelled143. Neither supplies passing suite evidence. No claim of green Linux task gate and no resubmission per Coordinator. All task criteria now checked across source and accepted recorded runs; no per-item QA.
Full evidenceA-3593: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3593-t-556-final-evidence-clear-under-batch-linux-deferral.md. No Reviewer edits/tests.

Criteria: C2 verified.

### coord · 2026-10-16T02:27:49.109Z

Merged 576404e85b072f233a2379a94fc8f0d8b710f04f onto dev.
