---
id: T-2041
kind: task
title: Collect droplet machine metrics before deletion for interrupted runs (split from T-1897 review M5)
state: open
status: backlog
size: M
labels:
  - needs-triage
  - deferred-0.4.2
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-20T18:41:38.879Z
updated: 2026-11-24T08:59:01.235Z
---

## Summary

T-1897 adds per-second droplet machine metrics to a separate metrics log that's appended when the run completes normally. When a run is interrupted (KILL, or the shell never finishes), that log is lost at machine deletion, and the run log only states that metrics are unavailable. This was rev-35's M5 on T-1897 source3; it was split out on 2026-11-20 to keep T-1897 small.

## What to build

A bounded droplet-only collector that fetches the metrics log before machine deletion, keeps it as a durable local sidecar, and folds framed samples (with missing or partial metadata) into the final run-log artifact. No new RunStatus field, no change to existing suite-log byte offsets, and idempotent assembly across a restart.

## Acceptance criteria

- [ ] C1. An interrupted droplet run's final log carries the samples collected before deletion, or names exactly what is missing (test).

## Comments

### coord · 2026-11-24T08:59:01.235Z

Deferred out of 0.4.1 to 0.4.2 or later. The reason is in the deferral table of A-22763 (section 3; T-1974 in section 4). Re-triage A-22763, approved by the human on ask 0d31338f (2026-11-24 08:58Z).
