---
id: T-587
kind: task
title: A queued role-addressed QA request isn't delivered when the verifier goes idle
state: open
status: backlog
size: S
labels:
  - needs-triage
  - hub
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T10:42:55.641Z
updated: 2026-10-16T10:42:55.641Z
---

## Summary

A `qa request E-387` sent to the `qa` role at 10:28:27Z came back `queued` ("waiting for the next free live verifier for E-387; the hub will deliver automatically"). It stayed undelivered for about 20 minutes, while the only QA session, qa-27, was idle with no holds (`who` at about 10:48Z). The Coordinator resent it to qa-27 by name, and that reached it.

## Context

- At queue time, qa-27 had just recorded its E-423 verdict (10:27:34Z) and released its E-423 hold. It was probably still busy finishing its turn.
- The hub had restarted at 10:13:46Z (pid 29477).
- Likely cause: the queue is drained only on a specific verifier event, such as a hold release or a state change to idle, and that event fired before the request was queued, or isn't wired for that event.

## Acceptance criteria

- [ ] C1. A role-addressed review or QA request that is queued while every verifier is busy reaches the first verifier that becomes idle or free, within one state change, including after a hub restart.
- [ ] C2. A test reproduces the order: verdict, then hold release, then request queued while the verifier's turn is still running, then the verifier goes idle. The request is delivered.
