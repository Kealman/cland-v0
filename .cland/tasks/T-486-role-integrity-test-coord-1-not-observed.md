---
id: T-486
kind: task
title: "role-integrity test: coord-1 not observed idle within 15 s on a loaded Linux droplet"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T10:27:52.273Z
updated: 2026-10-15T10:28:04.004Z
---

## Problem

`hub/test/role-integrity.test.ts:84` timed out on Linux in T-454's droplet verify 52b10e3c (A-2870, load ≈12 on c-8). The failure was "coord-1 present as idle: not within 15000 ms".

impl-454 ruled out the heartbeat timer, which T-454 adds:
- The case passes locally with the timer active (A-2876) and with its tick callback disabled (A-2877).
- The clean fixture uses the 1 h Coordinator default, the harness strips inherited CLAND_* variables, and fake.env sets no heartbeat override.

It looks like the same family as the other idle-observer timeouts under load in E-482, not a T-454 defect.

## Acceptance criteria

- [ ] C1. The first idle observation of coord-1 in role-integrity.test.ts:84 no longer races launch under load. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
- [ ] C2. role-integrity.test.ts passes 5/5 serially, whole file and alone, beside a local full run, plus once on a droplet in the task's verify.
