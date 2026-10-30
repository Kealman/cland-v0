---
id: T-1268
kind: task
title: "Capture T-1200's first production receipt: a branch adding a Web test file shows the 10-repetition count in its droplet verify"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: t/T-1268-capture-t-1200-s-first-production
created: 2026-10-25T00:56:52.206Z
updated: 2026-10-30T14:41:32.103Z
---

## Summary

T-1200 C2 (a new Web test file passes 10 repetitions at two workers under CPU load before ready, and verify reports the count) is proven by a synthetic diagnostic (`web/test/new.test.ts 10/10` inside suite-runner.test.ts, green in stage covers 8b0010a2 and 27e68fd5). No production receipt exists: since restart #54 no task branch has added a web/test file. Record the first real one.

## Acceptance criteria

- [ ] C1. The first task branch that adds a web/test/*.test.ts file has a droplet verify log showing the 10-repetition count line for that file; its run id and artifact are recorded here, or a missing line is filed as a T-1200 regression.
