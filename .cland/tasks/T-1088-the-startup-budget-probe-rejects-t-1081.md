---
id: T-1088
kind: task
title: The startup budget probe rejects T-1081's first payload because it now carries closed containers
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T00:25:33.925Z
updated: 2026-10-22T00:25:33.925Z
---

## Summary

`nvim/test/startup-budget-probe.ts`, E-1006's copied-tracker startup measurement (DOD-07), asserts that Neovim's first payload carries open items only. Since T-1081, that request also returns closed releases and epics, because containers stay in the open snapshot. The probe now fails its id check before it prints a measurement. It is a script, not a suite test, so no run catches it. Found while drafting the E-413 stage 1 QA brief.

## Acceptance criteria

- [ ] C1. The probe accepts T-1081's open snapshot (open items plus every container) and prints the first-payload bytes and render time on a copy of the live tracker.
- [ ] C2. A test runs the probe's assertion logic on a small fixture, so a future change to the first payload shape fails a test instead of the probe.
