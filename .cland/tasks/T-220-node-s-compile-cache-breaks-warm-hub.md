---
id: T-220
kind: task
title: "Node's compile cache breaks warm hub loads on Node 24: re-enable it only on a safe runtime"
state: open
status: backlog
labels:
  - ready-for-agent
  - tech-debt
  - low
assignee: null
parent: T-230
blocked_by: []
topic: null
branch: null
created: 2026-10-11T09:22:48.031Z
updated: 2026-10-11T17:48:38.235Z
---

## What happened

T-174 turned on Node's module compile cache (`NODE_COMPILE_CACHE`, shared by all processes in a suite run) to speed up hub starts in tests. On the supported Node 24.21.0, a cold load of `core.ts` / `new HubCore()` passes. Later warm loads from the same cache crash with SIGSEGV or throw private-brand TypeErrors ("Receiver must be class #roles/#topicStatuses/#items"). No daemon, fixture or duplicate module graph is needed to reproduce it.

Node 25.6.1 passes all three loads, but it is outside the repo's engine range. In the T-174 run at 3716cd7, 682 of 980 hub tests failed this way (A-1151, A-1152). impl-174 isolated the cause and removed automatic cache activation from T-174 (topic-119, 2026-10-11). Its minimal reproduction artifact is in topic-119.

## What to build

Get the compile-cache speedup back without the crash. The likely fix is to enable it only on a Node version shown to be safe, or to use a per-process cache directory if that avoids the fault. Decide whether to report the bug upstream to Node.

## Acceptance criteria

- [ ] The minimal reproduction from topic-119 is checked in as a test, or recorded as a documented manual check, against the engine range.
- [ ] The cache is enabled only where the reproduction passes. Otherwise this item closes as wontfix, with the measurement of what the cache would have saved.
- [ ] A full `cland suite all` passes on the supported Node with the change.
