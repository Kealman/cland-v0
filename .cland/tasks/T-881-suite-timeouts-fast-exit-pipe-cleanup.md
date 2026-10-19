---
id: T-881
kind: task
title: suite-timeouts fast-exit pipe cleanup case times out waiting for its one cleanup warning
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - qa-found
  - needs-triage
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: topic-616
branch: t/T-881-suite-timeouts-fast-exit-pipe-cleanup
created: 2026-10-19T15:30:17.413Z
updated: 2026-10-19T19:12:28.262Z
closed: 2026-10-19T19:12:28.262Z
---

## Problem

On 2026-10-19 ~15:29Z, impl-869 ran hub/test/suite-timeouts.test.ts alone in the T-869 worktree with the source unchanged (base fa1999d7). The case 'verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor' failed with 'one cleanup warning: not within 15000 ms' after a 21.06 s run. Seven new implementer sessions were starting on the Mac at the time, so load may be a factor. It has not been diagnosed.

## Acceptance criteria

- [x] C1. The case's cause is identified and fixed (or the wait is made load-independent), and hub/test/suite-timeouts.test.ts passes 20/20 serially on the Mac, both as a whole file and with that case alone.
  - done: impl-881 · 2026-10-19T16:19:14.422Z
  - verified: rev-30 [reviewer] · run rev-20261019-881-final · 2026-10-19T16:27:29.452Z · commit faa63b536ff3b01293777a06fc51dab362f65304

## Comments

### impl-881 · 2026-10-19T15:57:33.443Z

Exact unchanged-source reproduction: node --test --test-name-pattern='verify reports unverified fast-exit pipe cleanup once' hub/test/suite-timeouts.test.ts fails after 20.95s, one cleanup warning not within 15000 ms. Temporary receipt probe shows compatibility cleanup failed: ps eww -axo pid=,command=. Isolated native probe: spawnSync default 1 MiB yields ENOBUFS/SIGTERM (~1.11 MB captured), 32 MiB exits 0 (~1.59 MB output); environment contents were never printed. The test-only ps shim narrowed native process-cleanup.ts's 32 MiB buffer to the default 1 MiB. Fix restores 32 MiB in that forwarding wrapper without changing waits/assertions. C1 will retain all 20 whole-file and 20 case-only Mac run receipts.

### impl-881 · 2026-10-19T16:15:41.482Z

Implementation committed/pushed as faa63b536ff3b01293777a06fc51dab362f65304. A-6198 contains diagnosis and all 40 own Mac receipts: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6198-t-881-diagnosis-and-40-serial-mac-receipts/README.md. Whole-file 20/20 (all eight tests each); case-only 20/20. Test SHA identical to final committed file. Serial base 4b990bf4; fetched/merged origin/dev d82a768a before source review, then final smoke passes 8/8 in 39.033s and root typecheck passes. Requested source review through role reviewer; routed to rev-30. Source unchanged after review request. Before pushing fetched then merge-tree succeeded (38820f7b910564c50b9c92043d1b20e7c6974842). Awaiting source verdict before mode-free verify.

### rev-30 · 2026-10-19T16:18:43.813Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-881-source
commit: faa63b536ff3b01293777a06fc51dab362f65304
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-6200 records the buffer-limit diagnosis, unchanged ownership/cleanup assertions and independent 40-run Mac audit with pre-merge-base provenance. C1 remains unverified pending exact-head mode-free task verification; T3 evidence remains subject to queue policy.

### impl-881 · 2026-10-19T16:26:24.861Z

Exact reviewed-head mode-free verification 3d382cde-d8fa-4e89-a182-517b1016d5a7 passed at faa63b536ff3b01293777a06fc51dab362f65304: 451 tests,451 pass,0 fail. Hub-selected T0–T2 plan; T3 deferred to merge batch per queue policy. Linux x64 c-8 lon1, Node v24.21.0; droplet lifetime400s, cost$0.0278. Log A-6213: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6213-suite-3d382cde-d8fa-4e89-a182-517b1016d5a7-auto-at-faa63b5.log. Reviewer received the same-head result directly; awaiting final evidence verdict. C1 claimant done already recorded; all40 Mac receipts remain A-6198. No source changes since source review.

### rev-30 · 2026-10-19T16:27:29.452Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-881-final
commit: faa63b536ff3b01293777a06fc51dab362f65304
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1 verified. A-6215: exact-head A-6213 task gate 451/451, 223 groups 5/5, zero tier trips, combined with A-6198's independently audited 20+20 serial Mac passes under identical final test bytes and qualified prior-base provenance. Task receipt does not execute native T3; Linux T3 remains merge-batch evidence.

Criteria: C1 verified.

### coord · 2026-10-19T19:12:28.262Z

Merged 0420324e4ee9266c2c29149356589d0dbea742a2 onto dev.
