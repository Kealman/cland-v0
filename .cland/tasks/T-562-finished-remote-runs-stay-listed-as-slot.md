---
id: T-562
kind: task
title: Finished remote runs stay listed as slot holders, and their waiters never get admitted
state: open
status: in progress
size: M
labels:
  - v0.1.3
  - hub
  - bug
assignee: null
parent: E-425
blocked_by: []
topic: topic-352
branch: t/T-562-finished-remote-runs-stay-listed-as-slot
created: 2026-10-16T02:03:05.929Z
updated: 2026-10-16T02:36:45.467Z
---

## Summary
On 2026-10-16 between 01:30Z and at least 02:03Z, `cland verify queue` listed four remote holders whose runs had already finished, each with a result.json:
- T-550 97a70087: a real droplet run, exit 1, finished 01:30:19Z;
- T-548 efff3e59, T-469 cd760b4c and T-527 2d023454: "lock acquisition deadline reached" with no droplet, results written 01:58:56Z.

`executor status` showed two live droplets, but the queue counted 6/6. Five waiters stayed "waiting for remote", the longest for over 30 minutes, including both hub-fix tasks. The owners' `cland verify cancel` correctly answered "suite already finished", so nothing could free the slots short of a hub restart. Related: T-491 (the lock deadline) and T-561 (local fallback waiters).

## Acceptance criteria
- [ ] C1. A remote run's slot is released, and its waiters re-evaluated, when its result is written: normal completion, an acquisition failure (lease id null), or a release that can't be confirmed. Slot occupancy follows live leases and runs, not stale holder rows.
- [ ] C2. A test fills the remote budget, makes one holder's lease acquisition fail and another finish normally, and shows both slots freed and two waiters admitted, with no restart.

## Comments

### coord · 2026-10-16T02:25:05.747Z

Recurrence after the 02:03Z restart (hub pid 21811). Within about 40 s of the restart, while the hub sat near 100% CPU reconnecting sessions, three admissions logged executor-release-unconfirmed with "lock acquisition deadline reached" and lease id null: T-523 9b9237a3 and T-556 de3df9c9 at 02:06:19Z, and T-551's c3034303 at 02:06:46Z. No droplet was created for the first two.

By 02:24Z each run had a result.json:
- 9b9237a3 and de3df9c9: code 1, "lock acquisition deadline reached", finished 02:24:29Z;
- a53c3d9c: code 124, run timeout 50m, finished 02:05:42Z.

`verify queue` still lists all three as remote holders (6/6 shown, 3 real droplets on DigitalOcean). The executor's 02:13Z sweep already counts 3 leases. So the scheduler keeps slots that the executor has released. Before the restart, `verify cancel` on such runs answered "suite already finished" and freed nothing, so cancel is no workaround.

Fix expectation: a result.json, or an unconfirmed release with a null lease, must release the scheduler slot. (Reported by the stand-in's hourly check and confirmed by coord.)

### coord · 2026-10-16T02:35:59.653Z

Restart at 02:33:32Z (pid 83118) did not clear the holders. Five finished runs, each with a result.json and no posted receipt, were reloaded as active remote holders: T-551 a53c3d9c, T-505 3df8e38c, T-523 9b9237a3, T-559 4cff14eb and T-517 85b2c03a. Only T-556's holder cleared, since T-556 had merged and its worktree was gone. Owners also can't resubmit ("this session already has a suite queued or running"). The heartbeat lists all five as "ended without a posted result". So startup has to reconcile persisted holders with result.json: post the receipt, then free the slot. Add C3 for that.
