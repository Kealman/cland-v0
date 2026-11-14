---
id: T-1831
kind: task
title: "Setup's agent-hosts step: the pool image and the first logins"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1830
topic: null
branch: null
created: 2026-11-12T10:07:21.799Z
updated: 2026-11-14T14:20:42.110Z
---

## Summary

Setup's agent-hosts step finishes the pool. It offers `cland host prepare agents`, then a first login for each harness of the roles placed on the pool, run with the harness's own sign-in in the human's terminal. Each offer that can start a paid machine names it and defaults to No.

## What to build

After T-1830 writes the pool:
- **The image.** The step offers `cland host prepare agents`; on DigitalOcean this builds the pool image on a paid build machine, which the question names. It runs the command on yes and prints the pool image's state.
- **The logins.** For each harness of the placed roles with no ready login of the pool's provider and region, it offers `cland login add <harness> --pool agents`. The question names that a host may boot for it. On yes, the sign-in runs in the human's terminal as `cland login add` runs it, and the line reports the login and its state.
- **Failures.** A failed or abandoned sign-in prints `open` with `cland login signin <name>`, and the step goes on.
- **Declines and no terminal.** A no prints `skip` with the exact command. Without a terminal, both print `open` with the exact commands and nothing runs.

No host is created without a yes. The step never prints a token.

## Acceptance criteria

- [ ] C1. After the pool is written, the step offers `cland host prepare agents`, runs it on yes, and prints `done` with the pool image's state (test).
- [ ] C2. For each harness of the roles on the pool without a ready login, the step offers `cland login add <harness> --pool agents` and runs its sign-in in the terminal, leaving a `ready` login on the fake harness (test).
- [ ] C3. Each offer that can start a paid machine names it and defaults to No, a no prints `skip` with the exact command, and no host is created without a yes (test).
- [ ] C4. A failed or abandoned sign-in prints `open` with `cland login signin <name>`, and setup goes on to the Aide (test).
- [ ] C5. Without a terminal, the image and the logins print `open` with the exact commands, and nothing runs (test).

## Blocked by

- T-1830

## Notes

- Hot files: `hub/src/setup/steps/hosts.ts`, `hub/src/setup/types.ts` (the machine's command runner), `hub/test/setup-prompter.ts`.
- Tests: `hub/test/setup-hosts.test.ts` (T2, scripted prompter and terminal, `projectHub`, the fake host provider, the fake transport and the fake harness binaries).
- Serves epic C5.
