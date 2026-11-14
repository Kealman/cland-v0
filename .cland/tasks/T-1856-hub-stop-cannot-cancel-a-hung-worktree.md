---
id: T-1856
kind: task
title: Hub stop cannot cancel a hung worktree prune git; it can outlive the hub
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-14T10:12:33.598Z
updated: 2026-11-14T10:26:14.715Z
---

## Summary

After T-1855, hub stop joins an in-flight worktree prune retry for a named bound. Past that bound it returns a typed "incomplete" outcome and leaves storage, tracker and lock for process exit. A prune `git` child that truly hangs can therefore outlive the hub as an orphan. T-1855's reviewer proposed bounded native cancellation of the owned prune processes instead. That change touches the shared `territoryGitAsync`, the host agent's command and removal integration (closure regeneration) and the Dispatcher/daemon stop fence, so it was split out here.

## What to build

At a hard bound after the soft log, hub stop terminates only the prune's own native processes, through their recorded native identity (existing endProcess), joins their actual close and the prune's settlement, and starts no new territory effects after cancellation. Leftover Git lock files are reported, not silently deleted. A native stop that cannot be confirmed keeps the retry owner usable and reports incompleteness.

## Acceptance criteria

- [ ] C1. A hung owned prune git is terminated at the hard bound through its native identity, its close is joined, and no territory write happens after cancellation (test).
- [ ] C2. A process the prune doesn't own is never signalled, and an unconfirmed native stop reports incompleteness with a usable retry owner (test).

## Comments

### coord · 2026-11-14T10:26:14.715Z

Added scope (from T-1855's supervisor check, 2026-11-14 10:26Z): hub.lock and territory.lock use stale-PID recovery. After an incomplete stop, serve exits 1, so the lock's PID is dead. A respawned serve (for example, under the operator's launchctl submit job) can reclaim the locks while an orphan prune git still writes territory.git. Native cancellation, or an orphan-writer fence that survives hub exit, must also cover this respawn case.
