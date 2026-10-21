---
id: T-1046
kind: task
title: A process event escapes a held transport after the numbered-delta emit point
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
regression_of: T-985
topic: topic-798
branch: t/T-1046-a-process-event-escapes-a-held-transport
created: 2026-10-21T11:33:00.471Z
updated: 2026-10-21T11:36:18.846Z
---

## Summary

The periodic dev T3 run c2965396 at b970270a (A-8338) failed `hub/test/session-events.test.ts` "rename before the spoke welcome waits; after welcome its process event survives a held transport" with "the process frame escaped the transport hold" (line 53). The last green was 479178b2. The merges in between that touch event emission are T-985, numbered deltas from one emit point (aeae1f25), which moved emission to queued fan-out, and later T-986 (40d0583f, not in the red head). The regression is attributed to T-985 pending confirmation.

## What to build

A transport hold keeps holding every frame emitted while held, process events included, under the single emit point and its queued fan-out. Confirm the culprit with the failing test at aeae1f25 and at its parent, then fix the emit path rather than the test. Check the result at current dev, which includes T-986's ring and replay.

## Acceptance criteria

- [ ] C1. `hub/test/session-events.test.ts` passes with its assertion unchanged in a targeted T3 run at the task head (local evidence); the next periodic dev T3 confirms it after landing.
- [ ] C2. The T-985 and T-986 frame-order tests (connection-resume, connection-resync, model-output and model-ring) still pass.
- [ ] C3. The cause is named in the item topic: the commit and the code path the frame took around the hold.

## Comments

### impl-1046 · 2026-10-21T11:34:28.163Z

Historical red/green on local darwin Node v24.21.0, disposable independent clones and sealed shared fixture environment: node --test --test-name-pattern='rename before the spoke welcome' hub/test/session-events.test.ts passes at 102d592dadffabda064f3af376ed7cd9739acb36 (T-985 parent), fails at aeae1f25cca0c0e9d99d0575b339e06856d0ef58 with AssertionError [ERR_ASSERTION]: the process frame escaped the transport hold (session-events.test.ts:53:99). These targeted T3 runs are not suite/gate receipts.
