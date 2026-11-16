---
id: T-1728
kind: task
title: After a recipe or hook change, droplet runs keep booting the old snapshot and status says "inspection deferred", not stale
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1709
topic: null
branch: null
created: 2026-11-06T18:48:43.508Z
updated: 2026-11-16T07:29:06.104Z
---

## Summary

When the running hub's recipe or the project's provision hook no longer matches the snapshot key, droplet runs still boot the old image, and no notice says so. `cland executor status` reports `unknown (inspection deferred)` instead of the stale parts. T-1709's note expected the restart after landing to trigger one rebuild; in practice only an explicit `cland executor prepare` rebuilds.

## What happened

- On 2026-11-06, the hub was restarted (#70) after T-1709 landed.
- Cover 2424aed9 then acquired two droplets from the old image 250987220. That snapshot's key still had `nvim` and `provision: none`.
- At the same time, `executor status` printed `unknown (inspection deferred)` for the snapshot.
- Coord ran `cland executor prepare`, which built cland-v0-35e1dc609f89 with the new key (`recipe`, `provisionPath` and `provision` digest).
- `acquire` in `hub/src/executor/droplet/droplet.ts` reads the snapshot and uses its image without comparing the key with the current recipe and hook.

## What to build

- A run that finds the snapshot key stale against the running hub's recipe and the committed hook gets one notice naming the stale parts, addressed to the Coordinator, with "run cland executor prepare".
- `executor status` shows `stale: <parts>` once the hub has computed the key, rather than leaving it deferred indefinitely.
- Booting the old image stays allowed (it is still a working image); no automatic rebuild.

## Acceptance criteria

- [ ] C1. With a snapshot whose key lacks `recipe` or differs in `provision`, a droplet run posts one notice naming the stale parts and `cland executor prepare`, and the run still starts (test).
- [ ] C2. `cland executor status` reports `stale: <parts>` for that snapshot, and `current` after a prepare with the matching key (test).
- [ ] C3. The executor test files (`executor-droplet`, `executor-prepare`, `executor-safety`) pass with no test edited.
