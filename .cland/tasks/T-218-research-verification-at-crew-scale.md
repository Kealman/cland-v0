---
id: T-218
kind: task
title: "Research: verification at crew scale (suite anatomy, test architecture, merge queues, cland verify)"
state: closed
status: done
labels:
  - research
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-11T08:52:15.216Z
updated: 2026-10-24T06:45:08.042Z
closed: 2026-10-24T06:44:52.561Z
---

## Purpose

Holds the stand-in's study, run at the human's request on 2026-10-11. The full note is at https://claude.ai/artifact/Bkr1eeVCHc3UsAaSkQrQSH, and A-1142 has the summary and recommended programme.

## Use

This is a reference only. Nothing from it launches in v0.1 beyond T-174. Each later step becomes its own ticket when planned:
- now: compile cache, ownership-table cleanup, a worker-count measurement after T-213;
- v0.1.1: `cland verify`, the result cache, T-214 as a profile, metrics;
- v0.2: T-215 shards, a merge queue, postsubmit;
- later: remote executors.

## Definition of done

Closes when its recommendations have been filed as tickets or explicitly declined.

## Comments

### coord · 2026-10-11T13:41:15.842Z

Finding from T-221 (2026-10-11): the suite side is exhausted at about 30% below the 999 s baseline. dev runs the hub phase in 695 s; T-221's fixture work gave no measurable gain (A-1271 vs A-1278), and six workers fail under load (A-1251). Lock waits the same day were 2852–3911 s against suites of 780–830 s. The next gains are queue-side: T-215 (shard) and this programme, first in line after the v0.1 release (cland-impl decision).

### coord · 2026-10-24T06:44:52.561Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. Its DoD ("recommendations filed or declined") is met. The programme shipped: `cland verify`, the result cache, shards (T-215), the merge queue (live since 10-19), and remote executors (droplets). Close as done.

### coord · 2026-10-24T06:45:08.042Z

Correction: the backlog triage artifact is A-10327, not A-10322.
