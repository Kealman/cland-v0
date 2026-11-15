---
id: T-1835
kind: task
title: Setup's sign-in mode step
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1831
topic: null
branch: null
created: 2026-11-12T10:07:22.624Z
updated: 2026-11-15T04:20:08.260Z
---

## Summary

`cland setup` gains an optional sign-in mode step after the hub step and before the remote step. It offers single or users, and single is the default, which `--yes` keeps. On users, it switches the hub, prints the first user's one-time invite link, and waits for the first user's passkey (question 4).

## What to build

GLOSSARY's Setup order (the hub, the sign-in mode, a remote, agent hosts, the Aide) and spec §3.8 and §3.9. The step:
- **Detects** the mode and, in users mode, the users. A project already in users mode prints `ok` with the number of users and asks nothing.
- **Offers** "Let several people sign in to the web (users mode)?", default No. `--yes` takes that default, with or without a terminal: single mode stays and the step prints `skip`.
- **Switches** on yes, after a confirmation. The confirmation says that switching signs out the current browser sessions and that `cland auth reset` is the only way back. The switch goes through the hub, as `cland auth mode users` does, and creates the first user from git's `user.name`.
- **Invites.** It prints the first user's name and the one-time invite link, and waits for the passkey registration on the invite page. Enter skips the wait. A registered passkey ends the step `done`; a skip ends it `open` with `cland user invite <name>`.
- **Without a terminal** it changes nothing and prints `open` with `cland auth mode users`.

The link appears in no hub log line or journal record.

## Acceptance criteria

- [ ] C1. With a scripted prompter, the sign-in mode step runs after the hub step and before the remote step, its offer defaults to No, and `--yes`, with or without a terminal, leaves single mode with the step `skip` (test).
- [ ] C2. Choosing users switches the hub to users mode after a confirmation naming the browser sign-out and `cland auth reset`, and the step prints the first user's name and one-time invite link (test).
- [ ] C3. A passkey registered on the invite page in an isolated headless browser with a virtual authenticator ends the step `done`, with the first user active in `cland user list` (test).
- [ ] C4. Skipping the wait ends the step `open` with `cland user invite <name>`, and without a terminal the step changes nothing and prints `open` with `cland auth mode users` (test).
- [ ] C5. A project already in users mode prints `ok` with its number of users and asks nothing, and the invite link appears in no hub log line or journal record (test).

## Blocked by

- E-1536 (closed)
- T-1831 (the setup runner and step types)

## Notes

- Hot files: `hub/src/setup/steps/signin.ts` (new), `hub/src/setup/runner.ts` (the step order), `hub/src/setup/types.ts`, `hub/src/setup/hub.ts`, `hub/test/setup-prompter.ts`.
- Tests: new `hub/test/setup-signin.test.ts` (T2, scripted prompter, `projectHub` with the web edge); the passkey case in `web/test/setup-signin.test.ts` (Web, isolated Headless Shell with a CDP virtual authenticator, as the passkey tests do); `hub/test/setup-flow.test.ts` order updated.
- Serves epic C5.
