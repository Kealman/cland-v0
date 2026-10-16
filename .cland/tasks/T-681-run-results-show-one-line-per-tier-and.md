---
id: T-681
kind: task
title: Run results show one line per tier, and cland verify --dry-run prints the admission report without queueing
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-679
topic: null
branch: null
created: 2026-10-16T19:59:27.868Z
updated: 2026-10-16T20:00:51.556Z
---

## Summary

Nobody can see the tiers until a run says what each one cost. Week 0 adds tier-wall lines to every run report, report-only (memo §5.5 step 0), and a dry run the Reviewer can read instead of running anything (memo §5.4). It also carries T-662's tier counts in the result and its census share.

## What to build

- **Tier lines.** Every run result and log gets one line per tier that ran: files, tests, observed test-seconds, the projected wall at the run's worker count, and the tier's wall budget (T1 120 s, T2 480 s, T3 900 s). The projection uses `durations.json` seconds, the same way the close-run planner does. A tier over its wall prints `over wall (report only)`; nothing fails on a tier line.
- **Share.** The result ends with `tier share: T1+T2 <p> % of <s> s (T3 <s> s, T4 <s> s)` over the manifest seconds of the files the run planned, and a full run's share is the number E-677's exit reads.
- **Dry run.** `cland verify --dry-run` (and the MCP `verify` request's `dryRun: true`) runs admission and selection and prints the mode, reason, deciding files, planned tiers and tier lines. It creates no queue entry, lease or droplet and reserves no spend. Later tickets add their lines to the same report: test lint (T-682) and budgets (T-683).

## Acceptance criteria

- [ ] C1. A task run's result shows one line per planned tier with files, tests, observed seconds, projected wall at the run's workers and the tier's wall budget, proved by a run-report test.
- [ ] C2. The result shows the T1+T2 share of the planned files' manifest seconds, proved by the same test.
- [ ] C3. `cland verify --dry-run` prints the selection and tier lines and leaves no queue entry, lease, droplet or spend reservation, proved by a CLI test against `projectHub`.
- [ ] C4. A tier over its wall budget prints a report-only notice and the run's exit is unchanged, proved by a test with a planted manifest.
- [ ] C5. The share of a full run at the merge head is recorded on this item as the tier baseline.
