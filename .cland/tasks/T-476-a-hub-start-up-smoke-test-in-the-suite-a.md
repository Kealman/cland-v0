---
id: T-476
kind: task
title: "A hub start-up smoke test in the suite: a built tree starts, serves a request and stops within a bound"
state: open
status: planned
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-425
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:13:19.071Z
updated: 2026-10-15T20:50:48.324Z
---

## Summary

Retrospective A-2783, STOP 6: on 2026-10-12 a start-up change (T-283) made the hub listen without serving, and it took 18 restarts in 27 minutes to diagnose (T-293). The suite gets a smoke test that starts the hub as `cland hub start` does, from the candidate tree, and requires a served request within a bound.

## What to build

A test in hub/test starts `cland hub start` in a fresh project, waits at most 10 s for `hub status` to answer over the socket, sends one tracker request, and stops the hub. It runs in every hub phase and in integrated runs, and a hang names the last start-up log event.

## Acceptance criteria

- [ ] C1. The smoke test passes on dev and fails within its bound on a planted start-up hang, naming the last log event.
- [ ] C2. It runs in every hub phase selection, including hub-only task runs.
- [ ] C3. hub/README.md lists it under Tests.
