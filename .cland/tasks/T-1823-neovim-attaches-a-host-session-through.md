---
id: T-1823
kind: task
title: Neovim attaches a host session through the `ssh -t` attach
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: null
branch: null
created: 2026-11-12T10:07:20.159Z
updated: 2026-11-12T10:07:42.337Z
---

## Summary

Attaching to a host session from Neovim opens a terminal that runs the hub's `ssh -t` attach for that host, as a local session runs its harness's attach. The hub already returns that command for host sessions (spec §3.2); this ticket proves the Neovim path on the fake transport and names the host in the attach note.

## What to build

Neovim keeps asking the hub for the attach command and running what it returns. The attach note names the session and its host while the command starts. A refusal from the hub, for instance a revoked host, shows the hub's reason in the note. After `:restart`, the attached host sessions attach again through the same command. No key binding is added.

## Acceptance criteria

- [ ] C1. `↵` on a fake-host session in headless Neovim opens a terminal whose job runs the hub's SSH attach command with `-t` and reaches the fake host's attach (test).
- [ ] C2. The attach note names the session and its host, and an attach the hub refuses for a revoked host shows the hub's reason in the note (test).
- [ ] C3. After `:restart`, a host session that was attached is attached again through the same SSH command (test).

## Blocked by

None (can start immediately)

## Notes

- Hot files: `nvim/lua/cland/sessions.lua`.
- Tests: new `nvim/test/host-attach.test.ts` (headless Neovim, `projectHub`, `fake-ssh`).
- Serves epic C3 (the Contents' attach line).
