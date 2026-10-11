---
id: T-218
kind: task
title: "Research: verification at crew scale (suite anatomy, test architecture, merge queues, cland verify)"
state: open
status: backlog
labels:
  - tech-debt
  - research
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-11T08:52:15.216Z
updated: 2026-10-11T08:52:15.216Z
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
