---
id: T-130
kind: release
version: 0.1.0
title: "Release: v0.1"
state: open
labels:
  - v0.1
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-09T23:02:37.189Z
updated: 2026-10-09T23:02:37.189Z
---

## Goal

v0.1 makes cland scale past one Coordinator over a flat crew and makes the workbench show less at once: a release above epics, explicit item status and order, a session hierarchy with crew configuration and event subscriptions, an epic plan, visibility levels, a session for the human, and the panel, palette, thread and graph work the v0 run asked for.

## Notes

Everything in docs/spec/v0.1.md section 3 is in v0.1; nothing is deferred. The release covers eleven epics: release and status; a quiet Coordinator; workbench basics; threads that read; the human's own session; criteria that live; leads and the crew; the epic plan; visibility and artifacts; the task graph; and release from the item.

Two lanes run in parallel: the hub lane 1 → 2 → 6 → 7 → 8 → 11 and the Neovim lane 3 → 4 → 5 → 10 → 9. Epic 5 also waits for 2; epic 11 waits for every other. The blocking edges stay on the epics.

The build uses what it has shipped: the release item first, item leads after epic 2, an Aide after epic 5, crew.toml after epic 7, and the epic plan for epics 8 to 11 after epic 8. The v0 tail is not a prerequisite and stays unscheduled.

Done means the human has run each epic's demo on v0.1; v0.1.0 ships with cland release --item, using this item's notes and its epics; and the run retrospective is an artifact.
