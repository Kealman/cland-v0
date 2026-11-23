---
id: T-2063
kind: task
title: startup-listener-scale's listener case fails "hub setup incomplete" when its 1,500-answer hub setup exceeds the 10 s load-scaled setup bound on a slow-disk droplet
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1717
branch: t/T-2063-startup-listener-scale-s-listener-case
created: 2026-11-23T18:29:37.144Z
updated: 2026-11-23T22:08:36.471Z
---

## Summary

Linux stage cover 3e193ed3 (2026-11-23, dev 40f68c7d9, A-22671, shard 1 on cland-v0-8302a8b3) failed `hub/test/startup-listener-scale.test.ts › listener binds report each await while retained verdict freshness drains` after 15.9 s. The error was `Error: … hub setup incomplete; fixture retained`, raised from `stage-case-fixture.ts:22` through the `deadline.ts:24` timer. The case's hub setup is bounded by `testSetupWaitMs()` (10 s on that machine), and building the 1,500-answer fixture took longer. The shard's disk was slow: fsync 9.44 ms and SQLite 33.67 ms, against about 3–4 ms on healthy droplets. The work-only sibling's setup took 6.8 s against the same 10 s bound. The case passed in cover 77af614d, periodic run 6a592423 at the same commit, and batch 09681165.

## What to build

Size this case's setup bound from its fixture cost: a named, load-scaled setup budget for the 1,500-answer projectHub. Alternatively, make the setup cheaper, so a slow-disk droplet doesn't turn setup time into a red. Keep the case's census and listener assertions unchanged.

## Acceptance criteria

- [ ] C1. On a slow-disk Linux droplet (fsync ≥ 9 ms), the listener case's setup completes within its bound, or the bound is derived from the fixture size and machine health, and the case passes 5/5 (evidence).

## Comments

### coord · 2026-11-23T22:06:37.027Z

Second occurrence: Linux stage cover 37b7f4fd (2026-11-23, dev 2665701ea, A-22692, shard 2 on cland-v0-93323017, fsync 11.55 ms, SQLite 31.57 ms) failed with the same `hub setup incomplete; fixture retained`. In that run the work-only sibling's setup took 7.59 s against the 10 s bound. Two consecutive stage covers were red on this case alone, and the one flaky-rerun resubmit is used. Pulled into 0.4.1 (E-1888 stage 4) under the human's standing yes for bug items, because the stage and epic covers can't go green while slow-disk droplets hit it.

### impl-2063 · 2026-11-23T22:08:36.471Z

Prepared a temporary fixture-owned SQLite commit-delay probe (9 ms per commit, first 1,500 commits only, native launch guard retained). The old setup bound is still unchanged for red-first reproduction. Coordinator approved controlled local emulation but native slot is held by epic cover 4e4ae4e1; waiting for its explicit release/grant. No native tests run yet.
