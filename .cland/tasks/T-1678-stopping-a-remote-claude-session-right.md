---
id: T-1678
kind: task
title: Stopping a remote Claude session right after a turn still refuses with 'process identity cannot be verified'
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1674
topic: null
branch: t/T-1678-stopping-a-remote-claude-session-right
created: 2026-11-04T15:25:21.631Z
updated: 2026-11-04T15:25:46.256Z
---

## Summary

After T-1674, two stage-5 implementers still see an explicit stop of a remote Claude session refused with `could not stop "<name>": its process identity cannot be verified; it is still watched` when the stop follows a completed turn closely:
- impl-1612 (T-1612 survival scenario, under the exclusive lock): stop immediately after the pong receipt.
- impl-1666 (T-1666 pre-revoke settlement, under the lock): the stop of a released generation, intermittently.

A real user stopping a session just after a turn would hit the same refusal and need a manual re-stop. That is the product problem T-1607's stop design meant to avoid.

## What to build

Capture the actual process records (PID, birth, parent, command) at both captures in a failing stop right after a turn, and classify the second change: settled pinned exit, same-set republish, legitimately new hook writer, or unknown identity. Fix the product so that a stop right after a turn completes without a manual re-stop. The one-recapture bound for genuinely new unpinned descendants and the second-churn means incomplete rule stay unchanged unless coord decides otherwise.

## Acceptance criteria

- [ ] C1. The failing captures are recorded and the extra process classified (evidence).
- [ ] C2. An explicit stop issued immediately after a completed remote Claude turn completes without a manual re-stop, 20/20 under load in an isolated Linux container (evidence).
- [ ] C3. The existing claude-stop, claude-capture-concurrency and claude-code-remote controls pass unedited (test).
