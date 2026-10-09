---
id: T-86
kind: question
title: Neovim rendering techniques for the thread and a task graph
state: open
labels:
  - wayfinder:research
assignee: null
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:40.428Z
updated: 2026-10-09T19:09:40.428Z
---

## Question

With Neovim 0.12 and no plugins, which techniques render a readable chat thread and a dependency graph in a buffer, what are their limits, and what should the two prototypes try first?

## Context

Threads today are plain text: one blank line between messages, no Markdown, no rules, no dates; the human found them a wall of white text and sat in the Coordinator's TUI instead. The board proved less useful than the items panel; the human wants a graph of an epic's items (what follows what, what runs in parallel) scrollable in both axes. Techniques to verify: `line_hl_group` and `hl_eol` extmarks for message bands and author gutters; virtual lines for separators and dates; tree-sitter Markdown with conceal for headings, code blocks, lists and links (what `render-markdown.nvim`-style rendering needs, what breaks on narrow widths); folds for long or agent-to-agent messages; `winhighlight` per window; for the graph, layered DAG layout in text (what `git log --graph` and dagre-style layering do), box-drawing versus ASCII, lanes for parallel items, horizontal scrolling, a cursor on a node with `gi`, `gt`, `gs`.

## Deliverable

`docs/research/nvim-rendering.md` on branch `research/nvim-rendering`: each technique with a minimal Lua snippet verified in headless Neovim (`nvim --clean -u`), what it can and cannot do, and a first-try list for the prototypes "Thread rendering in Neovim" and "Task graph view in Neovim".
