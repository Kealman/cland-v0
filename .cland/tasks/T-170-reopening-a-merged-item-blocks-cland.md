---
id: T-170
kind: task
title: "Reopening a merged item blocks cland push and strands its worktree: one rule for reopen after merge"
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
created: 2026-10-10T10:13:29.682Z
updated: 2026-10-11T06:35:54.280Z
---

## Parent

T-19 (follow-ups). Found on 2026-10-10 while reopening T-165 for a fix round.

## What to build

Reopening a merged task (`task edit --state open`) leaves its merge receipt active. `cland push` then refuses with "finish pending cland merge T-n before pushing dev", because the open item still has a landed receipt. Launching an Implementer on the reopened item recreated `.cland/worktrees/T-165`. Running `cland merge T-165` to clean up then refused: "already landed, but the task branch changed since; reconcile the item before merging further work". The worktree was left behind.

Decide and implement one rule for reopening a landed item. Either:
- reopening retires its merge receipt, so a new round starts from dev on a fresh branch; or
- `task edit --state open` on a landed item is refused, naming the follow-up-ticket path.

Then make `cland merge` able to remove a stale worktree for a closed, landed item.

## Acceptance criteria

- [ ] Reopening a landed item never blocks `cland push`; the chosen rule is documented in docs/agents/issue-tracker.md.
- [ ] A stale worktree of a closed, landed item can be removed through cland, and `.cland/worktrees/T-165` is cleaned up.
- [ ] A CLI test covers reopen after merge, then push.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. tech-debt.
