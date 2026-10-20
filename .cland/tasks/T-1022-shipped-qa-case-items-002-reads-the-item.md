---
id: T-1022
kind: task
title: Shipped QA case ITEMS-002 reads the item file from the explorer row that T-1007 slimmed
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1007
found_by: review
topic: null
branch: t/T-1022-shipped-qa-case-items-002-reads-the-item
created: 2026-10-20T18:43:18.609Z
updated: 2026-10-20T18:49:05.843Z
closed: 2026-10-20T18:49:05.843Z
---

## Summary

The shipped QA case ITEMS-002 reads `item.file` from the explorer state to find T-2's file. Since T-1007 (5453c280) the explorer loads summary rows without file paths, so the case fails BLOCKED: `qa/cases/ITEMS-002.lua:30: attempt to concatenate field 'file' (a nil value)`. qa-shipped.test.ts is not in merge batches, so dev carries it; impl-1001 found it at e8f75b8a.

## What to build

The case finds the item file on disk by its id (`.cland/tasks/T-2-*.md`) instead of the explorer row.

## Acceptance criteria

- [x] C1. ITEMS-002 passes in qa-shipped.test.ts against dev with T-1007, and no shipped case reads `item.file` from the explorer state (targeted local run named in the item).
  - done: coord · 2026-10-20T18:43:39.664Z
  - verified: rev-26 [reviewer] · run rev-20261020-1022-source-1 · 2026-10-20T18:44:14.537Z · commit 751d1bd17493afbca97881b2efb7c60b46a4b1e4

## Comments

### rev-26 · 2026-10-20T18:44:14.537Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1022-source-1
commit: 751d1bd17493afbca97881b2efb7c60b46a4b1e4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. One-hunk fixture-only change against 3f74bc05 replaces explorer item.file access with exact T-2-*.md disk lookup; nonempty/no-newline assertion rejects absent or multiple glob matches before reading/writing. All existing criteria rendering, watched-save, width and stale-head assertions remain unchanged. No production, tier, process or wait changes. Read-only diff check clean; pinned source scan finds no remaining item.file/explorer-items file access in qa/cases.

Spec: no findings. Fix removes the actual nil-file concatenation dependency introduced by T-1007 summary rows and uses the requested fixture path lookup. C1 verified from source scan plus the Coordinator's explicitly reported local macOS arm64 targeted ITEMS-002 qa-shipped run, 1/1 pass, named in request and commit message. This is a reported targeted T4-case pass, not an independently parsed raw receipt, Linux/load/suite or integrated verification claim; no budget enforcement claimed. No Reviewer tests or GUI execution. Source verdict only; any task gate remains separate. Artifact omitted as explicitly requested in Agents.

Criteria: C1 verified.

### coord · 2026-10-20T18:44:27.713Z

Merge evidence (rule 6/7 exception stated): qa/cases-only change; the shipped case runs in qa-shipped.test.ts (T4), which task verify T0-T2 does not run. Evidence is the targeted local run 'node --test --test-name-pattern ITEMS-002 nvim/test/qa-shipped.test.ts' 1/1 at 751d1bd1 (macOS arm64) plus review clear rev-20261020-1022-source-1; the merge batch runs T1 on the combined tree. No mode-free verify: the Coordinator's session holds integrated cover 0334fa4a.

### coord · 2026-10-20T18:49:05.843Z

Merged 713525259131ef250c372e9225037f2bf3650a86 onto dev.
