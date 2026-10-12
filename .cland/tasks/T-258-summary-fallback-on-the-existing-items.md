---
id: T-258
kind: question
title: Summary fallback on the existing items, and prior art for tree explorers with a detail pane
state: open
labels:
  - wayfinder:research
assignee: null
parent: T-264
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:10:35.385Z
updated: 2026-10-12T09:12:26.114Z
---

## Question

Two facts the explorer's design waits on.

1. How good is the summary fallback on the existing items (spec v0.1.2 §3.9: the first paragraph of the first section that is not Parent)? For every item in `.cland/tasks`, extract that paragraph, measure its length, and judge on a sample of forty across kinds whether it reads as a summary; report the share that needs a written `## Summary`, the edge cases by first heading (Question, Open question, What happened, Comments, Goal, What to build), and a better rule if one exists.
2. Prior art for keyboard tree explorers with a detail pane, in terminals and keyboard-first tools (neo-tree, oil.nvim, nvim-tree, taskwarrior-tui, org-mode agenda and outline folding, jira and Linear-style TUIs, lazygit's panels): how they fold, scope to a node, show counts per node, keep the cursor across updates, and lay out the detail pane; what to copy and what to avoid for an explorer in a Neovim buffer.

Deliver `docs/research/explorer-prior-art.md` with the extraction script beside it on the branch `research/explorer-prior-art` (pushed to origin only, never merged), and the resolution comment here.
