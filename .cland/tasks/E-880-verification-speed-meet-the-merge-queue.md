---
id: E-880
kind: epic
title: "Verification speed: meet the merge-queue targets v0.1.4 measured short"
state: open
rank: 4110
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-19T15:24:04.550Z
updated: 2026-10-19T15:24:19.573Z
---

## Summary

v0.1.4 shipped the merge queue (E-678), but the honest measurements accumulated to its release missed most of the speed targets. This epic meets them before v0.2's feature work leans on the crew (D65, the human, 2026-10-19 15:23Z).

## Measured at v0.1.4 (2026-10-19, from 04:23Z)

- Task-run body median: 12.9 min over the first 20 runs (A-6104). Target ≤ 8 min.
- Suite runs per merged ticket: 2.05, or 1.80 without that day's rerun and recovery waste (A-6112). Target ≤ 1.6.
- Task runs red: 10 %; red on a flake: 6 % (A-6112). Targets ≤ 10 % and ≤ 5 %.
- Median batch wall: 19.3 min (A-6112). Target ≤ 15 min. Droplet cost per merge was $0.043, which met the ≤ $0.08 target.
- Nightly soak: one run, which hit the 75 min timeout at $0.32 and recorded no coverage map (A-6105). Target: each run ≤ $0.25 and records a coverage map. T-827 fixed the timeout planning after that run.

## Definition of done

- [ ] C1. The median task-run body over the last 20 droplet task runs is 8 minutes or less on c-8 at workers 2.
- [ ] C2. Suite runs per merged ticket average 1.6 or less over the last 50 merges.
- [ ] C3. Over the last 50 task runs, 10 % or fewer were red and 5 % or fewer red on a flake.
- [ ] C4. Over the last 50 merges, the median batch wall is 15 minutes or less.
- [ ] C5. Nightly soaks on at least 5 of 7 consecutive days each finish under $0.25 and record a coverage map that task selection uses.
