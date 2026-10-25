---
id: T-1233
kind: task
title: Selection replay mutates the caller's repository with an unsealed Git environment
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1045
branch: t/T-1233-selection-replay-mutates-the-caller-s
created: 2026-10-24T11:03:29.065Z
updated: 2026-10-25T11:30:36.015Z
---

## Summary

The outer Git helper in hub/test/selection-replay.ts runs `git archive` and `git worktree add/remove` against the caller's repository, without a sealed environment or cwd. Its read-only exemption does not cover these worktree mutations or inherited `GIT_*` variables (rule 15). The T-1231 reviewer found it aside.

## Acceptance criteria

- [x] C1. The manual selection replay runs in a disposable clone with its own HOME, XDG and Git configuration, inherited `GIT_*` removed; it never adds or removes a worktree in the caller's repository (test).
  - done: impl-1233 · 2026-10-25T11:30:35.656Z
- [x] C2. The replay's existing assertions are kept and still pass (test).
  - done: impl-1233 · 2026-10-25T11:30:35.913Z

## Comments

### impl-1233 · 2026-10-25T11:26:47.141Z

Plan: preserve the existing replay CLI seam in hub/test/suite-selection.test.ts (T3, already exercises the actual replay subprocess). C1 regression will use a disposable caller and an audited Git executable, poison only scratch-owned GIT_* / account paths, and assert clone ownership, private HOME/XDG/config, no inherited Git redirect, and no caller worktree mutation. C2 retains and runs existing coverage assertions (selection, time share, own/historical misses, missing-map fallback), with positional selector-ref exercised. Replay metadata remains read-only from the caller. This is test-tool implementation sealing; no wire/schema/refusal/delivery/admission contract is changed.
