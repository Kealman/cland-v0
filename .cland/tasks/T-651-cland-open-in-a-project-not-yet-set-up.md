---
id: T-651
kind: task
title: 'cland open in a project not yet set up prints "next: cland setup" and opens the workbench as usual'
state: open
status: planned
size: XS
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-650
topic: null
branch: null
created: 2026-10-16T16:24:00.577Z
updated: 2026-10-18T20:04:46.084Z
---

## Summary

A project initialised but not set up opens as usual, with one line before the workbench: `next: cland setup` (Q-599 resolution 6). What marks a project as set up is one exported predicate, which E-613's `cland setup` writes against.

## What to build

- **The predicate** `projectSetUp(root)`, exported from one module of the hub, true when `.cland/roles.toml`'s `[aide.launch] harness` line carries setup's mark of the human's choice (the setup prototype's `CHOSEN` comment, `# the human's favourite, chosen in cland setup`; the mark itself is an open question in the README). The mark is one exported constant, which E-613 writes.
- **The line.** In `hub/src/cli/open.ts`, after ticket T-650's check and before the hub starts: when `projectSetUp` is false, `next: cland setup` on stderr; then the hub and the workbench start as today, and the exit code is the launcher's.
- A malformed `roles.toml` counts as not set up and does not stop the open (the hub reports the file as it does today).
- The hub README's open section names the line and the mark.

## Acceptance criteria

- [ ] C1. `cland open` in a project fresh from `cland init` prints exactly one line, `next: cland setup`, then runs the stand-in launcher on the root with its exit code returned (open.test.ts).
- [ ] C2. With the mark on `[aide.launch] harness`, `cland open` prints no such line.
- [ ] C3. `projectSetUp` returns false for a missing, an unmarked and a malformed `roles.toml`, and true for a marked one (unit test).
