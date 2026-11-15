---
id: T-1866
kind: task
title: Setup's sign-in step reads open when the hub is down, even in single mode
state: open
status: backlog
size: S
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-15T08:06:05.452Z
updated: 2026-11-15T08:06:05.452Z
---

## Summary

When the hub can't be reached, setup's sign-in mode step (`hub/src/setup/steps/signin.ts`, T-1835) reads `open` with "choose the web sign-in mode", unless `--yes` or `--no-aide` is given. That happens even when the project config says single mode. The step asks only the hub for the mode and never reads config. T-1835's amended C4 and the users docs page (T-1838) both say a single-mode project without a terminal reads `skip` with `cland auth mode users` as its fix. Setup's exit status is unaffected today, because the hub row is already `open` when no hub answers. But the extra `open` row contradicts the docs, and so does the "choose" wording for a project that already has a mode. Found by the E-1537 stage-5 QA brief draft at ef9f52fc9.

## What to build

When the hub can't be reached, the step reads `auth.mode` from the project config, as doctor's mode line does (T-1836):
- **single:** `skip`, detail "single mode", fix `cland auth mode users`, the same row as the reachable-hub case;
- **users:** `open` with `cland hub start`, since the user counts need the hub;
- **config unreadable:** the step keeps today's `open`.

Nothing is written.

## Acceptance criteria

- [ ] C1. With no hub running and config in single mode, the sign-in step reads `skip` with fix `cland auth mode users`, both with and without a terminal, and writes nothing (test).
- [ ] C2. With no hub running and config in users mode, it reads `open` with `cland hub start`. With a reachable hub, every existing T-1835 row is unchanged (test).
