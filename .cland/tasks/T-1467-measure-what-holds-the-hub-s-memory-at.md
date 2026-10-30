---
id: T-1467
kind: task
title: Measure what holds the hub's memory at startup and at rest
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by: []
topic: topic-1221
branch: t/T-1467-measure-what-holds-the-hub-s-memory-at
created: 2026-10-30T06:38:36.583Z
updated: 2026-10-30T07:49:52.125Z
---

## Summary

Measure what holds the hub's memory at startup and at rest on a scratch copy of this project's live data, and name the top retainers with sizes and code paths, so the fix tickets can be cut from facts.

## What to build

- A reproducible measurement script, committed under `hub/test/` or `tools/`. It copies the live project's `.cland` state into a disposable root (rule 15) and starts a sealed hub on it. It samples RSS, heap used and total, external memory and array buffers every second through startup and 10 minutes at rest. It takes heap snapshots at the end of startup and at rest.
- An artifact with the breakdown:
  - the top retainers by retained size, with their code paths, such as tracker index, artifact index, message history, coverage maps, journals and caches;
  - the non-heap memory: buffers, SQLite and native;
  - the growth over time, if any.
- Each holder gets a proposed fix and its estimated saving.

Context: hub 88459 (v0.3.0) held 3.0 GB RSS 80 s after start on this project (about 1,460 tracker items, 14,000 artifacts). Hubs run with an 8 GB heap cap since the restart-#22 OOM (T-912). Earlier fixes with the same pattern: T-912, T-1038, coverage-map OOM, T-1436. Rule 23 applies to any fix.

## Acceptance criteria

- [ ] C1. The script runs a sealed hub on a scratch copy of the live .cland state, never the live hub, stops it at readiness, and records RSS, heap and external memory at a checkpoint after each startup stage (journal read, each history replay, tracker, artifact index, subscriptions, inbox) with record counts; a guard stop leaves a stop receipt.
- [ ] C2. A sampling heap profile of startup attributes allocations to call stacks, and an artifact names the top allocation sites by size per startup stage.
- [ ] C3. The artifact proposes a fix per dominant startup allocator with an estimated saving; retained-at-rest analysis and the RSS budget are deferred to the fix tickets.

## Comments

### impl-1467 · 2026-10-30T06:44:31.628Z

Script-first implementation underway: sealed projectHub child, consistent read-only SQLite backup, full tracker/journal/log copy, sparse artifact-body placeholders, one-second process samples and sequential startup/rest heap snapshots. Independent supervisor watches swap every 30s. Dry plan about 1.86 GiB allocated payload plus metadata/snapshots; no secrets/config/accounts/worktree copy. Measurement blocked pending Coordinator slot and swap <=80% (dry preflight 84.67%).

### impl-1467 · 2026-10-30T07:49:52.125Z

First live-scale attempt 422b5b7a5 was partial: swap >92% guard at30s, child exit143, missing worker stop receipt, no snapshots/rest. Published A-14157 analysis and A-14158 seven numeric receipts; removed original scratch state after child close. Coordinator narrowed C1–C3 to startup allocations. c8defa34d implements startup-only 1MiB sampling with stage counts and IPC stop receipts; six focused controls, typecheck and report-mode lint pass. Awaiting second Coordinator slot.
