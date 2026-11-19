---
id: T-2014
kind: task
title: projectGitDirectory reads .git/commondir with an unbounded readFile; enforce the metadata byte bound while reading
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-19T20:18:03.512Z
updated: 2026-11-19T20:18:03.512Z
---

## Summary

`projectGitDirectory` in `hub/src/git-maintenance.ts` reads `.git/commondir` with an unbounded `readFile`. Rule 42 requires a size bound enforced while reading. T-1856's correction reuses this parser rather than copying its grammar, and its own Git command ownership records use a bounded 64 KiB reader. impl-1856 reported this on 2026-11-19.

## What to build

Read `.git/commondir` (and any sibling Git metadata that this parser reads) through a bounded reader that counts the bytes it keeps and refuses oversized input loudly. Migrate every consumer of `projectGitDirectory`.

## Acceptance criteria

- [ ] C1. An oversized `.git/commondir` fixture is refused while reading, with a structured outcome, and a normal one still parses (test).
- [ ] C2. Every caller of `projectGitDirectory` is listed with its disposition (rules 20 and 41).
