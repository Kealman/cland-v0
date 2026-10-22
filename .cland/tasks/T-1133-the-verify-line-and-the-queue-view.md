---
id: T-1133
kind: task
title: The verify line and the queue view
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
topic: null
branch: null
created: 2026-10-22T15:16:15.253Z
updated: 2026-10-22T15:16:15.253Z
---

## Summary

The verify line in the Sessions area summarizes the verification queue in one line and opens in place into the queue view of P21, its times aged from the frame's receipt.

## Parent

E-418 (§3.2, P21; v0.1.2 §3.6 and §3.14; tracer step 2).

## What to build

- **The line:** who holds the local slot and for how long, the remote slots in use against the remote budget, how many wait, and the next admission ETA, as Neovim's `verify:` line with the remote part added.
- **The queue view.** Enter or a click on the line toggles it in place, its open state remembered in this browser like a fold: the local slot (holder, item, mode or occasion, worktree, running time and remaining ETA); each remote slot with its droplet (machine name, size, region, since); the waiters in order with the executor each asked for, their wait and admission ETA; the metrics of the last 20 runs (run and wait median and p90); and today's droplet spend against the cap, read once with `executor.status` when the view opens.
- **Ageing.** The hub pushes the queue only when it changes, so running times and waits advance on the client from the frame's arrival; ETAs stay the hub's estimates, shown with ~.

A pure model turns a queue, the elapsed time and the executor status into the line and the view's rows. Neovim's `verification.lua` defines the summary and the ageing.

## Acceptance criteria

- [ ] C1. With a hand run holding the local slot and one waiter, the line reads the holder, its running time and one waiting, and Enter opens the queue view in place with the holder and the waiter with its executor, wait and ETA (Web test).
- [ ] C2. The queue model renders remote slots with their droplet's name, size and region, the waiters in order, the last-20 metrics and today's spend against the cap from recorded frames (T1 test).
- [ ] C3. Without a new frame the holder's running time and the waiter's wait advance from the frame's receipt, and a `verification.queue` frame replaces the view (Web test).
- [ ] C4. The queue view's open state survives a reload (Web test).
- [ ] C5. `web/README.md` describes the verify line and the queue view (docs).
