---
id: T-2018
kind: task
title: qa.test.ts groupGone treats every process-group probe error as absence; only ESRCH proves the group is gone
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-20T00:18:35.899Z
updated: 2026-11-20T00:18:35.899Z
---

## Summary

The `groupGone` helper in `nvim/test/qa.test.ts` treats every exception from `process.kill(-pgid, 0)` as proof that the process group is gone. Only `ESRCH` establishes that. A permission error or another probe failure is an unknown, which should fail the check rather than pass it. This is a static finding from T-1798's source review; none of the retained runs hit such an error.

## What to build

Treat only `ESRCH` as absence. Any other error from the probe fails the assertion with its literal code.

## Acceptance criteria

- [ ] C1. A probe that throws a non-ESRCH error makes the no-spinning-Neovim check fail, naming the code, while ESRCH still passes (test).
