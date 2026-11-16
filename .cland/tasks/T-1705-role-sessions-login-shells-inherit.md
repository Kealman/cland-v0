---
id: T-1705
kind: task
title: Role sessions' login shells inherit DIGITALOCEAN_TOKEN from the human's shell startup file despite the launch credential filter
state: open
status: in progress
size: M
labels:
  - security
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-651
found_by: qa
topic: topic-1552
branch: t/T-1705-role-sessions-login-shells-inherit
created: 2026-11-06T10:31:30.250Z
updated: 2026-11-16T13:41:35.991Z
---

## Summary

During E-1532 stage 6 QA, qa-678 found the variable name `DIGITALOCEAN_TOKEN` in a QA shell's environment, though the setup check S0 had read 0. The check was names only; no value was printed. qa-678 traced it, names only:
- The Codex session process itself does not have the variable.
- A login-launched child of it does: the harness's default command exec runs a login shell, and the human's `~/.zshrc` (line 48) sets that name.
- A non-login exec does not have it.
So cland's launch credential filter (T-651/T-646, rule 15) covers the session process, but every login shell the harness runs re-adds the provider token from the human's shell startup files. Any role session can read it.

Containment for the QA run: qa-678 scanned 1,236 scratch files (with a positive control and the value fed through stdin) and found zero matches. The row was marked BLOCKED, and the scratch processes are being drained.

## What to build

1. Confirm which harness launches run their tool shells as login shells (Codex, Claude Code, OpenCode), and which startup files they source.
2. Choose and implement a product fix that keeps provider credentials out of role sessions' tool shells. Options:
   - launching tool shells non-login;
   - a scratch `ZDOTDIR` or shell rc for sessions;
   - a documented setup check that warns when the human's shell startup exports a provider credential;
   - the hub reading the token from its own secret store instead of the environment.
   The human must agree to any change to their shell setup.
3. Add a regression test showing that a role session's tool shell has no provider credential names when the launching user's shell startup file exports one (a scratch HOME with a planted rc).

## Acceptance criteria

- [ ] C1. A test shows that a role session's tool shell started the way the harness starts it has zero provider credential names, even with a planted rc that exports one (test, red before the fix).
- [ ] C2. The chosen approach and any setup step for the human are documented (docs).

## Comments

### coord · 2026-11-16T07:30:03.291Z

The human decided on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813): fix it on the product side in 0.4.1 (E-1884).
- The hub reads the provider token from its own secret store instead of the environment.
- `cland doctor` warns when a shell startup file exports a provider credential.
- No session changes the human's `~/.zshrc`. The Coordinator asks the human separately to move the export into the hub's launch environment.
