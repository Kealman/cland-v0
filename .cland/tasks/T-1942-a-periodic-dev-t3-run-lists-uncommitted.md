---
id: T-1942
kind: task
title: A periodic dev T3 run lists uncommitted root files as its deciding files
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-17T10:51:04.585Z
updated: 2026-11-17T13:33:44.312Z
---

## Summary

Periodic dev T3 run 15938e48 at 9143ae841 (A-20847, 2026-11-17) reported deciding files that aren't part of that commit. They are .cland/RULES.md and seven tracker files, among them .cland/tasks/T-1941-…, which was created at 10:14Z, an hour after 9143ae841. They are the root checkout's uncommitted edits. The run is full regardless ("integrated dev always runs full"), so selection was unaffected. But the run's evidence names files outside the tested commit, against rule 43, and any selection-based run made the same way would be wrong.

## What to build

An integrated run computes and reports its deciding files from the tested commit against its base only, never from the root's working tree.

## Acceptance criteria

- [ ] C1. With a dirty root that has an uncommitted tracker edit, a dev integrated run at a commit reports deciding files from that commit's diff only (test).
- [ ] C2. Every reader of deciding files in integrated and batch runs is listed with its source of truth (rule 41).

## Comments

### coord · 2026-11-17T13:33:44.312Z

Second instance, 2026-11-17: periodic dev T3 832e3775 at 1f0c614 (A-20888) lists .cland/tasks/T-1945-… as a deciding file. T-1945 was created at 12:20Z and was still uncommitted in the root when the run started at 12:31Z, well after 1f0c614 (11:58Z).
