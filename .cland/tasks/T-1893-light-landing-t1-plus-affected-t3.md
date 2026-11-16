---
id: T-1893
kind: task
title: "Light landing: T1 plus affected T3"
state: open
status: backlog
size: M
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1528
  - T-1582
topic: null
branch: null
created: 2026-11-16T07:29:45.541Z
updated: 2026-11-16T07:29:48.067Z
---

## Summary

After T-1528's report, a batch runs T1 plus the T3 files that import the members' changed modules. A full-T3 batch runs when 3 or more members wait, or for hub-behaviour diffs. Merges impl #1 and §7 #6 option 3.

Kind: product + config. Triage ticket H-5 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes rule 6 (T1+T3 batch as the pre-merge full suite; ask 31d43750, Discord 11-02) and `merge.batch_tiers`, `merge.batch`, `merge.batch_wait`. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [ ] C1. T-1528's replay shows which v0.4.0 T3-only red batches (T-1819, T-1666, T-1553, T-1644) the importer selection catches and which it misses (evidence).
- [ ] C2. An affected-T3 batch runs T1 and only the importer T3 files, and a batch of 3 or more members or with a hub-behaviour member runs the full T3 (test).
- [ ] C3. T-1582's per-tier baseline holds for partial-T3 batches (test).

## Dependencies

T-1528, T-1582
