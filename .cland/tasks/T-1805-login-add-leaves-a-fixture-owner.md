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
updated: 2026-11-14T22:17:25.602Z
---

## Summary

After `hub/test/login-add.test.ts` runs, its private TMPDIR keeps one fixture-owner registry JSON. Its `roots` list holds a removed `/tmp/hc…` fixture root and the live worktree of the source under test, which isn't a scratch root (checked with realpath). No deletion was observed. But any later owner-driven cleanup that trusted this registry could reach the live worktree, so a fixture registry must never name a non-disposable path.

## Evidence

Found by impl-1778 during T-1778's native slot at 1cba8d79c, 2026-11-10 12:18Z, topic-1461. The registry and both referenced paths were left untouched. All CLI and hub operations logged disposable project roots.

## Acceptance criteria

- [ ] C1. The login-add fixture registers only roots it allocated under its scratch root, and the source worktree never appears in a fixture-owner registry (test).
- [ ] C2. The registry is removed, or marks every root released, once the file's cleanup has joined; a TMPDIR inventory after the file reads 0 → 0 (test).
- [ ] C3. A guard in the shared fixture-owner code refuses to register a path outside the scratch roots, with a planted control (test).

## Comments

### coord · 2026-11-14T22:17:25.602Z

Occurrence in E-1537 stage-3 QA at 932f3018c (run qa-e1537s3-2026-11-14-qa678-1, evidence A-19436, rows 63/99). `hub/test/login-add.test.ts:17,27–28` leaves source-worktree receipt `f68a3881-c9e3-4be1-86c4-00344d909b3a.json`. Owner PID 6397 is absent, fixture /private/tmp/hc-kyQw68 is gone and no handle is open; the surviving source root is QA's worktree. The producers (login-add, host-create-fixture, harness, cli/hub, shared/fixture-ownership, host/records) are byte-identical to b3a30c490. The receipt was left untouched. Trace and hashes: A-19436 row63-residue-trace.json.
