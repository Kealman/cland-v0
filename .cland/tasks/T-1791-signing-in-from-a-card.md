---
id: T-1791
kind: task
title: Signing in from a card
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1775
  - T-1785
  - T-1790
topic: null
branch: null
created: 2026-11-09T12:44:12.172Z
updated: 2026-11-09T12:52:29.796Z
---

## Summary

The web, Neovim and the remotes sign a login in through cards the hub raises. Answering "Create one" or "Sign in again" makes the hub run the harness's own sign-in on a pool host and raise a card with its link and code. For Claude Code, which prints a link and takes a pasted code, the card's free answer carries the code back to the sign-in prompt; Codex's device code needs nothing back. On success the hub snapshots the disk and marks the login `ready`, and every card folds.

## What to build

A sign-in run by the hub on the host, behind the sign-in runner seam T-1777 introduced:
- **Running it.** The run uses either an agent spawn with an input pipe and captured output, or the hub's own `ssh -tt`; the implementer chooses, and the review checks it.
- **The card.** Per-harness patterns read the link and code from the output, and the `login-signin-code` card carries them. For Claude Code its free answer is marked secret.
- **The answers.** T-1785's "Create one" creates the login as `login add` does and signs it in. T-1789's "Sign in again" signs in in place, as `login signin` does.
- **Limits.** A sign-in has 15 minutes on the hub clock, after which its card is withdrawn and the login is `signed-out`. No step runs a logout.

## Acceptance criteria

- [ ] C1. Answering "Create one" on the test messenger creates a login of that harness and pool and raises a card with the fake sign-in's link and code (test).
- [ ] C2. For the fake Claude Code, the card's free answer reaches the sign-in prompt's input, and the login reads `ready` with one snapshot (test).
- [ ] C3. For the fake Codex, the login reads `ready` when the device sign-in finishes, with no answer on the card (test).
- [ ] C4. Answering "Sign in again" re-runs the sign-in on the login's host and volume, and the sign-in card folds on both remotes (test).
- [ ] C5. The pasted code appears in no log line, journal record, history row or remote outcome line (test).
- [ ] C6. A sign-in not finished within 15 minutes of hub-clock time withdraws its card and leaves the login `signed-out` with its volume kept (test).
- [ ] C7. On a messenger whose adapter can delete messages (the test messenger declares it), the human's message carrying the pasted Claude Code code is deleted after the hub reads it; where it cannot be deleted, the hub sends one line saying so (test).

## Blocked by

- T-1775
- T-1785
- T-1790

## Notes

- Hot files: `hub/src/host/login-signin.ts` (the runner seam), `hub/src/host/login-card-signin.ts` (new), `hub/src/host/login-cards.ts`, and `hub/src/host/agent/server.ts` if the agent route is chosen.
- Tests: new `hub/test/login-card-signin.test.ts` (T3: a fake host's agent, the fake binaries, the test messenger).
- Serves epic C7. Sized M at the upper edge: if the runner seam needs its own agent operation, split it out as an S ticket before this one. See question 13 on the pasted code.
