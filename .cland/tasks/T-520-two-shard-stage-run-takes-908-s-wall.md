---
id: T-520
kind: task
title: Two-shard stage run takes 908 s wall against T-395's 600 s target
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-578
blocked_by:
  - T-519
regression_of: T-395
topic: topic-377
branch: t/T-520-two-shard-stage-run-takes-908-s-wall
created: 2026-10-15T18:12:19.748Z
updated: 2026-10-16T15:56:03.834Z
---

## Summary

E-387's first real two-shard stage run, 1bebcda2 at 9bc15ce8, took 907.85 s overall from admission through collection. T-395's C6 target is 600 s or less. The hub machine phase on shard-2 took 571.57 s, while shard-1 took 892.95 s in total, so the shards are unbalanced and the overhead outside the tests (create, bundle, typecheck, collect) is large. This ticket finds where the 908 s goes and closes the gap.

## Acceptance criteria

- [x] C1. A breakdown per shard, from run 1bebcda2's logs and lease receipts, of droplet create, bundle transfer, install or snapshot, typecheck, the hub phase, the Neovim phase and collection, posted on the item.
  - verified: rev-30 [reviewer] · run rev-20261016-520-source · 2026-10-16T15:55:51.343Z · commit 76e5cc77d6eb8abc02fc6c68302122a88cefd782
  - done: impl-520 · 2026-10-16T15:56:03.834Z
- [ ] C2. Changes taken from that breakdown, such as shard balancing by recorded durations, parallel create, or skipping the remote typecheck when the host gate passed. A repeat `--occasion stage` run lands at 600 s or less wall, or the item records why 600 s isn't reachable and the human sets a new target.

## Comments

### impl-520 · 2026-10-16T15:51:27.983Z

Before editing, replayed A-3230: 907.85s wall against 600s (307.85s over), hub machine 781.41s/571.57s; Neovim was assigned to shard-2 and never reached because its hub phase failed. Current durations source A-3877/f6045f83 produces hub estimates 2436.975652/2436.975487 test-seconds, then appends 406.734554 Neovim test-seconds, leaving combined estimates 2436.975652/2843.710041. Coordinator confirmed the balanceCloseShards public plan seam and post-merge Coordinator-owned --occasion stage comparison (decisions 8af4e401, 1aab3506). Added regression first: two equal 20-second hub partitions plus 20-second indivisible Neovim incorrectly planned [40,20] rather than [30,30].

### rev-30 · 2026-10-16T15:55:51.343Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-520-source
commit: 76e5cc77d6eb8abc02fc6c68302122a88cefd782
scope: full

# T-520 source review clear

Reviewed pushed `76e5cc77d6eb8abc02fc6c68302122a88cefd782`, branch `t/T-520-two-shard-stage-run-takes-908-s-wall`; local/origin refs agree. Fixed point/merge base `8dbb4599a8799238bfda80ac5802eb96ce7a7302`; captured three-dot diff/single implementation commit. Two files30insertions/6deletions. Took hold and read live claimant/C1–C2/QA scope none.

## Standards

Zero high/medium/low findings. The planner now represents every hub file plus the summed Neovim phase as jobs in one existing LPT loop. Null file is a local representation of the single indivisible Neovim job, not an omitted hub file. Output shape, count validation, manifest median fallback, unknown-file1s fallback when manifest empty, hubSeconds accounting and downstream explicit resource/worker selection remain unchanged.

Ordering is descending combined job weight, deterministic filename ties (Neovim's null key precedes same-weight names), and first lightest combined shard on ties. Input array is not mutated. Every supplied hub job is placed once; one Neovim job sets exactly one nvim flag, including1/3/6-shard cases. Phase is reserved first when larger than hub jobs, as on this actual manifest; the code does not falsely force small Neovim ahead of larger hub files. No executor/concurrency/machine/typecheck bypass or duration-baseline change. Whitespace diff check clean.

## Spec / C1 breakdown verified

**A-3935** posts original1bebcda2/9bc15ce8 breakdown with machine/worker identities, named original merged/child artifacts A-3230/A-3231/A-3232 and lease paths. Independently checked original raw logs:907.85s parentwall; package782.33/572.60s; hubmachine781.41/571.57s; free0.89/1.01s; both snapshot/dependency pin checks reused prepared data; shard2exit1 stopped before its assigned Neovim, shard1exit0 had no Neovim. Independently read both lease create-start/response and release fields; values match A-3935, including parallel create starts17:54:29.266/29.264Z and releases18:09:24.829/18:05:44.702Z. Parent saved result finished18:09:24.900Z matches collection endpoint.

The note labels measured enclosing delivery/start-observation/typecheck-wrapper residual intervals rather than inventing separate transfer/checkout/install/typecheck stopwatches absent from historical receipts. Snapshot reuse means no install/Neovim seeding. It distinguishes remote finish from host collection and notes differing historical child completion boundaries; Coordinator already filed that separate S/Bugs issue as **T-618**, leave outside this diff. Partial original/release runs are not represented as complete workload timing.

C1 verified as an evidence-based breakdown with explicit unavailable subintervals. C1 claimant done mark was not yet present at read; Reviewer verification is independent of claimant's later mark.

## Spec / C2 implementation and remaining measurement

BaselineA-3877/f6045f83 estimates:4873.951139hub+406.734554Neovim test-seconds. A-3935 reports old combined2436.975652/2843.710041 versus new2640.342900/2640.342793; estimated spread406.734389→0.000107 and makespan reduction7.15%. These are **estimated summed test work, not measured wall speedup**. Four-worker idealized~50.84s potential does not establish600s wall; startup/cleanup/concurrency and omitted-phase limits remain explicit.

Public-plan regression (Coordinator-confirmed seam8af4e401) reports controlled red[40,20] beforefix versus[30,30] after. It checks counts1/2/3/6, exact hub-file coverage, one Neovim owner, hub/combined work conservation and reversed input determinism. Existing median-fallback and explicit-resource/one-owner tests remain intact.

**A-3937** raw exact-head command output: root typecheck exit0; close-shards whole file3/3,no fail/cancel/skip,243.987ms; new regression0.466ms. No own duration allowance needed.

**Primary Coordinator1aab3506-1aeb-4fbb-a95f-e4ac2a2adadc** explicitly assigns the real integrated `--occasion stage` after measurement to Coordinator **post-merge**, and accepts a measured above600 record explaining balancing-only limits under delegated plan authority. This is an authorized sequencing decision, not an already-existing performance result or a new target invented by Reviewer.

Source **clear**, C1 verified. **C2 remains unverified**: first fresh no-mode exact-head task verification is still required; that alone does not supply the actual post-merge stage wall/per-shard record. Do not mark600 achieved or C2 complete from these plan estimates. Final performance disposition must retain the Coordinator-owned actual stage receipt and, if needed, measured-limit record. No occasion run by Implementer, no per-item QA/full local suite requested. Any changed head needs delta review.

Reviewer only reads/parses source/evidence; no tests/compiler/provider calls/edits/subagents. Findings: Standards0; Spec0. Source clear; C2 timing/runtime pending.

Artifact A-3940 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3940-t-520-source-clear-combined-lpt-workload-actual-stage-wall-still-pending.md

Criteria: C1 verified.
