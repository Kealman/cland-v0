---
id: T-1054
kind: task
title: Last looks and read marks per human in the hub, with Neovim moved onto them
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-835
branch: t/T-1054-last-looks-and-read-marks-per-human-in
created: 2026-10-21T14:04:14.830Z
updated: 2026-10-22T06:52:24.954Z
---

## Summary

Hold the events' last look, each plan's last look and the topics' read marks in the hub per human, and move Neovim onto them with a one-time import from `ui.json`.

## Parent

E-413 (§3.6 marks; §3.3 "The last look and the read marks per human"; tracer step 3).

## What to build

The hub stores the marks per human, not per client. A mark only moves forward, and the latest from any client wins. Clients read the marks with the snapshot, set them through frames, and receive changes as deltas. Neovim reads and sets its events' last look and its plans' marks through the hub. On first start after this change, it imports the values `ui.json` holds once, never losing the human's current last look. `ui.json` keeps only interface state (filters, folds, the current release); pins and mutes stay where they are. What counts as read stays the client's act (`topic.read` up to a message number); the hub keeps the highest mark.

## Acceptance criteria

- [x] C1. A mark set by one frame client is read by a second client, and an older mark sent later does not move it back (test).
  - done: impl-1054 · 2026-10-22T06:52:13.683Z
- [x] C2. Opening the events view in a headless Neovim workbench sets the events' last look that a frame client then reads, and a topic marked read by a frame client reads as read in Neovim (test).
  - done: impl-1054 · 2026-10-22T06:52:13.782Z
- [x] C3. A Neovim start with the last look and plan marks present in `ui.json` and absent in the hub imports them once; a second start does not re-import, and `ui.json` no longer carries them (test).
  - done: impl-1054 · 2026-10-22T06:52:13.855Z
- [x] C4. Marks survive a hub restart (test).
  - done: impl-1054 · 2026-10-22T06:52:13.925Z
- [x] C5. `hub/README.md` and `nvim/README.md` describe the marks and the import.
  - done: impl-1054 · 2026-10-22T06:52:14.096Z

## Comments

### impl-1054 · 2026-10-22T06:35:51.684Z

Criterion-first seams confirmed by launch brief and E-413: real frame clients for C1/C4 (projectHub reopen for persistence), recorded headless Neovim plus scripted frame peer for C2/C3. Proposed model preserves events ISO timestamps and compares plan receipt IDs by the hub's publication order, never by UUID or timestamp. Legacy keys remain on disk until the durable import reply.

### impl-1054 · 2026-10-22T06:52:14.235Z

Implemented and pushed 8830d1f6/tree2f97fbe6, merged origin/dev6e797f08 before first review. C1–C5 done. A-8981 holds raw local Darwin arm64 targeted evidence: root check0, lint report-only132/59 with0refusals; 77/77 tests, zero skips across12files. Changed-consumer recordings refreshed only; native plan/restart5 and live protocol guard1 are targeted T3, not integrated suite evidence. C4 reopens projectHub in-process per persistence-test policy. Source review requested before mode-free configured-executor verification; QA is after-stage.
