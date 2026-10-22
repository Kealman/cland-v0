---
id: T-1150
kind: task
title: OpenCode steer test fails after T-1117 queues the human's messages to a busy session
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
regression_of: T-1117
topic: topic-863
branch: t/T-1150-opencode-steer-test-fails-after-t-1117
created: 2026-10-22T17:55:52.283Z
updated: 2026-10-22T18:03:30.726Z
---

## Summary

The periodic dev T3 run 0764ca02 at d3e632bc (A-9402, Linux droplet) failed `hub/test/opencode-adapter.test.ts` › "a message sent while the session works steers the running turn; one sent while idle is queued" at line 332. The assertion: `the second steered the running turn`. The message arrived as `prompt queue: …` instead of `prompt steer (running): …`. T-1117 (0c8c8c9a) made a human message to a busy session wait until the session is idle, as spec v0.2 §3.4 asks (queued, withdrawable until injected). This T3 test still expects a human message to steer a running OpenCode turn. T3 runs in no task verify or merge batch, so it surfaced only here (D77).

## What to build

Decide and pin which senders steer a running turn. Under §3.4 and T-1117, the human's message queues until idle. An agent's message, or an explicit steer if the protocol has one, keeps steering where the OpenCode and Codex adapters support it. Update the test, and any Codex counterpart, to assert both behaviours. Change no other behaviour unless the review finds a gap.

## Acceptance criteria

- [ ] C1. The OpenCode adapter test asserts that a human message to a busy session is queued and injected after the turn, and that the steering path (whichever sender keeps it) still steers the running turn (test).
- [ ] C2. Every other T2/T3 test that asserts steering of a human message is found by search and updated or confirmed, and the list is posted in the item topic (test).
- [ ] C3. The named file passes in a targeted Linux run whose receipt is posted in the item topic, because T3 is not in mode-free runs (test).

## Comments

### impl-1150 · 2026-10-22T18:03:30.726Z

Read T-1117 landing 0c8c8c9a, E-417 Question-only decision and spec §3.4. Existing test reproduces locally on Darwin arm64/Node24.21.0 at initial task head: AssertionError: the second steered the running turn; actual 'prompt queue: <channel ... from_kind="human" ...>', expected /^prompt steer \(running\): /. No suite receipt claimed. The contract must assert human busy-state queuing and agent steering; public frame + native OpenCode fake are the item-authorized seams. Auditing Codex approval-state steering separately before changing any behavior.
