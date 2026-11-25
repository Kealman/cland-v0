---
id: T-2101
kind: task
title: Historical lead-handover-process failure (15.8 s Linux assertion, then a 2,040 s silent file hang in run a8ab9e8f) is still unattributed after T-2060
state: open
status: backlog
size: S
labels:
  - needs-info
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-25T04:37:32.483Z
updated: 2026-11-25T04:37:32.483Z
---

## Summary

This is a follow-up from T-2060's final review (rev-41, A-23256). The original Linux failure in hub/test/lead-handover-process.test.ts was a 15.8 s assertion, then a 2,040 s silent file hang, in run a8ab9e8f at tree 2e78d9b97 (evidence A-22615 and A-22619). It was never reproduced. T-2060 found and fixed a real wait race: a crash wait using `kill(pid, 0)` never saw an exited-but-unreaped child. It also bounded owned failure cleanup, and its Linux verify ran the real unreaped-child control. But it couldn't show that this race caused the historical failure.

## What to build

Nothing until it recurs. If lead-handover-process fails or hangs again on any Linux run after T-2060 has landed, attach that run here and diagnose it from the new, bounded diagnostics. Close this item if 20 integrated Linux runs after T-2060's landing pass this file.

## Acceptance criteria

- [ ] C1. Either a post-T-2060 recurrence is diagnosed with its cause named, or 20 integrated Linux runs after T-2060's landing pass this file and the item closes as not reproduced (evidence).
