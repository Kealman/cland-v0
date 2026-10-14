---
id: T-441
kind: task
title: session-holds verifier-request test misses its channel event (observer-spoke race, 1 in 5 alone)
state: open
status: in progress
size: S
rank: 2282
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
regression_of: T-398
topic: topic-265
branch: t/T-441-session-holds-verifier-request-test
created: 2026-10-14T21:26:59.664Z
updated: 2026-10-14T21:27:35.928Z
---

## Summary

`hub/test/session-holds.test.ts:160` ("delivered verifier requests persist across restart and clear on hold, verdict, stop and death") fails intermittently on macOS. It failed in integrated cover 9484455a at 039421e7 (A-2562), and in 1 of 5 runs of the file alone at about e6c0af0a; T-385 merged during that series. The error is "no channel event matched within 5000ms", while the review request to the pending reviewer had already been seen. This is the observer-spoke channel-timing class that T-369 and T-398 fixed elsewhere: the test waits for a channel event that may arrive before or after its observer subscribes. T-398's sweep did not cover this file. The integrated dev cover fails on it, so this is a shared fix.

## What to fix

Apply T-398's pattern to this test: wait for the observer spoke's connection or subscription before acting, or match against the full received history rather than only new events. Widen no time bound.

## Acceptance criteria

- [ ] C1. The cause is named, with a deterministic reproduction that is red before the fix and green after.
- [ ] C2. The file passes 10/10 whole-file runs serially, including at least five beside a local full run.
- [ ] C3. Any other test in hub/test that waits on a channel event without T-398's readiness is listed, and is fixed in the same commit or filed.
