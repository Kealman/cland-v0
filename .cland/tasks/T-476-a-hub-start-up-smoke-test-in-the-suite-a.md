---
id: T-476
kind: task
title: "A hub start-up smoke test in the suite: a built tree starts, serves a request and stops within a bound"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-425
blocked_by: []
topic: topic-364
branch: t/T-476-a-hub-start-up-smoke-test-in-the-suite-a
created: 2026-10-15T09:13:19.071Z
updated: 2026-10-16T07:24:40.923Z
---

## Summary

Retrospective A-2783, STOP 6: on 2026-10-12 a start-up change (T-283) made the hub listen without serving, and it took 18 restarts in 27 minutes to diagnose (T-293). The suite gets a smoke test that starts the hub as `cland hub start` does, from the candidate tree, and requires a served request within a bound.

## What to build

A test in hub/test starts `cland hub start` in a fresh project, waits at most 10 s for `hub status` to answer over the socket, sends one tracker request, and stops the hub. It runs in every hub phase and in integrated runs, and a hang names the last start-up log event.

## Acceptance criteria

- [x] C1. The smoke test passes on dev and fails within its bound on a planted start-up hang, naming the last log event.
  - done: impl-476 · 2026-10-16T07:24:33.056Z
- [x] C2. It runs in every hub phase selection, including hub-only task runs.
  - done: impl-476 · 2026-10-16T07:24:33.344Z
- [x] C3. hub/README.md lists it under Tests.
  - done: impl-476 · 2026-10-16T07:24:33.711Z

## Comments

### impl-476 · 2026-10-16T07:17:24.269Z

Planted listening-but-silent startup regression written first. Observed red at 10.376 s (missing last-event diagnostic), then green 2/2: hang proof 10.372 s, healthy CLI/status/tracker/stop 0.561 s. One 10 s budget spans start and served status; machine classification and reasoned hang-duration allowance added. Integrating smoke selection assertions; origin/dev refresh including T-488 is required before first source review.
