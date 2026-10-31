---
id: T-1498
kind: task
title: journal-subagents startup-selection test is slow on fresh occasion droplets (11.7 s soak, 13.8 s stage shard)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
regression_of: T-1497
found_by: droplet
topic: null
branch: null
created: 2026-10-31T04:01:18.312Z
updated: 2026-10-31T04:01:18.312Z
---

## Summary

T-1497 sized a 12.5 s allowance on the assumption that the soak's 11.692 s was a one-sample outlier (median 1.88 s across 73 samples). The 0.3.1 Linux stage cover 4d0f4448 / A-14811 at 7f0e3353b then ran the same identity at 13.837 s on shard-1. That was over the allowance, reported as a `duration regression … 12.5 s → 13.837 s` line; the run stayed green.

Both slow samples come from occasion runs (nightly soak, stage shard) that start on a freshly created droplet. Ordinary task and batch runs stay at about 1.6–2.9 s. The likely cause is a cold page cache or disk for the 300 MiB scan input on a new machine, not the hub code.

## What to build

Confirm the cause by comparing per-run machine age, shard and first-T1 position across the A-147xx/A-148xx logs. Then fix it so the test measures the scan rather than first-touch I/O, for example a warm-up read outside the timed section, or an input sized for the claim. Keep the < 1 MiB buffered-input assertion. Then drop or shrink T-1497's allowance (expires 2026-11-07).

## Acceptance criteria

- [ ] C1. On a fresh occasion droplet, the identity runs within its 5 s per-test budget without the T-1497 allowance, with its buffered-input assertion unchanged, and the cause is recorded in the item.
