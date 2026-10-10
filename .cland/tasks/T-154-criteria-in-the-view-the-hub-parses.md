---
id: T-154
kind: task
title: "Criteria in the view: the hub parses Acceptance criteria into ids, text and marks, returned as criteria; legacy checkboxes read unmarked; hand edits keep ids and marks"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-112
blocked_by: []
topic: null
branch: null
created: 2026-10-10T07:49:35.981Z
updated: 2026-10-10T07:49:35.981Z
---

## Parent

T-112 (Criteria that live), slice 1 of 5. Spec §3.4 (Format, Migration).

## What to build

The hub parses `## Acceptance criteria` in an item file into structured criteria and returns them as `criteria` in `cland task view --json` and `task.view`: each has its id (`C1`, `C2`, …, or none yet), its text, and its marks (done, verified, failed, each with who, when and, for verified, the run; failed with its note), in the sub-item format §3.4 shows. Plain checkboxes from before read as criteria without ids or marks. Hand edits to the section are re-indexed and keep the ids and marks they have. Nothing writes to the section yet.

## Acceptance criteria

- [ ] `task view --json` and `task.view` return `criteria` for an item: ids, text and marks parsed from the §3.4 format; an item with no section returns an empty list.
- [ ] Legacy checkboxes read as criteria without ids or marks; a checked legacy box reads as unmarked, with its checkbox state kept.
- [ ] A hand edit of the section (reworded text, reordered items, a mark sub-item added by hand) is re-indexed, and ids and marks survive; a frame-protocol test edits a real item file.
- [ ] Malformed mark lines are kept verbatim and reported, not dropped.
- [ ] `hub/README.md` documents `criteria` in the view's JSON.
- [ ] `npm run typecheck && npm test` pass.

## Blocked by

None (can start immediately).
