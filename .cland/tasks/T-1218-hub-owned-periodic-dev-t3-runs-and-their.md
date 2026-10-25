---
id: T-1218
kind: task
title: Hub-owned periodic dev T3 runs and their artifacts are attributed to the human
state: open
status: in progress
size: XS
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: null
branch: t/T-1218-hub-owned-periodic-dev-t3-runs-and-their
created: 2026-10-24T09:20:07.524Z
updated: 2026-10-25T09:55:00.799Z
---

## Summary

The periodic dev T3 is submitted by the hub itself, but the heartbeat lists it as "run … running · human", and its log and coverage-map artifacts are posted in General as messages from the human (from_kind human; A-10360 at 07:17Z, A-10635 and A-10636 at 09:19Z on 2026-10-24). On 2026-10-24 the Coordinator took the red periodic run f00422cf for the human's own run and told the human so, then had to correct it.

## Acceptance criteria

- [ ] C1. A periodic dev T3 run, its heartbeat line and its artifact posts name the hub (or a "periodic" origin) as their author, not the human (test).
- [ ] C2. Runs the human submits from their own shell are still attributed to the human (test).
