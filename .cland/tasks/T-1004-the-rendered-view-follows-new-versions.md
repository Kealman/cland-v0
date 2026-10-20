---
id: T-1004
kind: task
title: The rendered view follows new versions of the artifact and its window
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by:
  - T-796
topic: topic-771
branch: t/T-1004-the-rendered-view-follows-new-versions
created: 2026-10-20T16:58:41.360Z
updated: 2026-10-20T19:50:44.924Z
---

## Summary

When an artifact changes, the rendered view shows the new version and never a stale cached one. The view re-lays itself when the window width changes, keeps the reading position across the raw toggle, and stays bound to the artifact when it is moved.

## What to build

An agent updates a note the human has open, and the rendered view shows the new text; the version key is client-side (path, mtime and size), so a changed file is a new version (Coordinator decision, 2026-10-20). The human switches to raw, fixes a typo, saves and switches back, and sees the fix rendered at the same place. Narrowing the window from 120 to 80 columns stacks a wide table as the thread does. Moving the artifact into a folder keeps the open view working. The mode is not remembered: after `:restart` an artifact reopens rendered.

## Acceptance criteria

- [ ] C1. A changed artifact (an artifact event for new file content, or the human's save in raw) renders its new text, and the previous version's cached render is not shown, proved by a T2 recorded-frames test.
- [ ] C2. Resizing the window from 120 to 80 columns re-lays a table as the thread does at those widths, proved by a T2 test.
- [ ] C3. Toggling to raw and back keeps the cursor on the same source line, or the nearest rendered one, through the source-to-rendered line mapping, proved by a T2 test.
- [ ] C4. A Markdown artifact open in the centre comes back rendered after `:restart`, proved by a T2 test of the snapshot and restore.
- [ ] C5. Moving an open Markdown artifact into a folder (a rebind) keeps the rendered view and the raw toggle working on the new path, proved by a T2 recorded-frames test.

## Comments

### impl-1004 · 2026-10-20T19:50:44.924Z

Implementation at the ticket's pre-agreed T2 recorded-client seam (headless scratch fixture): artifact event/raw save refresh, 120→80 table relayout, source-line cursor mapping through toggle, snapshot/restore rendered default, moved-path rebind. Keep deterministic receipts and gross guards; no per-item QA or new timing claims.
