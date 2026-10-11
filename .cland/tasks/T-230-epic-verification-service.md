---
id: T-230
kind: epic
title: "Epic: Verification service"
state: open
labels:
  - epic
  - v0.1.1
assignee: null
parent: T-227
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:48:08.530Z
updated: 2026-10-11T17:49:19.566Z
---

## Goal

Verification becomes a hub-owned service: `cland verify` admits suite runs by load budget and priority from one queue the hub owns, reuses a green result for an identical tree, and shows who waits, who runs and how long.

## Contents

From the T-218 research (A-1142, v0.1.1 row) and decision D21: V1 `cland verify`, a hub-owned scheduler replacing /tmp/cland-suite.lock as the source of truth, with a compatibility shim for hand runs; V2 a result cache keyed by the candidate tree, accepted by the merge gate at the same tree; V3 queue metrics and a queue view with ETA. Plus T-212 (suite cancel), T-213 (two load-sensitive tests), T-215 (shard by resource) and T-220 (Node 24 compile-cache guard).

Constraints: T-209's head-bound verification stays intact; T-207's phase place, T-214's phase selection and T-203's single posted result carry over; while V1 is in flight, every other item keeps using today's lock.

## Definition of done

QA runs the demo below on `dev` in a scratch project and records a clear verdict on this epic with each checkbox verified by its id.

- [ ] `cland verify` queues runs in the hub, admits them by load budget and priority, survives a hub restart, and a hand run of `npm test` goes through the compatibility shim.
- [ ] A green result for a candidate tree is reused for the same tree and accepted by the gate; any tree change runs again; T-209's head binding holds.
- [ ] The queue view and metrics show holder, waiters, wait and run times and an ETA, from the CLI and the workbench.
- [ ] A session cancels its own queued or running suite and the cancellation is posted (T-212).
- [ ] The hub suite is sharded by resource, the two load-sensitive tests are fixed, and the compile cache is enabled only where safe (T-215, T-213, T-220).
- [ ] hub/README.md, the merge and qa skills and the Implementer clause describe `cland verify`.

## Plan

```yaml
stages:
  - name: small fixes and the scheduler
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-212
      - - T-220
      - - T-232
  - name: cache, metrics and shards
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-233
        - T-234
      - - T-213
      - - T-215
```
