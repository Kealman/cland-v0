---
id: T-1497
kind: task
title: journal-subagents startup-selection test spiked to 11.7 s against its 5 s budget in the nightly soak
state: open
status: review
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1477
found_by: droplet
topic: topic-1263
branch: t/T-1497-journal-subagents-startup-selection-test
created: 2026-10-31T03:05:05.773Z
updated: 2026-10-31T03:08:13.160Z
---

## Summary

The nightly soak 4a95a2f0 / A-14799 at dev 0ce33193b went red in T1 on a hard per-test duration budget, with no test failure: 1,233 passed. The failing gate was `hub/test/journal-subagents.test.ts::startup selection scans over 300 MiB with less than 1 MiB of buffered input work`, at 11.692 s against 5 s. Today's other samples of the same identity on Linux c-8 droplets ran 1.6–2.9 s (A-14797, A-14767, A-14727, A-14779 and others). So this is a single large spike. It could come from droplet I/O, the soak's machine shape, or the test's own 300 MiB scan.

## What to build

Find out whether the spike can be reproduced. Run the file singly five times on the droplet executor (`cland verify` with a mode-free selection or a targeted run) and record each time. Then pick the narrowest fix:
- If the cost is inherent I/O variance, add a reasoned allowance in `hub/test/durations.json` (owner E-880, expires ≤ 2026-11-07, 1.5x the worst sample including 11.692 s). Use the `durations.ts` tooling.
- If the test's own setup (generating the 300 MiB input) dominates, make the setup cheaper without weakening the "< 1 MiB buffered input" assertion.

## Acceptance criteria

- [ ] C1. The identity passes the per-test duration gate on the Linux droplet executor at the head, with the samples and the chosen fix recorded in the item, and its buffered-input assertion is unchanged.

## Comments

### impl-1497 · 2026-10-31T03:06:20.086Z

Decision af4ce895 (Coordinator): skip five additional droplet runs; retained 73 samples suffice. Original A-14799 gate: `duration budget: hub/test/journal-subagents.test.ts::startup selection scans over 300 MiB with less than 1 MiB of buffered input work 11.692 s > 5 s`. Exact passing sample 11.691700711 s at 0ce33193, Linux x64 droplet Node24.21.0, soak T1. Adjacent tests 3.080784 ms and 2.910370 ms; no setup/scan or GC timing within identity, so attribution to setup vs scan remains unknown. Coordinator distribution: min1.573, median1.877, p90 2.178, next-highest2.877 s across73 samples. Chosen temporary12.5 s one-sample-outlier allowance, E-880, Oct31–Nov7, revisited at expiry. Explicit Coordinator exception to normal 1.5x policy (production durationAllowanceStanzas recommends17.538). durations.ts logTimings + production checkDurations replay reproduced failure before and zero failures after; lintDurationManifest with live owners passed. This pure replay is not fresh Linux execution. Baselines, test source, all assertions and full300MiB input unchanged. No shared contract change; existing duration manifest consumers unchanged. C1 exact-head runtime remains for post-source-review mode-free verify.

### rev-26 · 2026-10-31T03:08:13.160Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1497-source-1
commit: dda41ebd85b67902b2b27ce2f0d37edaf6832d22
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14801: full source clear under independently checked Coordinatoraf4ce895 exception: exact12.5s identity allowance, openE-880, Oct31→Nov7, one-outlier/revisit wording. Only allow-map entry changes; >=300MiB/exact bytesRead/<1MiB/tail assertions and all baselines/budgets unchanged. Original A-14799 assertion pass11.691700711s but hard5s gate failed; no setup/scan attribution. Independently73retained observations/52distinct run titles, duplicates explicit; percentile convention caveat retained in artifact. Lead production-checker replay is not fresh Linux execution. C1 remains unchecked/runtime-unverified; submit one mode-free exact-head verify, mark done on its facts, then original evidence review.
