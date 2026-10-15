---
id: T-496
kind: task
title: Droplet bundle refuses an integrated dev run when the hub's own tracker writes leave .cland/tasks dirty
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: null
branch: null
created: 2026-10-15T13:23:12.263Z
updated: 2026-10-15T13:27:13.625Z
---

## Problem

An integrated droplet run of `dev` refuses with "dirty or changed worktree cannot be bundled for droplet" whenever `.cland/tasks` has uncommitted changes. The hub writes those files itself on every claim, criterion mark and verdict. On 2026-10-15 at 13:21Z the E-423 stage-1 close cover d967409c failed that way, and the root was dirty again within a minute of the Coordinator's tracker commit. So an integrated droplet run works only by luck of timing.

## Acceptance criteria

- [ ] C1. A droplet bundle of the root takes the committed HEAD tree and ignores uncommitted changes under `.cland/tasks`, the same way that run identity treats tracker-only changes. Uncommitted changes anywhere else still refuse, naming the files.
- [ ] C2. A test dirties `.cland/tasks` in a fake root between submit and bundle, and the run still bundles HEAD. A dirty source file still refuses.

## Comments

### coord · 2026-10-15T13:27:13.625Z

Workaround until this lands: submit the integrated droplet run from a clean detached worktree at dev, not from the root. Cover ab5bddd4 bundled fine that way on 2026-10-15 at 13:24Z, after two root attempts failed on the dirty .cland/tasks/T-458 file.
