---
id: T-1827
kind: task
title: Adding a login and signing in again from the hosts view
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1825
topic: null
branch: null
created: 2026-11-12T10:07:20.982Z
updated: 2026-11-12T10:07:26.115Z
---

## Summary

The hosts view adds a disk login for a pool and harness, and signs a signed-out login in again. Each runs the harness's own sign-in on a pool host through the hub, and the sign-in's link and code show on the login's line. A launch waiting for that login then moves on, and the web inbox's waiting line shows the new reason.

## What to build

- **Add.** An `Add` control per pool takes a harness, from the harnesses of the pool's roles and of its logins, and an optional name. It sends the web `login.add` of T-1824.
- **Sign in again.** A `Sign in again` button on each signed-out login sends the web `login.signin`.
- **The card.** While the sign-in runs, the login's line shows the hub's `login-signin-code` card, with its link and code, inline (question 3). For Claude Code the card's free answer is typed there and sent as the card's answer. The same card stays in the inbox and on the remotes, and an answer in any place folds it everywhere. The answer is never kept in page state after it is sent, nor in browser storage.

The login reads `ready` when the hub reports it. A sign-in withdrawn after its 15 minutes leaves the login signed out, with the hub's reason on its line.

## Acceptance criteria

- [ ] C1. `Add` for a pool and the codex harness starts a sign-in through the hub, and the new login's line shows the sign-in card's link and code (test).
- [ ] C2. For the fake Codex the login reads `ready` in the view and in `cland login list` when the device sign-in finishes, with nothing typed (test).
- [ ] C3. For the fake Claude Code the code typed into the line's card reaches the sign-in prompt, and the login reads `ready` (test).
- [ ] C4. `Sign in again` on a signed-out login re-runs the sign-in on its host and volume, and the login reads `ready` (test).
- [ ] C5. With a launch waiting for a codex login, adding one from the view changes the web inbox's waiting line from "waiting for a login codex" to "waiting for host <id> to boot", and the line leaves when the launch is placed (test).
- [ ] C6. After the Claude Code code is sent, it appears in no page text, browser storage or console output (test).

## Blocked by

- T-1825

## Notes

- Hot files: `web/src/sessions/HostsView.tsx`, `HostsView.module.css`; `web/src/AskCard.tsx` if the inline card reuses it.
- Tests: `web/test/hosts-view.test.ts` (Web, `projectHub` with the fake host provider, the fake transport and the fake harness binaries, isolated Headless Shell).
- Serves epic C2 and C3. The inbox line itself is T-1754's (E-1534) and its reasons are T-1785's (E-1535); this ticket adds the web path that changes them.
