---
id: E-482
kind: epic
title: "Flake sweep: the load-sensitive tests found in v0.1.2"
state: open
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:14:14.206Z
updated: 2026-10-15T09:14:33.805Z
---

## Goal

The load-sensitive tests found during the v0.1.2 run and the start of v0.1.3 are fixed in one place, so that task gates and integrated covers stop going red on known flakes. Each one is made to wait on the state it asserts, never on wall time, and keeps its meaning. This is the retrospective's STOP 4 (A-2783), applied to the backlog the run produced.

## Contents

T-442 (sessions midnight reset), T-445 (suite cleanup observer), T-446 (artifact-browser socket), T-449 (session-stop-races probe.json), T-453 (executor-run lock.break scan), T-463 (session-usage restart publications), T-465 (codex-adapter rateLimitsAt), T-467 (codex-adapter steer recovery) and T-481 (executor-prepare release record).

## Definition of done

QA runs each fixed file 5 times serially beside a local full run and once on a droplet, and records the results per ticket. The verdict closes the epic.

- [ ] C1. Every child's file passes 5/5 beside a local full run and once on a Linux droplet.
- [ ] C2. No child weakens an assertion or widens a time bound without a recorded reason.

## Plan

```yaml
stages:
  - name: the sweep
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-481
        - T-453
        - T-465
        - T-467
      - - T-445
        - T-449
        - T-463
      - - T-446
        - T-442
```
