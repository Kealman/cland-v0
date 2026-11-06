---
id: T-1721
kind: task
title: host-agent-restart "version delivery reconnect" runs at 15–17 s against a 20 s test timeout and times out under load
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1612
found_by: cover
topic: null
branch: null
created: 2026-11-06T11:09:04.236Z
updated: 2026-11-06T11:09:04.236Z
---

## Summary

`hub/test/host-agent-restart.test.ts` "C1-C3 version delivery reconnect reads retained table without signalling harness" took 15.4 s in the Linux stage cover A-17045 and 17.1 s in the macOS cover A-17051, both green, against a 20 s test timeout. In impl-1707's preservation batch on 2026-11-06 at 11:08Z, with a host load of about 10, it ran 21.2 s and was cancelled with `test timed out after 20000ms`. The margin is too thin for loaded runs.

## What to build

Find which part of the case is setup (agent restart, delivery, reconnect) and which is the behaviour the test asserts. Setup waits use `testWaitMs()`/`eventually()`, the test timeout sits above its allowance, and the case gets a duration allowance sized from the worst sample. Behaviour bounds stay exact and named; never weaken an assertion. If profiling shows a product slowdown since T-1612, name it instead.

## Acceptance criteria

- [ ] C1. The case passes 10/10 on macOS at a one-minute load of 12 or more, with its assertions unchanged (evidence).
- [ ] C2. The case's test timeout exceeds its duration allowance, and the allowance is sized at about 1.5 times the worst sample, with the samples in the reason (test-lint or durations check).
