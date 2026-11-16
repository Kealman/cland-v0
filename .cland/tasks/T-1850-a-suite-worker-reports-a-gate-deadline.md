---
id: T-1850
kind: task
title: A suite worker reports a gate-deadline expiry as 'hub stopped before worker admission completed'
state: open
status: planned
size: XS
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-14T03:47:22.789Z
updated: 2026-11-16T07:31:12.504Z
---

## Summary

`hub/src/hub/suite-worker.ts:34–42` reports the same cause, "hub stopped before worker admission completed", for two different outcomes: a signal or owner shutdown, and the plain expiry of its 15 s wait for the admission gate while the hub is still alive. Found aside by T-1846: in batch a52745fe (A-19260) the gate was never written because the hub's own identity probes were intercepted by a test fixture's `ps` wrapper. The receipt still read as a hub stop, which first sent the diagnosis the wrong way.

## What to build

The worker's result names which of the two happened: a signal received (named), or the admission gate not written within the named 15 s bound. The run log and the native completion carry the distinct cause. Consumers that match on the old text are found and migrated (rule 20).

## Acceptance criteria

- [ ] C1. A worker whose gate is never written, while no signal arrives, reports a gate-deadline cause naming the bound, distinct from a signal stop (test).
- [ ] C2. A worker that receives SIGTERM before admission reports the signal cause, and every consumer of the old cause text is listed on this item and still passes (test).
