---
id: T-1614
kind: task
title: A task stays on its host; relaunch elsewhere from the pushed branch
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1609
  - T-1613
  - T-1696
topic: topic-1395
branch: t/T-1614-a-task-stays-on-its-host-relaunch
created: 2026-11-02T03:33:58.847Z
updated: 2026-11-05T19:05:37.398Z
---

## Summary

A relaunch of an item session goes to its own host while that host's tunnel is up, and a request naming another host is refused. When the original host is down, gone or rebooted, `session.resume` with `relaunch` and a `host` field (frame only, no CLI flag) relaunches elsewhere. The new host fetches the pushed task branch and adds the worktree, and the branch's lease moves to it under the territory lock; uncommitted edits are lost, as with a local worktree.

Hot files: `hub/src/adapters/requests.ts`, `hub/src/adapters/sessions.ts`, `hub/src/host/branch-leases.ts`, `hub/test/host-relaunch.test.ts` (new)

## Acceptance criteria

- [ ] C1. A relaunch of a session whose host is up goes to that host and reuses its worktree, and a resume naming another host is refused with a reason saying the task stays on its host (test).
- [ ] C2. After `fake-host.ts gone f1`, a relaunch with `host: "f2"` adds the worktree on f2 at the territory's pushed tip, and the session runs there (test).
- [ ] C3. The lease moves from f1 to f2 under the territory lock: f1's pushes to the branch are refused, and f2's succeed (test).
- [ ] C4. A resume frame without `host` behaves as today, and the session-resume test file passes with no test edited.

## Notes

Shared files: `hub/src/adapters/requests.ts` (`session.resume` gains `host`), `sessions.ts`, the lease API

## Comments

### impl-1614 · 2026-11-05T18:58:26.481Z

Rule 20 sweep recorded in docs/evidence/T-1614-consumers.md before production edits: resume frames, schema/dispatch, CLI/web/nvim/setup/spoke, permission consumers, lease and persisted worktree readers/writers, fixtures and all test tiers. Existing wire clients remain unchanged; new optional host only. C1 starts at public resume-frame seam; native C2/C3 at fake SSH/git socket seam per launch brief.
