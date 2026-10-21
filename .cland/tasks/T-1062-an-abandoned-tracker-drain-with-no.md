---
id: T-1062
kind: task
title: An abandoned tracker drain with no pending operations is reported as not abandoned, so stop skips the fatal-exit fallback
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-21T14:17:11.952Z
updated: 2026-10-21T14:17:11.952Z
---

## Summary

`serveProject.storageAbandoned` is inferred from `tracker.storageStatus().abandoned.length`. A `tracker-storage-abandoned` event with `operations: []` therefore reports false and bypasses the CLI's fatal-exit fallback. Found aside by impl-1060 while fixing T-1060, where exactly this event (`{"timeoutMs":2000,"operations":[]}`) preceded a hub that stayed alive after "stopped".

## What to build

The tracker exposes the actual abandonment flag, set whenever the background drain times out, with or without pending operations. Serve uses that flag, so a timed-out drain always takes the fatal-exit fallback.

## Acceptance criteria

- [ ] C1. A background drain that times out with no pending operations reports abandoned, and the served hub takes the fatal-exit fallback and exits (test through a real `hub serve`).
- [ ] C2. A drain that completes in time reports not abandoned, and stop exits normally (test).
