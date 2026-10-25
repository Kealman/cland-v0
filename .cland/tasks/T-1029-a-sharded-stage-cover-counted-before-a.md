---
id: T-1029
kind: task
title: A sharded stage cover counted before a hub restart is lost after it
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: topic-1061
branch: t/T-1029-a-sharded-stage-cover-counted-before-a
created: 2026-10-20T20:41:07.527Z
updated: 2026-10-25T17:16:37.438Z
---

## Summary

A sharded Linux stage cover counted before a hub restart is lost after it. Stage cover 918b2a95 (2 droplet shards, green, A-8040) completed at 20:35:16Z on 2026-10-20 and the hub reported "stage cover complete (Linux droplet, macOS)" at tree 60732b92; after hub restart #35 at 20:36Z, `task plan show` for E-1006, E-789 and E-412 reports "stage cover missing Linux droplet" at the same tree, while the unsharded macOS cover 53af0d11 is still counted. QA's stage verdict for E-1006 was then recorded current:false and the stage stayed open, so the Linux cover had to run again (about 30 minutes and a droplet pair).

## What to build

Persist the merged result of a sharded close run (stage, epic, release) as a durable cover record at completion, as for unsharded runs, and restore it on hub start. Check whether T-1025's cover/receipt changes (Web phase fields) affect how stored receipts are read back.

## Acceptance criteria

- [x] C1. A green two-shard stage cover recorded before a hub restart still counts after it (test with two hub starts).
  - done: impl-1029 · 2026-10-25T17:16:21.456Z
- [x] C2. A stage QA verdict recorded after the restart is current when both covers exist (test).
  - done: impl-1029 · 2026-10-25T17:16:21.533Z

## Comments

### coord · 2026-10-20T20:53:07.127Z

Update 2026-10-20 20:53Z: the loss was transient. Right after restart #35 (20:36Z) plan show reported 'stage cover missing Linux droplet' for all three stages and E-1006's QA verdict was recorded current:false; by 20:52Z the original sharded cover 918b2a95 counted again (E-789 closed on it, E-1006 re-evaluated to closed). The redundant rerun 571c4631 was cancelled. Remaining defect: for some minutes after a restart the hub reports a recorded sharded cover as missing, and a verdict recorded in that window is stored current:false; find whether covers load lazily after start and make plan show and verdict recording wait for or read the stored record.

### impl-1029 · 2026-10-25T17:11:41.834Z

Diagnosis: clean inherited worktree at 871fc363. Triaged lines synchronously restore suite-job history; T-1049 (7c153e51) already added pending ancestry handling and two-hub-start seeded cover coverage. Adding a live two-shard completion/recovery regression to distinguish an actual persistence defect from this earlier fixed tracker freshness defect. No shared wire/schema/permission change planned.

### impl-1029 · 2026-10-25T17:16:21.400Z

C1/C2 are covered by two new T2 regressions. Unchanged product code already passes; T-1049 (7c153e51) fixed pending restored cover/QA currency. A-12042 records the diagnosis, red mutation controls and excluded exploratory results. Local macOS at base 871fc363 + test diff: suite-close-component.test.ts 12/12 (new restart case 0.704 s; final bounded-setup repeat 1.000 s); stage-closure-component.test.ts 7/7 (new post-restart QA case 0.211 s); root npm run typecheck and closed-item wording lint pass. No browser, native worker or real provider ran. No command/policy/schema/wire/permission changes: rule 16 public docs/help/skill/role behavior remains accurate; file-specific test guidance added. QA policy none after-stage, no per-item QA brief required. Source review and mode-free Linux verification remain.
