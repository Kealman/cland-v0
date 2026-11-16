---
id: T-1897
kind: task
title: c-4 control run and per-second load metrics
state: open
status: backlog
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:29:46.333Z
updated: 2026-11-16T07:29:46.333Z
---

## Summary

The human decided on 2026-10-17 to size the droplet after the test optimisation. `executor/droplet/health.ts` already samples iowait and steal; per-second cadence is unverified. §7 #11.

Kind: config + measurement. Triage ticket H-9 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

implements the human's 2026-10-17 decision. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. Droplet run logs carry load, CPU and iowait at about 1 s resolution (test).
- [ ] C2. One c-4 workers-2 cover at a tree with a green c-8 cover is compared with it for wall time, reds and cost in an artifact (evidence).

## Dependencies

after A1 stage 1
