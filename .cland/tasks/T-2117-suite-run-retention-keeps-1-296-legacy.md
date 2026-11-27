---
id: T-2117
kind: task
title: Suite-run retention keeps 1,296 legacy run directories as "unknown" forever, including the empty UUID roots left by the old dev T3 tip-probe retries
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-27T07:38:57.230Z
updated: 2026-11-27T13:30:32.841Z
---

## Summary

On hub restart #106 (2026-11-27), T-2029's scheduled retention classified all 5,815 directories in `.cland/run/suites`: 1,296 unknown, 3,702 reference, 323 age-floor, 348 recent, 145 unsettled, none removable. T-2023 stops new empty roots from refused and failed tip probes, but by design it takes no deletion authority over existing ones. Legacy directories with no metadata therefore stay "unknown" and are kept forever, as rule 39 requires.

## What to build

A one-time, receipt-backed reclassification of legacy roots. For example: a root that is provably empty, or that holds only the files a refused admission writes, and that is older than the age floor with no index row or reference, gets an explicit absence receipt and becomes retirable. Every other unknown stays kept. Report counts before and after.

## Acceptance criteria

- [ ] C1. A legacy root that is provably empty and unreferenced past the age floor is retired with an absence receipt, while a root with any unrecognised content stays "unknown" (test with fixtures).
- [ ] C2. The retention report shows the reclassified count separately from ordinary removals (test).

## Comments

### coord · 2026-11-27T13:30:32.841Z

Six-hour observation on hub #106, from cland-impl at 13:30Z: 185 scheduled retention passes, about one every 2 minutes, median 239 ms, 66 s of hub time in total, removedThisPass 0 in every pass. Latest counts: total 5,830; backlog 5,482, rising by one per new run; unknown 1,299; reference 3,710. The scheduler is cheap and works (T-2029). Nothing has ever qualified, so this item should also check whether "reference" (3,710) over-retains: which owner holds those references (verdict receipts, coverage pointers, batch receipts, durations sources), and whether each reference is still live. It shouldn't look only at the empty unknown roots.
