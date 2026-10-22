---
id: T-1150
kind: task
title: OpenCode steer test fails after T-1117 queues the human's messages to a busy session
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
regression_of: T-1117
topic: topic-863
branch: t/T-1150-opencode-steer-test-fails-after-t-1117
created: 2026-10-22T17:55:52.283Z
updated: 2026-10-22T18:21:40.236Z
---

## Summary

The periodic dev T3 run 0764ca02 at d3e632bc (A-9402, Linux droplet) failed `hub/test/opencode-adapter.test.ts` › "a message sent while the session works steers the running turn; one sent while idle is queued" at line 332. The assertion: `the second steered the running turn`. The message arrived as `prompt queue: …` instead of `prompt steer (running): …`. T-1117 (0c8c8c9a) made a human message to a busy session wait until the session is idle, as spec v0.2 §3.4 asks (queued, withdrawable until injected). This T3 test still expects a human message to steer a running OpenCode turn. T3 runs in no task verify or merge batch, so it surfaced only here (D77).

## What to build

Decide and pin which senders steer a running turn. Under §3.4 and T-1117, the human's message queues until idle. An agent's message, or an explicit steer if the protocol has one, keeps steering where the OpenCode and Codex adapters support it. Update the test, and any Codex counterpart, to assert both behaviours. Change no other behaviour unless the review finds a gap.

## Acceptance criteria

- [x] C1. The OpenCode adapter test asserts that a human message to a busy session is queued and injected after the turn, and that the steering path (whichever sender keeps it) still steers the running turn (test).
  - done: impl-1150 · 2026-10-22T18:07:20.032Z
- [x] C2. Every other T2/T3 test that asserts steering of a human message is found by search and updated or confirmed, and the list is posted in the item topic (test).
  - done: impl-1150 · 2026-10-22T18:07:20.093Z
  - verified: rev-23 [reviewer] · run rev-20261022-1150-source · 2026-10-22T18:11:10.133Z · commit bf62729ce865995e28daac2f9a17d9dd9e455a75
- [ ] C3. The named file passes in a targeted Linux run whose receipt is posted in the item topic, because T3 is not in mode-free runs (test).

## Comments

### impl-1150 · 2026-10-22T18:03:30.726Z

Read T-1117 landing 0c8c8c9a, E-417 Question-only decision and spec §3.4. Existing test reproduces locally on Darwin arm64/Node24.21.0 at initial task head: AssertionError: the second steered the running turn; actual 'prompt queue: <channel ... from_kind="human" ...>', expected /^prompt steer \(running\): /. No suite receipt claimed. The contract must assert human busy-state queuing and agent steering; public frame + native OpenCode fake are the item-authorized seams. Auditing Codex approval-state steering separately before changing any behavior.

### rev-23 · 2026-10-22T18:11:10.133Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1150-source
commit: bf62729ce865995e28daac2f9a17d9dd9e455a75
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-9414. Standards0/Spec0. Human busy queue and agent native steer are tested through held execution/admission boundaries in OpenCode and scripted Codex; final native order/count/replies/state assertions retained. Approval-state human steer remains deliberately covered. A-9408 search audit confirmed, C2 verified. A-9412 local targeted runs are precommit implementation-tree evidence only; C1/C3 await exact-head Linux T3 evidence. Coordinator667635c7 supplies verify all/droplet as same-head verification and explicitly skips redundant mode-free run. No production behavior change or QA claim.

Criteria: C2 verified.

### coord · 2026-10-22T18:21:40.236Z

The hub's periodic-T3 search confirmed the culprit merge 0c8c8c9a (T-1117): green at 58aa8efd and red at 0c8c8c9a and 31bd45bc (A-9416, A-9417, A-9418). Its auto-filed duplicate T-1153 is closed.
