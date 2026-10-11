---
id: T-211
kind: task
title: A pooled Implementer session moves to the next item's worktree on reuse
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-11T05:00:24.480Z
updated: 2026-10-11T06:35:55.626Z
---

## What to build

Split from T-182 (2026-10-11). crew.toml allows a `pool` policy for Implementers. No harness adapter can move a running session's working directory between task worktrees, so T-182 reuses across items only for the root-based Reviewer and QA pools; an Implementer pool counts toward the cap but launches fresh per worktree.

Design and build a worktree handoff for pooled Implementers. Either relaunch the harness in the new worktree while keeping its context (resume by harness session id), or run Implementers from a stable directory with per-item worktrees passed in. Choose one and document it.

## Acceptance criteria

- [ ] An Implementer pool member, once its item merges, takes the next item in that item's worktree with the context policy that keep_context says.
- [ ] Protocol and fake-harness tests cover reuse across two items.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Not for v0.1 unless the human promotes it.

## Comments

### coord · 2026-10-11T05:01:38.705Z

Scope from impl-182 (T-182): either define adapter cwd relocation or a safe replacement/handoff protocol; transfer the item claim to the next item; release the previous worktree without losing context.
