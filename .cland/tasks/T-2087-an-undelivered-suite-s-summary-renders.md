---
id: T-2087
kind: task
title: An undelivered suite's summary renders "tier share" percentages and seconds from projections although no runtime tier executed (rule 17)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T12:21:30.658Z
updated: 2026-11-24T12:21:30.658Z
---

## Summary

Found by T-2009's reviewer and reported by impl-2009. Suite 32a42a6f (A-22921) failed delivery (SSH timeout to the droplet), so no runtime tier ran: tests 0, observed unavailable. Its summary still renders "tier share: T1+T2 61.587 % of 1303.679 s (T3 95.088 s, T4 0 s, Web 405.69 s)". These are projected durations, shown as if they were measured share and wall time. Rule 17 says an unexecuted or projected value must be labelled as such and never shown as a measurement.

## What to build

When a tier didn't execute, render its share and seconds as "unavailable", or label them explicitly as "projected", in the suite summary and in every consumer that prints tier share. Executed tiers keep their measured values.

## Acceptance criteria

- [ ] C1. A suite result with every runtime tier unexecuted prints no tier-share percentage or seconds as measured; it shows "unavailable" or an explicit "projected" label (test).
- [ ] C2. A partially executed suite labels only its unexecuted tiers that way (test).
