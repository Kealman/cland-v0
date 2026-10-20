---
id: T-942
kind: task
title: Find the process that put the executor credential in argv (T-492 C3)
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - security
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-20T06:21:21.658Z
updated: 2026-10-20T06:21:21.658Z
---

## Summary

Split from T-492 at the v0.1.4 release (D76). T-492 stops every launched session and test process from inheriting the executor credential, and corrects the docs. Its C3, finding the process whose command line carried the credential, stays open: impl-455 saw it in a `pgrep -fl` listing of test:nvim npm processes on 2026-10-15, and impl-492 could not find the historical source at 5e4697e4.

## Acceptance criteria

- [ ] C1. The process that put the credential in argv is named from a reproduction with a fake credential value (never the real one), or the evidence shows that no current cland or test path can do it (every spawn site that builds argv from env is listed and checked).
- [ ] C2. If a path is found, it is fixed and a test with a fake credential asserts argv never contains it.
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.
