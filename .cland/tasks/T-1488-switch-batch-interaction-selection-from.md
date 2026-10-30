---
id: T-1488
kind: task
title: Switch batch interaction selection from report to run, on recorded batch evidence
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-30T14:25:54.233Z
updated: 2026-10-30T14:25:54.233Z
---

## Summary

T-1454 widens merge-batch test selection by importer interaction, but it ships the batch side in report mode (`[merge] batch_interaction = \"report\"`), because a typical hub change adds about 290 T2 and Web files to a T1-only batch (store.ts adds 294, a Codex adapter change 292, cli/usage.ts 40; measured 2026-10-30). This item switches batches to run mode, or narrows it, based on the recorded batch lines.

## Acceptance criteria

- [ ] C1. One artifact summarises at least a day of recorded batch lines (added files and phases per batch, projected extra wall time, and any landing a later run found broken that the additions would have caught), and the item records a decision between `run`, a narrower rule, or keeping `report`, with that evidence.
