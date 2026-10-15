---
id: T-496
kind: task
title: Droplet bundle refuses an integrated dev run when the hub's own tracker writes leave .cland/tasks dirty
state: open
status: in progress
size: S
rank: 3100
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-308
branch: t/T-496-droplet-bundle-refuses-an-integrated-dev
created: 2026-10-15T13:23:12.263Z
updated: 2026-10-15T16:26:20.081Z
---

## Problem

An integrated droplet run of `dev` refuses with "dirty or changed worktree cannot be bundled for droplet" whenever `.cland/tasks` has uncommitted changes. The hub writes those files itself on every claim, criterion mark and verdict. On 2026-10-15 at 13:21Z the E-423 stage-1 close cover d967409c failed that way, and the root was dirty again within a minute of the Coordinator's tracker commit. So an integrated droplet run works only by luck of timing.

## Acceptance criteria

- [ ] C1. A droplet bundle of the root takes the committed HEAD tree and ignores uncommitted changes under `.cland/tasks`, the same way that run identity treats tracker-only changes. Uncommitted changes anywhere else still refuse, naming the files.
- [ ] C2. A test dirties `.cland/tasks` in a fake root between submit and bundle, and the run still bundles HEAD. A dirty source file still refuses.
- [ ] C3. An integrated occasion run (verify all --occasion stage) from the root bundles committed HEAD for every shard while .cland/tasks is dirty, and a test proves it end to end against the fake droplet executor.

## Comments

### coord · 2026-10-15T13:27:13.625Z

Workaround until this lands: submit the integrated droplet run from a clean detached worktree at dev, not from the root. Cover ab5bddd4 bundled fine that way on 2026-10-15 at 13:24Z, after two root attempts failed on the dirty .cland/tasks/T-458 file.

### coord · 2026-10-15T16:22:43.116Z

Now blocking: integrated occasion runs (`cland verify all --occasion stage|epic|release`) must run from the root on dev, and a detached worktree is refused ("occasion requires an integrated dev full request ... with fresh origin/dev fetch proof"). Both shards of the E-387 stage-1 close run e08a7659 at 1868193c (A-3152, 2026-10-15 16:21Z) failed with "dirty or changed worktree cannot be bundled for droplet": the hub's own .cland/tasks writes landed during the 88 s typecheck. So until this lands, no stage, epic or release close can shard. Priority: top of E-425. Add a C3: an occasion run bundles committed HEAD while .cland/tasks is dirty, and a test proves it.

### impl-496 · 2026-10-15T16:26:20.081Z

Red reproduction: both new executor-run delivery regressions failed on the previous code (tracker write refused; dirty-source diagnostic lacked its path). Delivery now excludes only .cland/tasks before and after bundle creation, while bundling the submitted committed head and reporting refused dirty paths. Occasion regression checks committed tracker bytes and exact head on both fake droplets. Targeted green runs pending the Mac test window.
