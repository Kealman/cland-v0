---
id: T-432
kind: task
title: "executor-prepare test fails under load: expected 422, got 0 at line 137"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - qa-found
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
regression_of: T-344
topic: topic-259
branch: t/T-432-executor-prepare-test-fails-under-load
created: 2026-10-14T17:38:31.303Z
updated: 2026-10-14T18:12:47.464Z
---

## Summary

`hub/test/executor-prepare.test.ts:137` ("prepare keeps its snapshot when builder deletion is unconfirmed, then the hub confirms release and cost") failed once in E-271 QA run qa-2026-10-14-27-9 at a7e07635, with expected 422 and actual 0. A full local verify held the machine at the time. Run once more alone under a similar load, the file passed 17/17. It is a load-sensitive test: a timing or ordering assumption about the confirmation of the builder's release.

## Evidence

The QA evidence for run qa-2026-10-14-27-9 holds `M3-executor-prepare.log` (the failure) and `M3-rerun-executor-prepare.log` (the pass). The command was `node --test hub/test/executor-prepare.test.ts`.

## Acceptance criteria

- [x] C1. The cause of the 0 where 422 was expected is named, and the test waits on the state it asserts rather than on time.
  - done: impl-432 · 2026-10-14T18:11:21.987Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-432-1 · 2026-10-14T18:12:47.463Z · commit 4b5846b824cd48fdd5f14a355f0465cb789dfe97
- [x] C2. The file passes 5/5 whole-file runs while a full suite runs beside it.
  - done: impl-432 · 2026-10-14T18:11:24.420Z

## Comments

### impl-432 · 2026-10-14T17:59:32.664Z

C1 diagnosis: reproduced 0 !== 422 at line 137 using node --test --test-name-pattern='prepare keeps its snapshot' hub/test/executor-prepare.test.ts. Serial whole-file instrumentation shows repeated 422/delete_failed retries followed by 0/deadline and executor-release-unconfirmed carrying that last deadline cause. No race in assigning fake deleteError; the test wrongly assumes the final bounded attempt must receive the fake's 422. Changed it to eventually wait for a 422 retry and unconfirmed release for the same builder lease, plus at least two delete attempts, retaining the provider-cause assertions and restart/release/cost checks.

### impl-432 · 2026-10-14T18:11:25.927Z

C2 complete: five serial node --test hub/test/executor-prepare.test.ts runs each passed 17/17 beside local full verification 0e68bdde (impl-385). Queue snapshots before and after every run confirm the same full holder from 18:00:43Z to 18:10:32Z. Durations: 115.7s, 114.9s, 135.6s, 113.5s, 105.5s. Durable evidence A-2485 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2485-t-432-diagnosis-and-five-serial-whole-file-passes-under-full-suite-load. One commit 4b5846b8 pushed to origin task branch after fetching/merging origin/dev (already up to date); diff check clean. QA policy scope none and no QA criteria, so review only.

### rev-23 · 2026-10-14T18:12:47.464Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-432-1
commit: 4b5846b824cd48fdd5f14a355f0465cb789dfe97
scope: full

No high or medium Standards/Spec findings. Same-builder ID/lease-scoped bounded journal readiness replaces invalid final-cause422 assumption; provider422/delete_failed/message and >=2 actual DELETE checks retained, alongside snapshot/restart/resource/lifetime/cost assertions and unchanged deadlines. A-2485 diagnosis reproduces422 retries then final0/deadline unconfirmed state; C1 verified. All five serial loaded whole-file logs read:17/17 each,85 total,zero failures/skips; ten before/after queue snapshots confirm full local0e68bdde throughout. C2 evidence is established, to be marked in final review after normal same-head no-mode local suite result. A-2488: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2488-t-432-source-review-same-builder-retry-evidence-and-loaded-passes.md.

Criteria: C1 verified.
