---
id: T-1231
kind: task
title: Coverage selection parses every coverage map at once and runs the hub out of heap
state: open
status: review
size: M
criterion_seq: 3
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-964
branch: t/T-1231-coverage-selection-parses-every-coverage
created: 2026-10-24T10:52:41.168Z
updated: 2026-10-24T11:00:31.516Z
---

## Summary

P1: the hub died of heap OOM twice on 2026-10-24: pid 63237 at 10:46:48Z, and pid 24276 95 s after its start at 10:51:13Z. `coverageSelection` (hub/src/suite-coverage.ts) calls `coverageMaps(root)`, which reads and parses every map listed in `.cland/run/coverage-maps/` and keeps all of them in memory before it picks the newest ancestor. There were 170 pointers, 2,039 MB of JSON, 143 maps over 10 MB. Every task verify or batch preparation that touches hub/src triggers it, and every green dev run adds a map, so the cost grows without bound. The crash stack is `JSON.parse` after `await readFile`, with a nesting that matches the map shape.

Coord archived all but the newest 5 pointers to `.cland/run/coverage-maps-archive-20261024/` as a stopgap. Nothing was deleted.

## What to build

- Selection reads pointers newest-first and parses at most one map at a time. It stops at the first map whose head is an ancestor of the merge base, and keeps no other map in memory.
- Pointer order must not depend on parsing the maps: record `created` (and head) in the pointer, and fall back to the pointer mtime for old pointers.
- Pointers have retention: keep the newest N (configurable, default about 10). When a pointer is dropped, its artifact copy follows the artifact rules, never a silent delete of anything the human can see.
- Batch-shard map merging (`suites.ts`, the `Promise.all` over shard maps) stays bounded the same way.

## Acceptance criteria

- [x] C1. With 50 synthetic pointers to large maps, coverage selection parses at most the maps up to and including the first ancestor, and peak retained heap stays bounded by one map (test).
  - done: impl-1231 · 2026-10-24T10:59:28.300Z
- [x] C2. Pointers record created/head; old pointers without them still order by mtime (test).
  - done: impl-1231 · 2026-10-24T10:59:28.403Z
- [x] C3. Registering a new map beyond the retention limit removes the oldest pointer with an event naming it (test).
  - done: impl-1231 · 2026-10-24T10:59:28.737Z

## Comments

### impl-1231 · 2026-10-24T10:56:50.714Z

Implemented C1–C3 at deterministic T1 seams: 50 x 256 KiB maps, exactly 3 parsed through newest ancestor, peak retained map count 1; pointer metadata and mtime ordering; configured retention removes pointers with named events while preserving artifacts. Shard merge historical Promise.all control failed 3 !== 1, sequential loader passes. Local macOS arm64 targeted files only so far; source review and mode-free verification remain. Matching help/docs/implement skill updated; no role clause expansion per brief.
