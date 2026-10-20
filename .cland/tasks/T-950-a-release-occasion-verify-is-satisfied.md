---
id: T-950
kind: task
title: A release-occasion verify is satisfied from the cache of a local macOS stage run instead of running sharded on droplets
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-739
branch: t/T-950-a-release-occasion-verify-is-satisfied
created: 2026-10-20T09:17:09.199Z
updated: 2026-10-20T12:00:49.928Z
closed: 2026-10-20T12:00:49.928Z
---

## Summary

At release candidate 8 (7916d5f7) on 2026-10-20 ~09:16Z, `cland verify all --occasion release` returned at once as suite 7ffb2aa0, "cached from 2881edee" (A-7249). 2881edee was the local macOS stage run at the same tree. A release run is meant to be the sharded droplet release gate (E-617 C6, docs/agents/tests.md), so a cache hit from a local run of another occasion skips the Linux droplet evidence the gate exists for. The Coordinator forced a fresh run with `--fresh` (9bbe4fc1).

## Acceptance criteria

- [x] C1. A release-occasion run reuses only a cached release (or same-executor, same-platform full) receipt at the same tree; a local macOS stage receipt never satisfies it. A T2 test with fake receipts covers both.
  - done: impl-950 · 2026-10-20T11:47:05.242Z
  - verified: rev-23 [reviewer] · run rev-20261020-950-final · 2026-10-20T11:56:06.920Z · commit e4b0fdba5b065cfa04cc4593a13e61976448e492
- [x] C2. The cache notice names the original run's occasion and executor, so a mismatch is visible.
  - done: impl-950 · 2026-10-20T11:47:06.102Z
  - verified: rev-23 [reviewer] · run rev-20261020-950-source · 2026-10-20T11:48:19.339Z · commit e4b0fdba5b065cfa04cc4593a13e61976448e492
  - verified: rev-23 [reviewer] · run rev-20261020-950-final · 2026-10-20T11:56:06.920Z · commit e4b0fdba5b065cfa04cc4593a13e61976448e492
- [x] C3. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-950 · 2026-10-20T11:55:40.831Z
  - verified: rev-23 [reviewer] · run rev-20261020-950-final · 2026-10-20T11:56:06.920Z · commit e4b0fdba5b065cfa04cc4593a13e61976448e492

## Comments

### impl-950 · 2026-10-20T11:47:06.979Z

Implementation committed/pushed as e4b0fdba5b065cfa04cc4593a13e61976448e492. Fresh origin/dev fetch+merge was already current at 944b17bf. Local macOS targeted T1/T2 validation: 67/67 passed; npm run check and test:tiers passed, lint report-only with zero refusals. C3 awaits source-clear then mode-free same-head verify. See item-topic implementation artifact for exact scope, red evidence and commands.

### rev-23 · 2026-10-20T11:48:19.339Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-950-source
commit: e4b0fdba5b065cfa04cc4593a13e61976448e492
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Release lookup pins effective executor and requires known matching OS through shared identity helper, preserving command/tree/selection coverage and newest-attempt supersession. Cache provenance records original occasion/executor in CLI, normal/bounded topic reports and copied log; C2 established. Six T2 durable-receipt cases cover configured-droplet misses/reuse and provenance. A-7582 records review; A-7580 local 67/67/check receipts remain supplemental, not same-head task/load evidence. C1 runtime and C3 await normal mode-free verification at this exact head. No item QA.

Criteria: C2 verified.

### impl-950 · 2026-10-20T11:55:41.588Z

Mode-free verify f48e56f9-9f81-47ff-8ce5-6862be7ce974 passed at reviewed head e4b0fdba5b065cfa04cc4593a13e61976448e492, Linux x64 droplet c-8 lon1, Node v24.21.0/Neovim v0.12.5. T0–T2 completed; 2057 pass, zero failures/cancellations/skips. Task fallback ran all T2 across hub and Neovim; T3/T4 not executed. Test lint/duration budgets report-only (131 lint findings/59 files, 11 missing baselines). Executed receipt, not cached. Droplet lifetime 382 s, cost $0.0265. Artifact A-7588: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7588-suite-f48e56f9-9f81-47ff-8ce5-6862be7ce974-auto-at-e4b0fdb.log. All claimant done marks complete; awaiting reviewer's final same-head verdict.

### rev-23 · 2026-10-20T11:56:06.920Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-950-final
commit: e4b0fdba5b065cfa04cc4593a13e61976448e492
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7589 audits exact-head A-7588/run f48e56f9: 2057/2057 ordinary tests; six new release cache cases each 5/5 load passes. Matrix establishes configured-droplet OS/executor admission and original CLI/topic/log provenance; existing cache10/10 and recovery3/3 pass. C1-C3 established with source A-7582. Linux T1/all-T2 includes Neovim; this task/fake-receipt coverage is not an integrated release run, T3/T4 deferred. Host check7bd6afa2 not repeated; lint/budgets/ratchet report-only,11 missing baselines/incomplete timing not passes. No item QA.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T12:00:49.928Z

Merged 677c0ed31bc603c033393e362f2fd65d68350109 onto dev.
