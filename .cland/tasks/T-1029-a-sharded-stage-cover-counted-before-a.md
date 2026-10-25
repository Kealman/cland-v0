---
id: T-1029
kind: task
title: A sharded stage cover counted before a hub restart is lost after it
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: null
branch: t/T-1029-a-sharded-stage-cover-counted-before-a
created: 2026-10-20T20:41:07.527Z
updated: 2026-10-25T17:08:47.488Z
---

## Summary

A sharded Linux stage cover counted before a hub restart is lost after it. Stage cover 918b2a95 (2 droplet shards, green, A-8040) completed at 20:35:16Z on 2026-10-20 and the hub reported "stage cover complete (Linux droplet, macOS)" at tree 60732b92; after hub restart #35 at 20:36Z, `task plan show` for E-1006, E-789 and E-412 reports "stage cover missing Linux droplet" at the same tree, while the unsharded macOS cover 53af0d11 is still counted. QA's stage verdict for E-1006 was then recorded current:false and the stage stayed open, so the Linux cover had to run again (about 30 minutes and a droplet pair).

## What to build

Persist the merged result of a sharded close run (stage, epic, release) as a durable cover record at completion, as for unsharded runs, and restore it on hub start. Check whether T-1025's cover/receipt changes (Web phase fields) affect how stored receipts are read back.

## Acceptance criteria

- [ ] C1. A green two-shard stage cover recorded before a hub restart still counts after it (test with two hub starts).
- [ ] C2. A stage QA verdict recorded after the restart is current when both covers exist (test).

## Comments

### coord · 2026-10-20T20:53:07.127Z

Update 2026-10-20 20:53Z: the loss was transient. Right after restart #35 (20:36Z) plan show reported 'stage cover missing Linux droplet' for all three stages and E-1006's QA verdict was recorded current:false; by 20:52Z the original sharded cover 918b2a95 counted again (E-789 closed on it, E-1006 re-evaluated to closed). The redundant rerun 571c4631 was cancelled. Remaining defect: for some minutes after a restart the hub reports a recorded sharded cover as missing, and a verdict recorded in that window is stored current:false; find whether covers load lazily after start and make plan show and verdict recording wait for or read the stored record.
