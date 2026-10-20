---
id: T-931
kind: task
title: Re-enable duration-budget enforcement with variance-based headroom (after D73)
state: open
status: backlog
size: M
labels: []
assignee: null
parent: E-880
blocked_by: []
topic: null
branch: null
created: 2026-10-20T02:57:12.628Z
updated: 2026-10-20T02:57:23.417Z
---

## Summary

D73 turned duration budgets back to report mode for the v0.1.4 release, because enforce mode failed every stage cover on load variance alone (tests near their budget varying ±15–20 % between runs), while the peak-based headroom rounds T-923 and T-929 lagged behind. Re-enable enforcement with headroom designed for variance.

## What to build

Derive per-identity allowances from the distribution of observed times across recent green runs (Linux droplet and macOS, for example p99 plus a margin), not from single peaks. Decide whether local macOS runs enforce or only report. Switch `budget.mode` to enforce once a replay of the last N stage, periodic and soak logs shows zero failures at that headroom. Also retire the temporary 2026-11-19 allowances from T-915, T-923 and T-929 into the new scheme.

## Acceptance criteria

- [ ] C1. The headroom rule is documented and implemented in the refresh tool.
- [ ] C2. Replaying the last 10 stage and periodic logs at enforce shows zero budget failures.
- [ ] C3. Enforce is switched on, and the next two periodic dev runs are green.

## Comments

### coord · 2026-10-20T02:57:23.417Z

Context: enforce was live from T-915 (~00:41Z, 2026-10-20) until T-930 (D73). It correctly refused T-670's unbaselined T3 growth, then failed stage covers #3/#4 and periodic A-6900 on load variance alone; T-923 (80 %) and T-929 (60 %) peak-plus-50 % headroom rounds did not converge.
