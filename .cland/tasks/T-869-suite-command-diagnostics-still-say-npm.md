---
id: T-869
kind: task
title: suite-command diagnostics still say 'npm' for any stack's commands
state: open
status: in progress
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: t/T-869-suite-command-diagnostics-still-say-npm
created: 2026-10-19T11:52:12.288Z
updated: 2026-10-19T15:28:15.585Z
---

## Summary

hub/src/suite-command.ts still labels generic shell-command failures as "npm terminated by …" and inherited-pipe cleanup as "npm pid …". Since T-666, any stack's commands run through it, so these diagnostics can misname a Python or other command.

Found aside by impl-666 on 2026-10-19.

## Acceptance criteria

- [ ] C1. Both diagnostics name the command actually run (or a stack-neutral word), and a test with a non-npm command asserts the wording.
