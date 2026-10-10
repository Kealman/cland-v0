---
id: T-160
kind: task
title: "The graph view: ␣G and :Cland graph, the release's open containers as parents with p and P, nodes on the hub's status, claims, verdicts and criteria, the tray"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by:
  - T-159
topic: null
branch: null
created: 2026-10-10T07:49:36.565Z
updated: 2026-10-10T07:49:36.565Z
---

## Parent

T-116 (The task graph), slice 2 of 5.

## What to build

The graph view: `␣G` and `:Cland graph [T-n]` open a centre view that lays out an open container's children with the T-159 layout. The parent is an open container of the current release, cycled with `p` and `P`. Nodes carry the hub's status, the blocked mark ◌, the title, the ask badge, the claim, the latest verdict and verified/total (from the criteria once T-112 lands, the checkbox count until then, behind one replaceable function). Done items are dimmed and folded in the tray (`d`). The board stays as it is on `␣b`. Per T-98, the graph is an experimental extra view.

## Acceptance criteria

- [ ] `␣G` and `:Cland graph [T-n]` open the graph of the current release's first open container, or of T-n.
- [ ] `p` and `P` cycle the parent among the release's open containers.
- [ ] Nodes show status, ◌ blocked, title, ask badge, claim, latest verdict and verified/total from the hub's index, never the item files.
- [ ] Done items are dimmed and folded in the tray; `d` unfolds them.
- [ ] Demo: `␣G` shows the first v0.1 epic as a graph; a headless test drives it on the stub hub.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-159 (The graph layout)
