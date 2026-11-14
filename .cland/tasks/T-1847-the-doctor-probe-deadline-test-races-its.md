---
id: T-1847
kind: task
title: The doctor probe-deadline test races its hanging probes' pid writes (red 1 in 5 alone)
state: open
status: planned
size: S
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-14T01:15:21.748Z
updated: 2026-11-14T01:16:18.758Z
---

## Summary

`hub/test/doctor-cli.test.ts` "a probe that never answers is cut at its deadline: the lock probe and a harness both, and their whole process group is killed" is intermittently red on dev, even when run alone. It sets `CLAND_DOCTOR_PROBE_TIMEOUT_MS: '1000'` and then expects at least four recorded pids (each hanging probe and its `sleep` grandchild). Sometimes only two are written before the 1 s cut kills the probes.

## Evidence

- E-1537 stage-2 macOS cover d6128175 at dev ae0a2c2b9 (log A-19235, local darwin arm64, 1 worker), test line 179: `AssertionError: the ps probe and the claude probe each ran, with a grandchild: 8126 8200`.
- Run alone five times on a quiet Mac (2026-11-14 01:14Z, CLAND_* stripped): 4 passed and run 3 failed, each in about 3.5 s. So this is not only a load flake.
- The test and the doctor code have not changed recently (last commits T-1600, T-1593, T-1617).

## What to build

The case proves the deadline cut and the process-group kill without racing the probe scripts' own startup. For example: wait until each hanging probe has recorded its pid and its grandchild's pid before the deadline can fire, or drive the deadline from a controlled clock. A probe that is killed before it records stays distinguishable from a probe that never started.

## Acceptance criteria

- [ ] C1. The assertion no longer depends on both probes writing their pids within the 1 s probe deadline, and a regression that skips the process-group kill still fails it (test).
- [ ] C2. The case passes 20 lone repetitions on macOS and the load gate's five on Linux (test).

## Comments

### coord · 2026-11-14T01:16:18.758Z

Moved into R-1530 by ask 96990fef, answered 2026-11-14 01:16Z: land the test-timing fixes locally, then rerun the E-1537 stage-2 macOS cover.
