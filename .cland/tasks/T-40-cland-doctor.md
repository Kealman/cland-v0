---
id: T-40
kind: task
title: cland doctor
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-39
topic: null
branch: null
created: 2026-10-08T11:55:41Z
updated: 2026-10-08T13:17:15.607Z
github:
  repo: Kealman/cland-v0
  number: 40
  url: https://github.com/Kealman/cland-v0/issues/40
---

## Parent

Part of #19. Spec section 4.9; decision https://github.com/Kealman/cland-v0/issues/17.

## What to build

`cland doctor` checks the toolchain and the project and prints one line per check with a verdict: Claude Code, Codex and OpenCode installed, versions within the ranges the adapters were built against, and authenticated; `gh` installed and authenticated; Neovim's standalone build present and of the pinned version; the hub running or startable, its discovery file valid, the secret present; `roles.toml` and `config.toml` parse; the skills symlink intact; the Claude Code hooks and mod installed. Each failing check names the fix.

## Acceptance criteria

- [ ] On a healthy machine every check passes; removing the hub's discovery file or breaking the skills symlink produces a named failure with the fix
- [ ] A harness version outside the tested range is reported as a warning, not a failure
- [ ] The output is plain text suitable for pasting into an item comment
- [ ] Tests fake each failure condition and assert the report
