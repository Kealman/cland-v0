---
id: E-880
kind: epic
title: "Verification speed: think through how to reach the merge-queue targets v0.1.4 measured short"
state: open
rank: 4110
labels:
  - epic
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-19T15:24:04.550Z
updated: 2026-10-20T05:13:55.343Z
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

## Comments

### coord · 2026-10-19T15:29:27.845Z

D66 (the human, 2026-10-19 15:28Z): the speed targets are not taken into v0.2. For v0.1.4 the measured values count as meeting E-678's targets. This item moves from R-377 to Ideas as a later study of how to reach the original targets. The measurements and Definition of done above stay as the reference.

### coord · 2026-10-19T19:24:56.064Z

D66 applied to E-677 (2026-10-19 19:25Z): T-775 C2 measured T3 manifest seconds at 2356.81 s against the 2150 s target, a 206.81 s miss (T1 13.83 s, T2 423.22 s, T4 120.13 s; A-6297 at 1d81bd6e, durations 595c7f01). T-775 C3's spawn census against the 150-start goal is recorded on T-775 when measured. Both are inputs to this study.

### coord · 2026-10-19T19:40:16.101Z

T-775 C3 (the spawn census against the 150-start goal) was not measured in v0.1.4. The local census run on the crew Mac pushed the load to 51 and starved the hub (nice 5) for about 5 minutes; the Coordinator stopped it. A future census needs a quiet machine or a droplet run.

### coord · 2026-10-20T05:13:55.343Z

Carried from the v0.1.4 DoD demos (2026-10-20, all at the release candidate 824105c5):
- E-677 C7 (D74): T1+T2 phase walls measured 485.66 s and 661.42 s on two c-8 shards (A-7022), target 480 s. The projection said 214.75 s; the gap between projection and wall (per-file and per-phase overhead) needs study.
- E-677 C4 (≤ 150 hub starts): the first full-run census of v0.1.4 (E-578 demo, A-7052/A-7053) counted 176 canonical daemon starts at S. Check that it counts the same thing as C4's "hub process starts" before using it as the baseline.
- E-578 C2: two-shard stage wall 1615.43 s against 600 s; shard spread 370 s.
- E-578 C5: T-396's local 4/5/6 and c-16 4/6/8 rows were never measured.
- E-578 C6: T-393's 20 migrated files −2.1 % against −20 %.
- E-578 C4 / T-394: selected-run suite median 2.0 min (8/10 under 5 min); end-to-end verify overhead (queue, delivery, collection) not measured; T-394 C7's ≤ 15 % coverage-recording overhead was never measured.
- E-678 C1/C2/C3/C5/C7: see A-7035 (task-body median 12.9 min, 2.31 runs per merge, red 15 %, batch median 40 s, soak timeout and budget red, no coverage maps).
