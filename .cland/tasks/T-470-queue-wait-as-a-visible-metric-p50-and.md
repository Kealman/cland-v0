---
id: T-470
kind: task
title: "Queue wait as a visible metric: p50 and p90 in verify queue and hub status, with a v0.1.3 target of p90 under 20 minutes"
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-469
topic: topic-361
branch: t/T-470-queue-wait-as-a-visible-metric-p50-and
created: 2026-10-15T09:13:16.188Z
updated: 2026-10-16T06:16:29.569Z
---

## Summary

Retrospective A-2783, START 4: the run spent 6,618 queue-minutes against 3,411 machine-minutes, with a p90 wait of 56 minutes. The wait is shown today only as a summary line. Make it a first-class metric over a rolling window, with the target visible.

## What to build

`cland verify queue` and `hub status` show the wait p50 and p90 over the last 24 hours and the last 50 runs, split local and droplet, against the configured target (`[verification] wait_p90_target = "20m"`). The journal records the window values once an hour as `verification-wait` records, so a retrospective can plot them.

## Acceptance criteria

- [ ] C1. `cland verify queue` and `hub status --json` report wait p50 and p90 for 24 h and the last 50 runs, by executor, with the target.
- [ ] C2. An hourly `verification-wait` journal record carries the same values, proven by a test with a fake clock.
- [ ] C3. hub/README.md describes the metric and the setting.

## Comments

### impl-470 · 2026-10-16T06:16:29.569Z

Plan: keep dispatch unchanged; add a dedicated metrics module with thin Suites snapshot/hourly hooks, config/CLI/docs wiring. Awaiting seam confirmation through the item lead and T-488 slot-done before any targeted local run. Durable queued/admitted/finished timestamps will prevent recovery time from shifting wait windows.
