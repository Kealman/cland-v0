---
id: T-1104
kind: task
title: Hub startup recomputes the explorer per item during the planned check and delays serving by 15 s
state: open
status: backlog
size: S
labels:
  - needs-triage
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T10:11:00.318Z
updated: 2026-10-22T10:11:00.318Z
---

## Summary

Hub restart #43 at dev 7887f694 (2026-10-22 10:08Z) took 20 s from stop to serving, against 4–5 s at #40–#42. In .cland/log/hub.log, between "binding listeners" (10:08:48.71Z) and "restoring sessions" (10:09:03.93Z) the hub logged `tracker-storage-stalled {"operation":"planned check","item":"E-413","thresholdMs":5000}` and 755 `explorer-recomputed` events, one per tracker item about 15 ms apart, and serving waited for them. New since #42: T-1054 (marks store), T-1056 (thread runs store) and T-1057 (ask outcomes). The startup planned check appears to recompute the explorer once per item instead of once per batch. Measured by cland-impl.

## Acceptance criteria

- [ ] C1. A hub start on a copy of the live tracker recomputes explorer summaries once per startup batch (or lazily), not once per item: a regression counts recompute events on a thousand-item fixture with a planned epic (test).
- [ ] C2. The startup planned check does not block "serving": a copied-live-tracker start reaches serving within 2 s of listening on the Linux droplet, and the receipt is listed in the item topic (test).
