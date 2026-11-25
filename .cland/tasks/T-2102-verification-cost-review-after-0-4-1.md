---
id: T-2102
kind: task
title: "Verification cost review after 0.4.1: droplet spend per landed item, full-selection fallbacks, Linux T3 slowdown, unsharded run limit and droplet sizing"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-11-25T07:11:26.501Z
updated: 2026-11-25T10:12:41.173Z
---

## Summary

The human asked on 2026-11-25, in General, for a review of droplet verification cost after 0.4.1. They called the bill large, and said the c-16 size override used tonight for T-1928, T-2013 and T-1926 is a temporary measure. Spend on 2026-11-25 by 07:10 UTC was $7.64 spent plus $2.25 reserved, against the $14 daily cap.

## Drivers seen on 2026-11-25

1. **Full-selection fallbacks.** A diff touching a shared test helper, or a per-file test guide under docs/agents/tests/*.md, can't be mapped by coverage selection. The verify then runs all of T2 plus broad T3. Four task verifies tonight fell back this way (T-2010, T-2062, T-1998, T-2013); see rules-batch item de.
2. **Linux T3 slowdown.** The same T3 cases run 2–4 times their per-case baselines on c-8 droplets (T-2099). A full T3 is about 51 minutes unsharded.
3. **Unsharded full runs exceed the 75-minute limit** and need a retry (T-1928, T-2013, T-1926, and dev-T3 41f9200a; T-2100). Sharded merge batches finish in 28–33 minutes.
4. **Every merge batch runs a full T3**, about $0.17–0.22 each, on top of each member's task verify.

## What to decide

Measure cost per landed item over the 0.4.1 run, then propose changes with their effect on spend and on wall time. Examples: map test guides to their tests in selection, attribute or fix T-2099, apply the T-2100 policy, choose droplet sizes per run kind, and avoid duplicating task-verify T3 work in batches. The human decides.

## Acceptance criteria

- [ ] C1. A cost breakdown for the 0.4.1 run: spend by run kind (task verify, batch, cover, soak, dev-T3) with run counts and average minutes, from the spend and suite receipts (evidence).
- [ ] C2. A ranked proposal list, each with its estimated saving and wall-time effect, presented to the human for decision (evidence).

## Comments

### coord · 2026-11-25T07:47:38.298Z

c-16 data from 2026-11-25, the human's temporary measure for three items that timed out on c-8. All three full task verifies passed, Web included:

| Item | Run | Wall | Cost |
|---|---|---|---|
| T-1928 | 41546aee | 2,543 s | $0.3532 |
| T-2013 | 638ac98b | 2,587 s | $0.3593 |
| T-1926 | 7a631548 | 2,668 s | $0.3705 |

All ran on c-16 with 4 workers. The same full selections on c-8 with 2 workers each timed out at 75 min for about $0.32 apiece and produced nothing usable. So for full selections, c-16 costs about the same per run as c-8 and finishes in about 43 minutes instead of failing.

### coord · 2026-11-25T10:12:41.173Z

Data point after hub restart #104 (dev a6ff2853b, 2026-11-25 09:28Z). T-2097's merge batch adb1a896, suite 7338b8d1 (A-23375), ran only the T3 importers its change affects, 8 files, with "remaining T3 deferred to integrated occasions". It finished in 5.5 minutes wall for $0.0305 over two shards, against about 28 minutes and $0.17–0.22 for the full-T3 batches before the restart. If that selection holds for code-changing batches too, it removes driver 4 (every batch running a full T3) from the cost review. Check which landing introduced it, and what the periodic dev-T3 and stage covers now carry in its place.
