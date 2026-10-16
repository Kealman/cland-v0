---
id: T-650
kind: task
title: 'cland outside a project prints "not a cland project: run cland init" and starts no hub'
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-609
topic: null
branch: null
created: 2026-10-16T16:24:00.374Z
updated: 2026-10-16T16:24:12.586Z
---

## Summary

Today `cland` (and `cland open`) in any folder starts a hub there, which creates `.cland/` in a folder that was never a project. Both now look for the project first: when the folder belongs to no project with `.cland/`, they print "not a cland project: run cland init", exit 1, and start no hub and write nothing (spec v0.1.4 §3.2, "What comes next"; Q-599 resolution 6).

## What to build

- In `hub/src/cli/open.ts` (`runOpen`, which `cland` with no command on a terminal runs, `hub/bin/cland.ts`): resolve the project root as today, with T-609's rule that HOME is never one; when that root has no `.cland/`, write `not a cland project: run cland init` to stderr and return 1 before `runHub(['start'])`.
- Opening from a subfolder or a task worktree of a project keeps working as today.
- `cland open <dir>` applies the same check to `<dir>`.
- Other commands are unchanged (`cland hub start` in a folder without `.cland/` stays as it is; an open question in the README).
- `hub/test/open.test.ts`'s existing test runs on a folder with only `.git`; it now runs `cland init` first.
- The hub README's open section names the line.

## Acceptance criteria

- [ ] C1. `cland open` in a plain scratch folder exits 1 with `not a cland project: run cland init` on stderr, and no launcher runs (open.test.ts with the stand-in launcher).
- [ ] C2. After that run the folder holds no `.cland/`, no hub process exists for it, and ticket T-639's `snapshot` of the scratch HOME is unchanged.
- [ ] C3. A folder inside a Git repository that has no `.cland/` gets the same line.
- [ ] C4. A folder under a scratch HOME that still holds a legacy `~/.cland/` gets the line, and HOME is not opened as a project.
- [ ] C5. `cland open` from a subfolder of an initialised project starts the hub and the launcher on the project root as before.
