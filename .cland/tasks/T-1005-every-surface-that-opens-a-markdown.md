---
id: T-1005
kind: task
title: Every surface that opens a Markdown artifact renders it
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by:
  - T-796
topic: null
branch: null
created: 2026-10-20T16:58:42.045Z
updated: 2026-10-20T16:58:55.656Z
---

## Summary

Rendering applies wherever a Markdown artifact opens: folder entry files and children from the artifacts browser, and the palette's `CTRL-v` split beside the centre. Prompt drafts open raw, and sending a prompt always sends the saved source text.

## What to build

The human opens `ideas.md` inside a folder artifact from the browser and it renders, with the same toggle. From the palette, `CTRL-v` on a note opens it rendered beside the thread, and it toggles independently of the centre. A prompt draft opens in the raw editable buffer, as today, and `␣ps` and `␣pa` send exactly what was saved (Coordinator decision, 2026-10-20). Following links in a rendered artifact is out of scope.

## Acceptance criteria

- [ ] C1. A `.md` file inside a folder artifact, and a folder's entry file, opened from the artifacts browser render and toggle to raw, proved by a T2 component test.
- [ ] C2. A Markdown artifact opened with `CTRL-v` from the palette renders in its split and toggles independently of the centre, proved by a T2 test.
- [ ] C3. A prompt draft opens raw, and `␣ps` and `␣pa` send the saved source bytes, proved by a T2 recorded-frames test.
- [ ] C4. A headless-grid case ARTIFACT-002 opens a folder child and a palette split rendered, and reads both from the grid.
