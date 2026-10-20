---
id: T-1030
kind: task
title: Recorded-frame matching misses the /private/tmp alias, so Neovim shell tests fail with TMPDIR under /tmp
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
created: 2026-10-20T20:51:01.853Z
updated: 2026-10-20T20:51:01.853Z
---

## Summary

nvim/test/frame-fixtures.ts canonicalizes only the `/private/var` temp alias when matching recorded protocol frames. With TMPDIR under `/tmp` (macOS reports it as `/private/tmp`), the stub hub refuses frames whose paths embed the temp dir as "unrecorded protocol frame" (seen as `session.attach` in nvim/test/shell.test.ts, 10/25 failing, E-789 stage QA M4 on 2026-10-20). With the default `/var/folders/...` TMPDIR the same file passes 25/25 at the same commit 44097bad.

## What to build

Canonicalize every macOS temp alias (`/private/tmp` as well as `/private/var`), or better, compare paths after resolving both through realpath, so a scratch TMPDIR anywhere matches the recordings.

## Acceptance criteria

- [ ] C1. nvim/test/shell.test.ts passes with TMPDIR under `/tmp` and under the default `/var/folders` on macOS (targeted local runs named in the item).
- [ ] C2. A unit test covers the canonicalization of `/private/tmp`, `/tmp`, `/private/var` and `/var` paths (T1).
