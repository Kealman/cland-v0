---
id: T-1609
kind: task
title: Push on every ref move
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1604
  - T-1605
topic: null
branch: null
created: 2026-11-02T03:33:57.560Z
updated: 2026-11-04T14:51:39.825Z
---

## Summary

The host agent watches each host task worktree's branch ref and reflog, debounced, and pushes `+refs/heads/<b>:refs/heads/<b>` to `origin` through the git socket. It emits `ref-moved` with the new head and the push result, and persists its watches across its own restart. The hub starts the watch at a host worktree add and stops it at remove.

Hot files: `hub/src/host/agent/watch.ts` (new), `hub/src/host/agent/server.ts` (ops), `hub/src/host/ssh-host.ts` (watch at worktree add), `hub/test/host-push-on-ref-move.test.ts` (new)

## Acceptance criteria

- [ ] C1. A commit in a fake host's task worktree reaches the territory's branch within 5 s, with no push by the session (test).
- [ ] C2. An amend, a reset and a rebase in the worktree each reach the territory, and no `post-commit` hook is installed (test).
- [ ] C3. A push the allow list refuses is reported in `ref-moved` with the refusal, retried at the next move, and never loops (test).
- [ ] C4. Watches survive an agent restart, and a commit made while the agent was down is pushed after it is back (test).

## Notes

Shared files: the agent protocol module (ops `watch`, `unwatch`, `flush`, event `ref-moved`)
