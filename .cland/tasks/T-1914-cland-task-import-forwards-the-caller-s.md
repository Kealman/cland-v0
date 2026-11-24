---
id: T-1914
kind: task
title: cland task import forwards the caller's ambient CLAND_LAUNCH_TOKEN on its nested hub frame even when an explicit environment or human actor is given
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: null
branch: null
created: 2026-11-16T14:56:30.107Z
updated: 2026-11-24T09:01:21.618Z
---

## Summary

`hub/src/cli/task-import.ts:186` accepts an explicit environment for discovery and the actor, but its nested `askHubFrame` call omits that environment. An in-process caller's ambient `CLAND_LAUNCH_TOKEN` can therefore be attached to a frame that claims an explicit human actor, mixing a session credential into a human action. Found by impl-1904 during T-1904, 2026-11-16 (topic-1556); T-1904 seals only its test helper.

## What to build

Pass the explicit environment to every nested hub frame in `task-import`, so a frame carries only the credential of the identity it claims. Do the rule 20 sweep for other CLI commands that take an explicit environment but use the ambient one on a nested frame.

## Acceptance criteria

- [ ] C1. With an ambient session launch token set, `task import` given an explicit human actor and environment sends its nested frames with no session credential, shown by the frame the fake hub receives (test, red before the fix).
- [ ] C2. Other CLI commands with explicit environment parameters are swept; each nested frame uses the explicit environment or is named as unaffected (test).
