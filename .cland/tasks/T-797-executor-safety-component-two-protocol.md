---
id: T-797
kind: task
title: 'executor-safety-component: "two protocol projects reserve against one cap…" times out waiting for the remote result (30 s) on a droplet'
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
created: 2026-10-18T10:16:24.882Z
updated: 2026-10-18T10:16:24.882Z
---

## Summary

hub/test/executor-safety-component.test.ts, "two protocol projects reserve against one cap and confirmed release replaces the reservation", failed in T-710's droplet verify bc1cf31c (A-5185, Linux c-8, Node 24.21.0) with "remote result: not within 30000 ms". On the Mac it passed 6/6 alone under Node 24.21.0, both at T-710's head 0b70662f and at dev 1a20fb92, at 0.4–1.1 s per case. A first local attempt under Node 25.6.1 reproduced the timeout. It has not failed in the other ~60 recent droplet logs. A wall-clock 30 s wait on a remote result in a T2 component test suggests a lost wake-up or an ordering race between the two projects' reservations.

## Acceptance criteria

- [ ] C1. The root cause is named. The Node 25.6.1 reproduction is the first lead: run the file under Node 25 to get a deterministic repro if possible.
- [ ] C2. The test waits on an observed event or FakeClock step instead of a 30 s wall-clock deadline, keeping every assertion, and passes 20/20 under both Node 24 and 25.
