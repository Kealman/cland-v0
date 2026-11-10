---
id: T-1785
kind: task
title: Waiting for a login, and the "create one?" card
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1775
  - T-1784
topic: null
branch: null
created: 2026-11-09T12:44:10.911Z
updated: 2026-11-10T20:59:37.245Z
---

## Summary

A launch blocked on logins waits as "waiting for a login <harness>", wherever waiting launches show, and its reason stays current. Once a login frees and a host starts, the reason reads "waiting for host <id> to boot", and the wait ends when the launch is placed. The human gets one "Not enough <harness> logins. Create one?" card per wait, raised by the hub. A `cland login add` that makes a login `ready` re-runs placement at once, and the card folds.

## What to build

T-1784's decision wired into the waiting launches, plus capacity events when a login becomes ready, is released or signs out. A login card module raises the `login-create` card through T-1775:
- **Raised** once per pool and harness while any launch waits for that login (question 8), and withdrawn when none does.
- **Options:** "Create one" and "Not now". "Not now" folds the card. "Create one" is handled by T-1791; until then it answers with the `cland login add <harness> --pool <pool>` line.

The Agents notices reuse `session-waiting`. Waits are already durable across a restart, and the card is durable through T-1775.

## Acceptance criteria

- [ ] C1. A launch blocked on logins reads "waiting for a login <harness>" in `cland session list` and the inbox frame, and Agents gets one notice for it (test).
- [ ] C2. A `cland login add` of that harness releases the wait: a host starts, the reason reads "waiting for host <id> to boot", and the launch is placed when the host is ready (test).
- [ ] C3. Exactly one "Not enough <harness> logins. Create one?" card is raised per pool and harness, whatever the number of scheduler passes or waiting launches (test).
- [ ] C4. The card folds when the last launch waiting for that login is placed or cancelled (test).
- [ ] C5. Answering "Not now" folds the card and leaves the launch waiting (test).

## Blocked by

- T-1775
- T-1784

## Notes

- Hot files: `hub/src/adapters/sessions.ts` (the reason), `hub/src/adapters/waiting-launches.ts`, `hub/src/host/login-cards.ts` (new), `hub/src/host/pool-runtime.ts` (capacity events; same lane as T-1784).
- Tests: new `hub/test/login-wait.test.ts` (T2, the test messenger).
- Serves epic C6.
