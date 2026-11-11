---
id: T-1789
kind: task
title: Dead-login signals mark the login signed out
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1774
  - T-1778
  - T-1784
  - T-1785
topic: null
branch: null
created: 2026-11-09T12:44:11.774Z
updated: 2026-11-11T09:03:51.374Z
---

## Summary

When a harness on a pool host reports a dead login, the hub marks that session's login `signed-out`. The signals are:
- Claude Code: `authentication_failed`, `Login expired`, `OAuth token revoked` or a 401;
- Codex: `refresh_token_reused`, `codexErrorInfo: "unauthorized"` or a 401;
- OpenCode: `provider.auth`.

Placement then skips that host for that harness, the sessions already there keep running, and the human gets one "sign in again" card.

## What to build

The adapters classify these signals and report them through a new optional adapter-host callback, `loginDead`, beside `limitHit`. They report only for sessions on hosts; the local Claude signed-out latch stays as it is for local rows. The hub maps the session to its binding and marks the login signed out; a reader's report marks the login too. The Coordinator gets an Agents line of kind `login-signed-out`. The `login-signin` card is raised through T-1775 once per sign-out, with options "Sign in again" (handled by T-1791) and "Not now", and is withdrawn when the login reads `ready`.

## Acceptance criteria

- [ ] C1. Each listed signal from each fake harness on a fake host marks the session's login `signed-out` with its host (test).
- [ ] C2. The next launch of that harness in the pool skips that host, and the sessions already on it keep running, with no stop and no exit (test).
- [ ] C3. One "sign in again" card is raised per sign-out however many sessions report it, and it folds when the login reads `ready` (test).
- [ ] C4. A dead-login signal from a local session changes no login and keeps the local signed-out latch as before (test).
- [ ] C5. The Coordinator gets one Agents line naming the login, the host and the signal (test).

## Blocked by

- T-1774
- T-1778
- T-1784
- T-1785

## Notes

- Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/adapters/contract.ts` (`loginDead`), `hub/src/adapters/sessions.ts` (the callback), `hub/src/host/login-signals.ts` (new), `hub/src/host/login-cards.ts`, `hub/src/hub/agents-topic.ts` (the kind).
- Tests: new `hub/test/login-signed-out.test.ts` (T2 with the in-process fakes for classification; T3 cases with the fake binaries on a fake host for C1 and C2).
- Serves epic C8. The signal strings come from the research (Q-1514, Q-1520); the fakes emit them, and real harness output is the live run's.
