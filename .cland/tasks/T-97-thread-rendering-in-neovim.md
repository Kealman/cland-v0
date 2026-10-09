---
id: T-97
kind: question
title: Thread rendering in Neovim
state: open
labels:
  - wayfinder:prototype
assignee: null
parent: T-81
blocked_by:
  - T-86
  - T-94
topic: null
branch: null
created: 2026-10-09T19:09:49.140Z
updated: 2026-10-09T19:10:31.841Z
---

## Question

How should a topic thread render in the workbench so that it reads better than the harnesses' own TUIs: what the human reacts to in a prototype built on real history?

## Context

Threads are plain text today: author line, body without Markdown, one blank line between messages, no rules, no dates; the human found them a wall of white text and sat in the Coordinator's TUI, which has colours and typography. The research "Neovim rendering techniques for the thread and a task graph" lists what is feasible without plugins; the visibility levels decision says which messages fold (agent-to-agent traffic) and which stand out (asks, verdicts, messages to the human).

## Prototype

First a mockup on the design canvas (one artboard: a General thread with a mix of human, Coordinator, agent-to-agent and verdict messages, an ask, an artifact chip). Then branch `prototype/thread` (never merged): the thread view rendering real `history` of General with author bands or gutters per role colour, Markdown with conceal, separators and dates, folded agent-to-agent messages, chips and the composer. The human reads real history in it and says what works.

Resolve with the human's reaction: the thread section of the spec (what renders how, what folds, the keys), recorded as a comment with the branch and canvas links.
