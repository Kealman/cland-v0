---
id: T-1805
kind: task
title: login-add leaves a fixture-owner registry whose roots list a removed fixture root and the live source worktree
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1777
found_by: review
topic: null
branch: null
created: 2026-11-10T12:19:52.954Z
updated: 2026-11-10T12:19:52.954Z
---

## Summary

After `hub/test/login-add.test.ts` runs, its private TMPDIR keeps one fixture-owner registry JSON. Its `roots` list holds a removed `/tmp/hc…` fixture root and the live worktree of the source under test, which isn't a scratch root (checked with realpath). No deletion was observed. But any later owner-driven cleanup that trusted this registry could reach the live worktree, so a fixture registry must never name a non-disposable path.

## Evidence

Found by impl-1778 during T-1778's native slot at 1cba8d79c, 2026-11-10 12:18Z, topic-1461. The registry and both referenced paths were left untouched. All CLI and hub operations logged disposable project roots.

## Acceptance criteria

- [ ] C1. The login-add fixture registers only roots it allocated under its scratch root, and the source worktree never appears in a fixture-owner registry (test).
- [ ] C2. The registry is removed, or marks every root released, once the file's cleanup has joined; a TMPDIR inventory after the file reads 0 → 0 (test).
- [ ] C3. A guard in the shared fixture-owner code refuses to register a path outside the scratch roots, with a planted control (test).
