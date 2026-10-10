---
id: T-201
kind: task
title: "The suite lock serves its waiters in order: the oldest waiter takes it next"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
  - high
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T17:49:08.493Z
updated: 2026-10-10T19:17:55.617Z
---

## What to build

The machine-wide suite locks (/tmp/cland-suite.lock and /tmp/cland-suite-nvim.lock, T-175) are taken by polling, so there is no order among waiters. On 2026-10-10 T-176's full suite waited from 16:34Z and lost the lock twice, first to T-143's and then to T-183's run (runner started 17:46Z), which had started waiting later. A long waiter can starve while newer runs go ahead.

Give the lock a queue: each waiter writes a ticket (its pid, start time and worktree) under the lock's directory, and the oldest live ticket takes the lock when it frees. Dead waiters' tickets are swept. `npm test` prints its place in the queue while it waits.

## Acceptance criteria

- [ ] Three waiters started in order A, B, C take the lock in that order, whatever their poll timing.
- [ ] A waiter that dies leaves no ticket that blocks the others.
- [ ] A waiting run reports its queue position and the holder's worktree.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Reported by the stand-in on 2026-10-10. The human named a hub queue for shared resources as a v0.1.1 theme; this is the local fix for the suite. Interim: the Coordinator holds new suite launches when a run has waited over 30 minutes.

## Comments

### coord · 2026-10-10T19:17:55.617Z

Second cause seen 19:17Z (T-204): the nested locks. A Neovim run takes the Neovim lock, then waits for the machine lock while it keeps the Neovim lock, which blocks every other run's Neovim phase. The queue should cover both locks as one ordered resource, or a run should take the machine lock first and the Neovim lock inside it.
