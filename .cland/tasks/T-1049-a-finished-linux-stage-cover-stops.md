---
id: T-1049
kind: task
title: A finished Linux stage cover stops counting after a hub restart
state: open
status: in progress
size: S
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-799
branch: t/T-1049-a-finished-linux-stage-cover-stops
created: 2026-10-21T12:50:24.466Z
updated: 2026-10-21T12:51:18.810Z
---

## Summary

Linux stage cover bb909399 (droplet, two shards, all exit 0) finished at cb231eeb at 12:33Z on 2026-10-21. With macOS cover b73a6fc9 it made the stage cover complete: that result printed "stage cover complete (Linux droplet, macOS)" at 12:39Z. After hub restart #37 (12:39:51Z, the first restart with T-1039), `task plan show` reports the same tree 820b3207 as "missing Linux droplet" for E-412 stage 3 and E-415 stage 2. The macOS cover still counts. So E-412 stage 3 does not close despite a current clear QA verdict.

## What to build

A Linux droplet cover restored from the suite history after a hub restart still satisfies `stageCovers` (hub/src/hub/suites.ts). Find which of the fields `stageCovers` requires is missing or different on the restored job: `shards` with each shard's outcome and platform, `shardingSkipped`, `occasion`, `platform.os` or `reported`. Restore or persist it. Check whether T-1039's restore change (1fc2aca2: no rewrite of the history per restored process) left the field unsaved.

## Acceptance criteria

- [ ] C1. A two-shard Linux droplet stage cover recorded before a hub restart still counts as the stage's Linux cover after the restart (test across a real restart of a projectHub).
- [ ] C2. The cause is named in the item topic: the field and the code path.
