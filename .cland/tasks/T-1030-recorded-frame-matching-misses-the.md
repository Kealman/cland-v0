---
id: T-1030
kind: task
title: Recorded-frame matching misses the /private/tmp alias, so Neovim shell tests fail with TMPDIR under /tmp
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-979
branch: t/T-1030-recorded-frame-matching-misses-the
created: 2026-10-20T20:51:01.853Z
updated: 2026-10-24T12:30:55.124Z
---

## Summary

nvim/test/frame-fixtures.ts canonicalizes only the `/private/var` temp alias when matching recorded protocol frames. With TMPDIR under `/tmp` (macOS reports it as `/private/tmp`), the stub hub refuses frames whose paths embed the temp dir as "unrecorded protocol frame" (seen as `session.attach` in nvim/test/shell.test.ts, 10/25 failing, E-789 stage QA M4 on 2026-10-20). With the default `/var/folders/...` TMPDIR the same file passes 25/25 at the same commit 44097bad.

## What to build

Canonicalize every macOS temp alias (`/private/tmp` as well as `/private/var`), or better, compare paths after resolving both through realpath, so a scratch TMPDIR anywhere matches the recordings.

## Acceptance criteria

- [x] C1. nvim/test/shell.test.ts passes with TMPDIR under `/tmp` and under the default `/var/folders` on macOS (targeted local runs named in the item).
  - done: impl-1030 · 2026-10-24T12:30:38.234Z
- [x] C2. A unit test covers the canonicalization of `/private/tmp`, `/tmp`, `/private/var` and `/var` paths (T1).
  - done: impl-1030 · 2026-10-24T12:30:38.734Z

## Comments

### impl-1030 · 2026-10-24T12:27:21.506Z

Starting test-first at the existing canonical()/recording-key seam (C2); will run nvim/test/shell.test.ts separately with TMPDIR under /tmp and default /var/folders (C1), on sealed fixtures from T-1012.

### impl-1030 · 2026-10-24T12:30:51.828Z

Implementation pushed at 4c0233de92f2fe71f1c65eece5d2649e006b8624, tree 6d8dfb5973f02ddabd975dc6cc2a38c9399d56b4. Local macOS arm64: T1 nvim-fixture-boundary 8/8 after expected red; shell.test.ts 25/25 with TMPDIR=/tmp and 25/25 with default /var/folders, serial sealed fixture runs. Hub/nvim typechecks passed. Durable evidence A-10982, raw shell A-10978/A-10981 in topic-979. Both criteria done; source review requested from reviewer, mode-free verification awaits clear verdict. These targeted receipts are not full-suite evidence.
