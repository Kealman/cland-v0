---
id: T-850
kind: task
title: "merge queue: a hub-only failing-file rerun sets nvimTests [] and crashes, so every red batch is held instead of bisected"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-712
topic: topic-566
branch: t/T-850-merge-queue-a-hub-only-failing-file
created: 2026-10-19T07:33:47.777Z
updated: 2026-10-19T07:40:48.873Z
---

## Summary

A batch failing-file rerun whose failing files are all hub tests crashes before it runs anything: `Suites` builds the selection with `nvimTests: []`, and `selectionFromEnv` rejects an empty list with "invalid selected Neovim tests". Every leave-one-out job is therefore inconclusive, and any red batch of two or more members is held for the Coordinator instead of being diagnosed.

## Problem

Seen live on 2026-10-19. Batch e1ed96eb (T-664, T-663, T-669) went red on one hub test (run 892bfedf, A-5860). The hub's omit-0 job, run 68e55332 (A-5861), exited 1 after 73 s with `Error: invalid selected Neovim tests` at hub/src/suite-selection.ts:236, called from run-suite.ts:373. The batch was held with "diagnostic 68e55332 inconclusive: no failing-test receipt". The cause is at hub/src/hub/suites.ts:403–405: `nvimTests: files.filter(file => file.startsWith('nvim/'))` is always set, so a hub-only failure gives an empty array. The T-712 tests never exercised a real selection round-trip through `selectionFromEnv`.

## Acceptance criteria

- [x] C1. A batch failing-file rerun with only hub files produces a selection that `selectionFromEnv` accepts and that runs exactly those hub files; with Neovim files it runs exactly those Neovim files; with both it runs both. A regression test round-trips the selection Suites builds through the env encoding and fails on the current code.
  - done: impl-850 · 2026-10-19T07:35:45.365Z
  - verified: rev-30 [reviewer] · run rev-20261019-850-source · 2026-10-19T07:40:48.872Z · commit 5b9db65f68072eff84a822625e8c75c6aa4d19e9
- [ ] C2. A component test drives a red multi-member batch whose failing file is a hub test through leave-one-out diagnosis to a green or red verdict instead of a hold. The mode-free task verify passes at the reviewed head.

## Comments

### impl-850 · 2026-10-19T07:35:02.442Z

Regression-first evidence: node --test --test-name-pattern='batch failing-file selections round-trip' hub/test/merge-batches.test.ts fails on unchanged production code with Error: invalid selected Neovim tests at suite-selection.ts:236. T1 seam uses real Suites admission, env transport/decoder and packageShards; checks hub-only, Neovim-only and mixed targets against unrelated fixture files. Shard accepts [] for Neovim-only, so it must remain present.

### rev-30 · 2026-10-19T07:40:48.873Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-850-source
commit: 5b9db65f68072eff84a822625e8c75c6aa4d19e9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-5863 records Standards/Spec review against 9ac260d8. Real Suites selections round-trip through transport/decoder and packageShards with exact hub-only, Neovim-only and mixed targets; empty hub shards remain explicit while empty nvimTests is omitted. The red triple decodes every diagnostic before execution receipts and retains culprit refusal, green landing and no-held-batch assertions. C1 verified. C2 component behavior is established by source, but its same-head mode-free task gate is still pending; C2 remains unverified. No repository edits or tests performed by Reviewer.

Criteria: C1 verified.
