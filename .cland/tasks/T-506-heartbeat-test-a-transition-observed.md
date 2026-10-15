---
id: T-506
kind: task
title: "heartbeat test: a transition observed during the test is aged from the fixture's old updated date (Linux)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-454
topic: topic-304
branch: t/T-506-heartbeat-test-a-transition-observed
created: 2026-10-15T15:16:16.009Z
updated: 2026-10-15T15:19:10.326Z
---

## Problem

`hub/test/heartbeat.test.ts:260` failed on Linux in T-495's droplet verify d6e75622 (A-3101): expected 0 heartbeats, got 1. The watched review→ready transition took a newly observed stale state as already aged, because the item carried an old `updated` date. This is T-454's test, so it's rework of T-454.

## Acceptance criteria

- [ ] C1. The case controls the item's `updated` time, or the clock it's aged against, so a transition observed during the test is never aged from a fixture date. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. heartbeat.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-506 · 2026-10-15T15:19:10.326Z

Baseline targeted case passed once (1.65 s). The case currently uses real 200 ms age while serially awaiting two watched file edits; scheduler delay can mature the first transition before the first assertion. Plan: retain real tracker watcher and assertions, use existing in-process HubOptions.now seam to pin observation/firing time and advance the clock explicitly. No production behavior change.
