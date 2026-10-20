---
id: T-942
kind: task
title: Find the process that put the executor credential in argv (T-492 C3)
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - security
assignee: null
parent: E-952
blocked_by: []
topic: topic-723
branch: t/T-942-find-the-process-that-put-the-executor
created: 2026-10-20T06:21:21.658Z
updated: 2026-10-20T09:55:50.505Z
---

## Summary

Split from T-492 at the v0.1.4 release (D76). T-492 stops every launched session and test process from inheriting the executor credential, and corrects the docs. Its C3, finding the process whose command line carried the credential, stays open: impl-455 saw it in a `pgrep -fl` listing of test:nvim npm processes on 2026-10-15, and impl-492 could not find the historical source at 5e4697e4.

## Acceptance criteria

- [x] C1. The process that put the credential in argv is named from a reproduction with a fake credential value (never the real one), or the evidence shows that no current cland or test path can do it (every spawn site that builds argv from env is listed and checked).
  - done: impl-942 · 2026-10-20T09:50:09.566Z
- [x] C2. If a path is found, it is fixed and a test with a fake credential asserts argv never contains it.
  - done: impl-942 · 2026-10-20T09:50:10.353Z
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.

## Comments

### impl-942 · 2026-10-20T09:49:28.051Z

Audited launch/source inventory A-7283 (882 source files, 323 native calls across 167 files) and environment-to-command matrix A-7284, committed doc pending. Reproduced unsafe accountPrefix with test-token-not-real in attach shell argv; shared credential filter now runs before serializer reads values. Normal account selection only supplies path variables, so this is a defensive richer-overlay fix, not attribution of the historical npm listing. T1 red/green argv regression and targeted three-adapter launch/control/attach argv checks pass; machine transport fake-boundary checks pass. qaPolicy scope none; no QA criteria. Full static check in progress, source review next.
