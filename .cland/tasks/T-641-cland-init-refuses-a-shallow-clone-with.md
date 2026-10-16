---
id: T-641
kind: task
title: cland init refuses a shallow clone with "the territory needs the full history" and the command that fetches it
state: open
status: planned
size: XS
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-609
topic: null
branch: null
created: 2026-10-16T16:23:57.093Z
updated: 2026-10-16T16:24:32.436Z
---

## Summary

Today a shallow clone fails deep inside the territory step with Git's "shallow update not allowed", after init has already written files. Init now checks first and refuses a shallow clone before writing anything, with the line "the territory needs the full history" and the command that fetches it (spec v0.1.4 §3.2; Q-600 resolution 6).

## What to build

- In `hub/src/cli/init.ts`, beside T-609's root checks and before `provision`: `git rev-parse --is-shallow-repository` in the target; `true` refuses with exit 1 and the line `cland init: the territory needs the full history: run git fetch --unshallow, then cland init again`.
- `cland update` on a shallow project with a territory refuses the same way; one without a territory is left to update as today.
- The hub README's init section names the refusal.

## Acceptance criteria

- [ ] C1. `cland init` in a shallow clone exits 1 with a line holding "the territory needs the full history" and `git fetch --unshallow` (init-roots.test.ts, on ticket T-639's shallow clone).
- [ ] C2. After the refusal the clone is byte-identical to before (ticket T-639's `snapshot`): no `.cland/`, no remote renamed, no file written.
- [ ] C3. After `git fetch --unshallow` in the same clone, `cland init` succeeds and the territory holds `dev`.
