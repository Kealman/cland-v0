---
id: T-762
kind: task
title: "subscriptions.test.ts: a replayed terminal session fact reaches a subscription created for the next launch on a slow droplet"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T22:57:33.480Z
updated: 2026-10-17T22:57:33.480Z
---

## Summary

In droplet run 4458319f (T-752 at 9096e2b4, A-4824, 2026-10-17 at 22:53Z), the droplet was very slow: the run took 2890 s, with name-reservation going from 23 s to 84 s. There, hub/test/subscriptions.test.ts:453, "a terminal session role update preserves a subscription created for its next launch", failed at line 475: "the prior terminal fact must not replay into a new subscription". It expected only `impl launched` and `impl idle`, and saw a replayed earlier fact. The same file passes 5/5 serially on the Mac at the same head (A-4833). T-752's diff doesn't touch subscriptions.

## What to build

The test waits on the hub's receipt that the terminal fact was recorded before it creates the next subscription, or the hub's replay cut-off becomes explicit. A slow store can then no longer reorder the replay window.

## Acceptance criteria

- [ ] C1. The case passes 20/20 under a scripted store delay that reproduces the replay before the fix, with the assertion unchanged.
