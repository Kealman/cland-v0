---
id: T-340
kind: task
title: Sweep the Neovim tests for actions before their snapshots land (four flakes of one class on 2026-10-13)
state: open
status: in progress
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: null
branch: t/T-340-sweep-the-neovim-tests-for-actions
created: 2026-10-13T19:12:35.068Z
updated: 2026-10-13T19:12:45.874Z
---

## Summary

Four Neovim test flakes on 2026-10-13 had one cause: a test pressed keys before the snapshot or state those keys need had landed. They were fixed one per failed full run, with shared commits b5b67ad (plan view, T-292), 7210621 (palette, T-301) and 7d9bb4d (shell reconnect), plus a fourth in T-331's run ("r gives a free ask answer…"). Each cost a full run of about 14 minutes. Sweep the Neovim tests once for the class.

## What to build

- Find every test in `nvim/test/` that sends keys or commands right after connect or reconnect, or right after a frame that triggers a snapshot, without waiting for the state the keys act on. Waiting only for the connection does not count.
- Give each one a readiness wait on the state it reads: the task and tracker snapshots, the rendered heading, or the plan owner, using the existing helpers. Keep every assertion, and add no sleep, retry or longer timeout.
- A test helper for "after connect, the initial snapshots have landed" is fine, kept out of hub/test/harness.ts.
- Prove the class with a delayed hub.status and task.list replay over the whole Neovim suite: it passes after the sweep.

## Acceptance criteria

- [ ] C1. Every Neovim test that acts after connect or reconnect waits for its readiness state, listed in the item.
- [ ] C2. The Neovim suite passes under a delayed initial-snapshot replay, and passes normally.
- [ ] C3. No assertion is weakened, no timeout raised, and no retry added. `cland verify` is green.
