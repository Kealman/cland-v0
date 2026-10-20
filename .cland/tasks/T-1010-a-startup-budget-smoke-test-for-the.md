---
id: T-1010
kind: task
title: A startup budget smoke test for the Neovim workbench on a 1,000-item tracker
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by:
  - T-1007
  - T-1008
topic: topic-762
branch: t/T-1010-a-startup-budget-smoke-test-for-the
created: 2026-10-20T17:01:25.275Z
updated: 2026-10-20T18:33:08.679Z
---

## Summary

A Neovim smoke test guards the workbench's startup against a 1,000-item tracker, with a time budget and a byte budget. This keeps the P1 slow start from coming back.

## What to build

- A fixture tracker of 1,000 items, generated rather than committed, with realistic bodies and about 80 % of the items closed.
- A smoke test in the Neovim smoke set starts the workbench against a scratch hub holding that tracker. It measures:
  - the time from the hub connection until the explorer shows the open items, the header shows the Coordinator, and the sessions panel shows the sessions;
  - the bytes of the first item payload.
- It fails above either budget. Set the budgets from measured values with headroom, and record them in `docs/agents/tests.md`.
- A live measurement on the human's Mac against a copy of the live tracker becomes the epic's C1 evidence.

## Acceptance criteria

- [ ] C1. The smoke test starts the workbench against a 1,000-item fixture tracker and fails when startup exceeds its time budget (test, plus a fixture that slows `task.list` to prove the failure).
- [ ] C2. The test fails when the first item payload exceeds its byte budget (test with a fixture that adds bodies to the payload).
- [ ] C3. The test is in the Neovim smoke set that `web-only` and `hub-only` selections also run, and its tier is recorded in `hub/test/tiers.json`.
- [ ] C4. A local run against a copy of the live tracker on macOS records the startup time and payload, posted in the item topic (local evidence).
- [ ] C5. `docs/agents/tests.md` records the budgets and how they were measured.
