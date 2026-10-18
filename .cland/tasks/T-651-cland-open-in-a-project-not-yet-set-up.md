---
id: T-651
kind: task
title: 'cland open in a project not yet set up prints "next: cland setup" and opens the workbench as usual'
state: open
status: review
size: XS
criterion_seq: 3
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-650
topic: topic-536
branch: t/T-651-cland-open-in-a-project-not-yet-set-up
created: 2026-10-16T16:24:00.577Z
updated: 2026-10-18T22:17:05.397Z
---

## Summary

A project initialised but not set up opens as usual, with one line before the workbench: `next: cland setup` (Q-599 resolution 6). What marks a project as set up is one exported predicate, which E-613's `cland setup` writes against.

## What to build

- **The predicate** `projectSetUp(root)`, exported from one module of the hub, true when `.cland/roles.toml`'s `[aide.launch] harness` line carries setup's mark of the human's choice (the setup prototype's `CHOSEN` comment, `# the human's favourite, chosen in cland setup`; the mark itself is an open question in the README). The mark is one exported constant, which E-613 writes.
- **The line.** In `hub/src/cli/open.ts`, after ticket T-650's check and before the hub starts: when `projectSetUp` is false, `next: cland setup` on stderr; then the hub and the workbench start as today, and the exit code is the launcher's.
- A malformed `roles.toml` counts as not set up and does not stop the open (the hub reports the file as it does today).
- The hub README's open section names the line and the mark.

## Acceptance criteria

- [x] C1. `cland open` in a project fresh from `cland init` prints exactly one line, `next: cland setup`, then runs the stand-in launcher on the root with its exit code returned (open.test.ts).
  - done: impl-651 · 2026-10-18T22:15:55.024Z
- [x] C2. With the mark on `[aide.launch] harness`, `cland open` prints no such line.
  - done: impl-651 · 2026-10-18T22:15:55.433Z
- [x] C3. `projectSetUp` returns false for a missing, an unmarked and a malformed `roles.toml`, and true for a marked one (unit test).
  - done: impl-651 · 2026-10-18T22:15:55.873Z

## Comments

### impl-651 · 2026-10-18T22:14:53.615Z

Implementation seams follow the assignment: T1 projectSetUp(root) in roles/editor.ts, using the existing logical TOML scanner; T2 open CLI against projectHub with scratch HOME/XDG and provider/account isolation. First red/green: missing export failed roles-editor.test.ts; predicate now passes missing/unmarked/malformed/marked cases.

### rev-30 · 2026-10-18T22:17:05.397Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-651-source
commit: eee54107a578e065aec9f8d80d581f5444becb74
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at eee54107. Shared projectSetUp/CHOSEN uses validated logical TOML and exact trailing aide.launch harness mark; malformed/missing/unmarked files return false without writes. Hint follows T-650 guard and precedes startup, preserving launch behavior. T1 table, T2 exact hint/marker suppression and existing malformed real-startup case retain coverage/isolation. A-5603 records both axes and claimant-reported host checks with limits. C1–C3 await accepted exact-head runtime; no findings or per-item QA.
