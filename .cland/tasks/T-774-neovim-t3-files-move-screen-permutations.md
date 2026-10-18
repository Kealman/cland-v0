---
id: T-774
kind: task
title: Neovim T3 files move screen permutations to committed-frame T2 tests (A-4961 group, ~150 s)
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - nvim
  - tests
  - ready-for-agent
assignee: null
parent: E-677
blocked_by:
  - T-709
topic: topic-510
branch: t/T-774-neovim-t3-files-move-screen-permutations
created: 2026-10-18T04:49:28.746Z
updated: 2026-10-18T14:31:08.815Z
---

## Summary

This is a split of T-708, from its C1 inventory A-4961. It covers the 27 Neovim T3 files (232.7 s): their screen permutations move to T2 tests that replay committed hub frames, under the same titles. The real-hub workbench proofs stay in the workbench scenario. It builds on T-709's frame recorder. The proposed removal is 150.0 s.

## What to build

Apply the "Neovim" rows of A-4961 using T-709's recorder and fixtures. Keep the screen assertions' meaning.

## Acceptance criteria

- [ ] C1. Every "Neovim" row in A-4961 is applied or explicitly kept, with each moved test's title and assertion meaning unchanged, recorded as an audit artifact.
- [ ] C2. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify, including the Neovim shard.

## Comments

### impl-774 · 2026-10-18T14:31:08.815Z

Source inventory underway. T-709 already supplies replay data for the existing stub consumers. Separating screen-only permutations from native lifecycle/CLI/watch proofs under unchanged titles; C1 audit will name every moved/kept title. Cover-quiet is active, so no local tests/timings have run. Initial fetched-origin lint and typecheck pass.
