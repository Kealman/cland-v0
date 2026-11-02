---
id: T-1597
kind: task
title: The per-host allow list of leased task branches
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1591
topic: null
branch: null
created: 2026-11-02T03:33:54.676Z
updated: 2026-11-02T03:33:54.676Z
---

## Summary

The territory's `update` hook, when `CLAND_PUSH_HOST` is set, accepts a push only to `refs/heads/<branch>` for a task branch leased to that host. It refuses tags, other refs and deletions. The hub grants and revokes leases by rewriting the allow list under the territory lock, and revokes a branch's lease before a merge reads it. Existing territories get the new hook at hub start.

Hot files: `hub/src/territory.ts` (`TERRITORY_HOOK`, hook install), `hub/src/host/branch-leases.ts` (new), `hub/src/hub/merge.ts`, `hub/src/hub/merge-batch-territory.ts`, `hub/test/host-allow-list.test.ts` (new)

## Acceptance criteria

- [ ] C1. Through host A's git socket a push to a task branch leased to A succeeds, and a push to a branch leased to host B, to an unleased task branch, to a tag or to `dev` is refused with a reason naming the host (test).
- [ ] C2. Grant and revoke rewrite the allow list only under the territory lock, and a push racing a revoke is either accepted before it or refused after it, never merged after the revoke (test).
- [ ] C3. Before a merge or a merge batch reads a task branch, the hub revokes every host's lease on it under the territory lock, and a later host push to it is refused (test).
- [ ] C4. A territory initialised before this change gets the new hook at hub start, and pushes from the hub's own guarded operations (no `CLAND_PUSH_HOST`) behave as today (test).
- [ ] C5. The territory-cli, territory-lock, merge and task-worktrees test files pass with no test edited.

## Notes

Shared files: `TERRITORY_HOOK` and the lease API grant/revoke (sole owner; 18 and 28 call it); `hub/src/territory.ts`
