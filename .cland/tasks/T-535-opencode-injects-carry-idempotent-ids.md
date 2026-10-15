---
id: T-535
kind: task
title: OpenCode injects carry idempotent ids, and child sessions feed the instrumentation
state: open
status: planned
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: null
branch: null
created: 2026-10-15T20:59:19.616Z
updated: 2026-10-15T20:59:36.003Z
---

## Summary

E-424 slice 5 (tracer step 5). OpenCode injects carry caller-chosen idempotent ids, so a retried inject is admitted once. Child sessions feed the instrumentation of v0.1.2 §3.12: their model, their usage and their pending approvals.

## What to build

See E-424's "Idempotent ids" and "Child sessions" bullets.

- **Idempotent ids.** Each inject carries `msg_` plus a hash of the cland message id and the session. A retried inject returns the first admission, and a broadcast gets one id per recipient. This stays inside the adapter, with no contract change.
- **Child sessions.** A `session.created` with a `parentID` becomes the existing sub-agent signal (`SubagentLaunch`), carrying the child's model. A child's steps add to the parent's usage. A child waiting for approval shows its parent as waiting.

Code: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/client.ts`, `hub/src/adapters/opencode/state.ts`.

## Acceptance criteria

- [ ] C1. A timed-out inject retried at the next idle reaches the fake server once, and a broadcast's recipients each get their own id.
- [ ] C2. A child session's model appears in the sub-agent launch record and its usage adds to the parent's usage record.
- [ ] C3. A child waiting for approval shows its parent session as waiting.
