---
id: T-1498
kind: task
title: journal-subagents startup-selection test is slow on fresh occasion droplets (11.7 s soak, 13.8 s stage shard)
state: open
status: review
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
regression_of: T-1497
found_by: droplet
topic: topic-1275
branch: t/T-1498-journal-subagents-startup-selection-test
created: 2026-10-31T04:01:18.312Z
updated: 2026-10-31T15:26:11.574Z
---

## Summary

T-1497 sized a 12.5 s allowance on the assumption that the soak's 11.692 s was a one-sample outlier (median 1.88 s across 73 samples). The 0.3.1 Linux stage cover 4d0f4448 / A-14811 at 7f0e3353b then ran the same identity at 13.837 s on shard-1. That was over the allowance, reported as a `duration regression … 12.5 s → 13.837 s` line; the run stayed green.

Both slow samples come from occasion runs (nightly soak, stage shard) that start on a freshly created droplet. Ordinary task and batch runs stay at about 1.6–2.9 s. The likely cause is a cold page cache or disk for the 300 MiB scan input on a new machine, not the hub code.

## What to build

Confirm the cause by comparing per-run machine age, shard and first-T1 position across the A-147xx/A-148xx logs. Then fix it so the test measures the scan rather than first-touch I/O, for example a warm-up read outside the timed section, or an input sized for the claim. Keep the < 1 MiB buffered-input assertion. Then drop or shrink T-1497's allowance (expires 2026-11-07).

## Acceptance criteria

- [ ] C1. On the item's task verify on a Linux droplet, the identity runs within its 5 s per-test budget without the T-1497 allowance, with its buffered-input assertion unchanged, and the item records the measured cause or states that cold I/O stays unproven; the fresh occasion-droplet confirmation is landing evidence from the 0.3.2 release cover, not a pre-merge criterion.

## Comments

### impl-1498 · 2026-10-31T15:23:04.171Z

Red-first C1 fixture-work regression: node --test hub/test/journal-subagents.test.ts failed `fixture work budget exceeded: 315490346 bytes` (6 pass/1 fail), then 16–17MiB fixture passed all7 on macOS arm64 Node24.21.0: identity48.707917ms, setup14.030417ms, scan33.451708ms, bytesRead17104938, peak527872. Exact `<1 MiB` assertion unchanged; selected tail/exact byte assertion retained. Production unchanged. Consumer search across hub,nvim,web,docs,qa,.agents for exact identity and 300MiB test found only test, per-file guide, durations baseline/allowance; migrating name, retiring old baseline and T-1497 allowance. No wire/schema change. Historical source A-14799: 350th ordinary T1 test,21.365s after first T1 test,11.691700711s; A-14811 shard1:213th,14.995s,13.837001964s; A-14806 task:350th,19.832s,1.868734442s. Machine creation age and write/scan split absent, so fresh-occasion correlation does not establish cold-cache cause. Confirmed avoidable cost: the unit's timed region creates/writes/scans315490346 bytes; reduced fixture still exceeds buffering ceiling16x. New per-stage diagnostics make future cause attribution observable. Fresh Linux reviewed-head evidence pending.

### coord · 2026-10-31T15:23:31.879Z

C1 reworded by coord (2026-10-31 15:23Z): fresh occasion-droplet evidence is landing evidence, so it will come from the 0.3.2 release cover. If that cover exceeds the budget, a follow-up is filed and the allowance returns.

### rev-31 · 2026-10-31T15:26:11.574Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261031-1498-source1
commit: c315150b330d2501f4041817dfdf590247787940
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-14937, Standards 0 / Spec 0. Final three-file merged-head diff bounds fixture to16–17MiB, preserves exact bytesRead/selected-tail and unchanged <1MiB buffering assertions, adds diagnostic-only setup/scan times, removes old identity baseline and T-1497 allowance, and updates guide without production/shared-contract changes. Original historical ordinary timing/position facts independently match A-14799/A-14811/A-14806; cold I/O remains unproven. A-14932 local red/green/mutation summaries retain scope; no Linux/new-head runtime claim yet. Artifact wording correction: old input315,490,346 bytes is approximately301MiB, not315MiB. C1 remains runtime pending under Coordinator's revised task-Linux criterion; fresh occasion confirmation is later release landing evidence. Freeze this head for one mode-free droplet verification, then original-record final evidence with named budget/load outcomes. No Reviewer workloads.
