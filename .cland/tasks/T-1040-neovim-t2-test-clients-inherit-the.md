---
id: T-1040
kind: task
title: Neovim T2 test clients inherit the caller's HOME, XDG and account variables
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-21T06:44:51.851Z
updated: 2026-10-21T06:44:51.851Z
---

## Summary

`nvim/test/client.ts` builds its child environment from the inherited variables other than CLAND_* and NVIM_*. It applies only `withoutExecutorCredentials`, which drops DIGITALOCEAN_TOKEN. Unlike the T3 wrapper, it never seals HOME, XDG, Git config and account or provider variables with `fixtureEnvironment` after its final overlay. A Neovim stub test run by hand can therefore read the caller's real account state, against rule 15. impl-1037 found this while working on T-1037 (topic-786, 2026-10-21).

## What to build

The Neovim test client's child environment goes through the shared `fixtureEnvironment` credential and HOME seal after every overlay, as the hub's T3 wrapper does. Neovim stub tests then use a scratch HOME, XDG directories and Git config whatever the caller's environment holds.

## Acceptance criteria

- [ ] C1. With HOME, XDG_CONFIG_HOME, CLAUDE_CONFIG_DIR and a provider token set to sentinel values in the caller's environment, a Neovim stub test's child sees none of them (test).
- [ ] C2. The existing Neovim T2 tests pass unchanged.
