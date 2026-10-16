---
id: T-638
kind: task
title: The launcher's model field offers the models the harness lists
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - nvim
assignee: null
parent: E-611
blocked_by:
  - T-635
topic: null
branch: null
created: 2026-10-16T16:04:13.257Z
updated: 2026-10-16T16:04:14.805Z
---

## Summary

The workbench launcher's model field offers the model ids `cland models` lists for the harness in the harness field, from the hub's cache, so the human picks a model instead of typing an id that may not exist. Free text stays allowed.

## What to build

- When the model field gets focus, the launcher asks the hub for the models of the harness the harness field names (and of the account field's account, when set) and offers them as the field's completion, the default first.
- Changing the harness or the account field changes the offered list on the next focus.
- The list is asked for only when the field is focused, never when the launcher opens, and never blocks typing; a failed or empty answer leaves the field as free text with a one-line hint naming the reason.
- The role-defaults behaviour of the launcher (a role fills the harness, model and effort; another harness clears the model meant for the role's) stays as it is.

## Acceptance criteria

- [ ] C1. With the harness field on opencode, the model field's completion offers the ids the fake OpenCode lists, default first (headless Neovim test against the protocol).
- [ ] C2. Changing the harness field to codex offers the fake Codex's ids on the next focus, and a failed answer leaves free text with its hint.
- [ ] C3. Opening the launcher sends no models request until the model field is focused (the test counts the frames).
- [ ] C4. The existing launcher tests for the role defaults stay green.
