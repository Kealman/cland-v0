---
id: T-1604
kind: task
title: The host's clone and its worktrees from the territory
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1597
  - T-1599
topic: null
branch: null
created: 2026-11-02T03:33:56.426Z
updated: 2026-11-03T14:32:39.627Z
---

## Summary

When a host's tunnel is first up, the agent clones the territory into the host's work directory. The clone's `origin` reaches `git.sock` through `cland host git-proxy` as `core.gitProxy`, and a bundle copied over `scp` on the same master is the fallback when the daemon clone fails. A launch on a host fetches its task branch from `origin` and adds the worktree, with the root `node_modules` link. An item launch grants that host the branch's lease.

Hot files: `hub/src/host/ssh-host.ts` (worktreeAdd with territory), `hub/src/host/agent/worktrees.ts`, `hub/src/cli/host.ts` (`git-proxy`), `hub/src/hub/worktrees.ts`, `hub/test/host-clone.test.ts` (new)

## Acceptance criteria

- [ ] C1. On a fake host the first clone goes through the git socket with `core.gitProxy` set to `cland host git-proxy`, and no other remote URL or credential is configured (test).
- [ ] C2. When the daemon clone fails, the host is cloned from a bundle copied over `scp` on the master, and its `origin` still points at the git socket (test).
- [ ] C3. An item launch on a fake host creates the task branch in the territory (as T-1555 does), grants that host its lease, and adds the worktree on the host at the territory's tip (test).
- [ ] C4. A worktree add that fails on the host leaves no lease and no territory branch created by the launch behind (test).
- [ ] C5. Worktree prune of a host task worktree removes it through that host's agent, and the task-worktrees and worktree-cli test files pass with no test edited (test).

## Notes

Shared files: `hub/src/host/ssh-host.ts` (19 after); the lease API (calls grant)

## Comments

### coord · 2026-11-03T14:32:39.627Z

Carried over from T-1600 (coord decision 2026-11-03 14:32Z): T-1600 writes the canonical remote discovery file at `~/.cland-host/run/hub.json` (`remoteHostLayout.discoveryFile`) when the carrier is first up. It is 0600 and holds the per-host secret only, and launched sessions reach it through `CLAND_HUB_FILE`. The host clone doesn't exist until this item. When this item clones the territory on the host, it must also place the clone's `.cland/hub.json`, with the same content and mode, so that CLI, hook and spoke walk-up discovery from a worktree inside the clone finds it. It must be unchanged across a hub restart. Add a test: a CLI run in a host worktree, with no `CLAND_HUB_FILE`, reaches the hub through it.
