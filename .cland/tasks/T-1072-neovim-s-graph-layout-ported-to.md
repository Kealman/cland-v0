---
id: T-1072
kind: task
title: Neovim's graph layout ported to TypeScript under a differential test
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by: []
topic: null
branch: null
created: 2026-10-21T17:32:16.423Z
updated: 2026-10-21T17:32:22.320Z
---

## Summary

Port Neovim's layered graph layout (`nvim/lua/cland/graph_layout.lua`) to TypeScript under a differential test against the Lua. This is the largest piece of E-416, split out ahead of the Graph view.

## Parent

E-416 (Graph view choices; tracer step 5, first half).

## What to build

A pure TypeScript layout module in `web/` with no layout library. It produces the same layers, order and edge routes as the Lua for the same input. A differential test drives the Lua through headless Neovim on the QA graph fixture (`qa/cases/GRAPH-001.items.json`) and on a copy of the live tracker, and compares the outputs.

## Acceptance criteria

- [ ] C1. The differential test reports zero differences between the TypeScript and Lua layouts on `qa/cases/GRAPH-001.items.json` (test).
- [ ] C2. The same test reports zero differences on every epic and release of a copy of the live tracker (test).
- [ ] C3. The module has no new dependency and no DOM access (lint or test).
