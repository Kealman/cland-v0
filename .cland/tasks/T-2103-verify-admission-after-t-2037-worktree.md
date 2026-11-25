---
id: T-2103
kind: task
title: "Verify admission after T-2037: worktree tier lint and tier planning still cost about 1.7–2 s per request under a 10-way crew load"
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
created: 2026-11-25T08:26:50.834Z
updated: 2026-11-25T08:26:50.834Z
---

## Summary

This is a follow-up from T-2037 (impl-2037, 2026-11-25). With the duration manifest parse cached, so each manifest is tokenized once instead of 50 times, ten concurrent fake-only admissions take about 4.6–5.0 s on macOS with Node 24. That's inside the 90 s CLI wait. The trace still shows two dominant phases per request, as overlapping concurrent wall time rather than CPU sums:

- worktree-tier-lint: about 1.68–2.07 s;
- tier-plan: about 1.70–2.02 s.

immutable-tier-lint is 402 ms cold and 49–77 ms warm.

## What to build

Profile and cut both phases. For example, share worktree tier lint results across concurrent admissions of the same tree, and memoize tier planning by its exact inputs. Keep a deterministic work-count regression for each, as T-2037 did.

## Acceptance criteria

- [ ] C1. Under the same 10-way fake-only crew fixture, worktree-tier-lint and tier-plan each do work once per distinct input, shown by a work-count test that fails red before (test).
- [ ] C2. The crew admission wall is reported before and after on a 2-worker Linux droplet run (evidence).
