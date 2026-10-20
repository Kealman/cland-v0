---
id: E-795
kind: epic
title: Rendered Markdown artifacts in the Neovim workbench
state: open
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-18T10:14:36.459Z
updated: 2026-10-20T16:51:49.891Z
---

## Summary

The human, 2026-10-18 10:14Z in General: an opened artifact shows raw Markdown and is hard to read, so artifacts should render properly in v0.2. Today `nvim/lua/cland/artifacts.lua` only sets `filetype = markdown`, so syntax colours apply but every `#`, `**`, backtick and bracket stays visible. Thread messages already render through `thread_md.lua` (T-133): concealed heading markers, code chips and bands, bullets as `•`, link styling and quotes. The web workbench (E-418, spec v0.2 §3) renders artifacts on its own.

## Definition of done

- [ ] D1. A Markdown artifact opened in the workbench renders like a thread message (headings, emphasis, inline and fenced code, lists, links, quotes, tables readable), with a key that toggles the raw source.
- [ ] D2. Long artifacts open and scroll without a visible delay. Rendering is cached per artifact version and never blocks the UI.
- [ ] D3. Headless-grid cases cover a rendered artifact and the raw toggle.
