---
id: T-1494
kind: task
title: Verifiers can decline or release an accepted request without a verdict
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-30T19:25:12.366Z
updated: 2026-10-30T19:25:12.366Z
---

## Summary

A verifier that accepts a request it will not serve, because the request was withdrawn, is a duplicate, or is already owned by another verifier, has no way to release the pending reservation except posting a verdict. `task.hold` release only removes a real tracker hold. On 2026-10-30 this left rev-26 excluded from assignment for an hour (T-1487). T-1487 retires stale pendings automatically on later verdicts and accepted newer requests. An explicit decline would close the remaining gap: the verifier states the reason, and the request goes back to the queue or to the requester.

Origin: impl-1487's T-1487 scope note (2026-10-30). Adding it means a role-tool change and a relaunch (role tools are fixed at launch), so it needs its own item.

## Acceptance criteria

- [ ] C1. A verifier declines an accepted request with a one-line reason; the pending reservation clears at once, the requester gets the reason, and the request is reassigned or returned without a verdict being recorded.
