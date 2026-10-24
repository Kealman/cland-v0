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
updated: 2026-10-24T11:05:03.190Z
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

### rev-32 · 2026-10-24T11:05:03.190Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1231-source
commit: 4c58347868db204bce28ce583723d81e5426dc6a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1231 full source review — clear

Head4c58347868db204bce28ce583723d81e5426dc6a; treeda196a69f7cdded0a6af9786de3c329c4b9c46eb; parent/fixed base230669296771cf8f282ab2d050fc48603ce0de39. One task commit; diff14files334additions/56removals. Reviewed source, all changed tests, consumers, config/help/docs and A-10783. Standards and Spec both completed personally; no delegation.

## Standards

No findings. coverageMaps now returns only lightweight descriptors, ordered without parsing artifact maps. coverageSelection awaits one reader, checks ancestry, selects and returns, with release in finally on continue/return/selection failure. It holds no array of decoded maps. Missing/damaged artifact evidence is skipped and unsupported/shared source rules still fall back before loading. Future/old/mappable-hunk behavior remains explicit.

mergeCoverageFiles replaces shard Promise.all with sequential reads; the result accumulator may retain transferred function objects, while only one incoming map is owned. Function-boundary attribution merging and admitted head/tree provenance refusal remain. The loader test counts simultaneous ownership, including mismatch release; it does not mistake GC/RSS timing for a deterministic receipt.

T1 tests use disposable filesystem fixtures, fixed dates and fake Git replies, no native processes/real-time latency waits:50x256KiB map fixture expects reads newest49/48/47 only, selected head47 and peak1/final0; pointer ordering uses metadata versus legacy mtime with missing artifacts to ensure no artifact read; retention asserts exact pointer set and named expiry events while every artifact file remains. Sequential shard counter/attribution and legacy consumer adapter controls use the same public/helper seams. Config tests cover default10, configured3, render roundtrip and invalid0/negative/fraction/string. Existing T2 fake-executor publication asserts created/head. Existing T3 replay consumer remains the process seam; no new native launch is added.

The suite-coverage-selection/doc procedure is shared coverage guidance, not a new indexed note with an invalid heading. Help, rendered config, hub README, docs/agents/tests and implement skill agree on pointer retention/loader ownership; skill CHANGES records the edit. Built-in role clause unchanged; this adds no role authority or new agent action. No independent smell finding.

## Spec

C1 source-established: the index visits pointers newest-first; each actual map load is awaited individually and discarded before the next candidate; first valid ancestor returns immediately. The test asserts exactly three decodes out of50 and peak owned decoded maps1, with final selected tests/head. It is a deterministic retained-input proof, not a measured whole-process heap/RSS claim. Shard input retention is bounded to one beside its required output accumulator.

C2 source-established: publication parses/validates the actual coverage artifact against admitted job head/tree, writes pointer created/head, and atomically renames its small temporary pointer. Valid pointer.created determines order; legacy/invalid timestamp falls back to pointer file mtime. Reading order never requires opening the artifact. Existing live selection/replay/T2 consumers migrate to descriptors, and historical selector compatibility feeds one loaded map per invocation with ancestor/nearest behavior retained.

C3 source-established: verification.coverage_map_retention is a positive safe integer/default10; runtime publication reads current project config, so after reload the next publication applies it. Registration is sequenced on the hub artifact queue. Entries beyond newestN are unlinked with coverage-pointer-expired naming pointer/artifact/path; artifact copies are neither removed nor archived by this path and retain ordinary lifecycle ownership. Config/header/help/docs describe this distinction. Test verifies configured2 leaves exactlyrun2/run3 and preserves all four artifact files.

No findings. All three criteria explicitly require execution; no verified marks on this source pass. Proceed with fresh mode-free configured verification at this exact head; QA policy none/after-stage, no item QA brief/criteria. Work ends at ready; Coordinator enqueues merge.

## Evidence and limits

A-10783 reports local Darwin arm64 Node24.21 targeted files: coverage-selection9/9T1, init-config13/13T1, suite-soak-component35/35T2, close-shards3/3T1 and one name-selected coverage replay T3 test. It reports typecheck/static/lint exit0 with report-only133findings60files/zero refusals and a corrected interim tuple typing error. Those are targeted implementation reports, not an original configured/Linux receipt or full-suite/actual heap measurement. Preserve original commands/stdout/exits/native timings with exact source/tree/platform attribution; no evidence-only reruns requested. No full npm check/build or integrated receipt claimed beyond what A-10783 names.

Aside S Tech debt on the pre-existing unsealed outer native Git/manual replay path was reported separately; Coordinator4e876aba filed T-1233 and explicitly kept it outside T-1231. Known loose-object maintenance was left untouched under the human's freeze. No request to repair either in this item.

Reviewer performed read-only Git/source/docs/topic/artifact inspection; no tests, probes, live coverage reads, file changes, installer, browser, merge or delegation.
Standards:zero findings. Spec:zero findings.

Audit A-10789: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10789-t-1231-full-source-review-at-4c583478.md
