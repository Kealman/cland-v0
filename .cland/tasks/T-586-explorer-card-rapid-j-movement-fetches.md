---
id: T-586
kind: task
title: explorer-card "rapid j movement fetches only the rested row" fails at 5.4 s in the Neovim phase on a droplet
state: closed
status: done
size: S
labels:
  - bug
  - nvim
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T09:27:40.884Z
updated: 2026-10-20T06:07:29.258Z
closed: 2026-10-20T06:07:29.258Z
---

## Summary
Integrated cover 8e2c171a at dev 81f03532 (droplet, 2026-10-16 09:15Z) failed one Neovim case, nvim/test/explorer-card.test.ts "rapid j movement fetches only the rested row, reuses cached details and refreshes on updated", after 5.4 s. The hub phase was 1897 pass, 0 fail, and the Neovim phase 389 pass, 1 fail. The case passed 3/3 alone on dev on a quiet Mac. Likely a debounce or rest-timer window that load shifts. The file was last changed by 3271892b (lane flow).

## Acceptance criteria
- [ ] C1. Find which timing assumption breaks under load (the rest debounce, a fetch count or the update refresh) and make the case wait on observed events instead of wall time, with the cause recorded on this item.
- [ ] C2. explorer-card.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet's Neovim phase.

## Comments

### coord · 2026-10-20T06:07:29.258Z

Closed in the D76 triage (2026-10-20, read-only check at dev 9b2cb194, artifact to follow in General): fixed by 8f212a1c (T-848): the explorer-card rapid-movement case no longer times out.
