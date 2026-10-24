---
id: T-515
kind: task
title: RULES.md writer leaves a trailing blank line that trips git diff --check
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
regression_of: T-455
topic: topic-1009
branch: t/T-515-rules-md-writer-leaves-a-trailing-blank
created: 2026-10-15T16:44:45.990Z
updated: 2026-10-24T21:49:09.325Z
---

## Summary

The rulebook writer (T-455) ends `.cland/RULES.md` with a blank line, `\n\n`. So `git diff --check` warns on every commit that carries it, and an implementer's commit chain stopped on that inherited warning on 2026-10-15 (T-485).

## Acceptance criteria

- [ ] C1. `cland rule add/edit/retire` writes RULES.md ending in exactly one newline, and a test checks the written bytes.
- [ ] C2. The live RULES.md is normalised once, with `git diff --check` clean.
