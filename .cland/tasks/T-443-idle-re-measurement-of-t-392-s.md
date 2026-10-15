---
id: T-443
kind: task
title: "Idle re-measurement of T-392's inspection diet: default-subscriptions and session-resume whole-file times"
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-15T00:22:42.822Z
updated: 2026-10-15T00:22:42.822Z
---

## Summary

T-392's C6 (a 15% drop in the whole-file times of default-subscriptions.test.ts and session-resume.test.ts) could not be measured on an idle machine during the v0.1.2 build. The verify queue never emptied, and the load was 16–18 on 10 CPUs. It was amended to the measured spawn reduction (538 to 197 inspection spawns per default-subscriptions run, about 63%) plus no paired-median regression. On a quiet machine (an empty queue, or a droplet), measure both files three times each before and after, and record whether the idle 15% target holds. Candidate for E-387 (v0.1.3).

## Acceptance criteria

- [ ] C1. Three idle runs per file at the pre-T-392 and post-T-392 heads are posted, with the one-minute load and the medians, and the result says whether 15% was reached.
