---
id: T-84
kind: question
title: "Hierarchical multi-agent orchestration: prior art and failure modes"
state: open
labels:
  - wayfinder:research
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:38.764Z
updated: 2026-10-09T19:13:30.641Z
---

## Question

How do existing systems model a multi-level hierarchy of agents, how do work and results flow up and down it, how is escalation to the human done, what are the levels and roles called, which failure modes are documented, and which three candidate shapes would fit cland?

## Context

Systems to cover: MetaGPT, CrewAI's hierarchical process, AutoGen/AG2 group and nested chats, LangGraph supervisor and hierarchical teams, the OpenAI Agents SDK handoffs, the Claude Agent SDK and Claude Code subagents and teams, plus organisational research on span of control and reporting lines (the human's analogy: strategic command, regional commanders, task leads, reporting upward). The human wants a hierarchy that grows with the project and is configured, not hard-coded, and rejects taking military terms literally.

## Deliverable

`docs/research/hierarchy-prior-art.md` on branch `research/hierarchy-prior-art`: the patterns with their names, how each routes reports, questions and escalation, the documented failure modes (overloaded supervisors, context lost across levels, duplicated work, runaway cost) and their mitigations; then three candidate shapes for cland (flat as today, two-level, N-level configurable), each with the vocabulary it would need and its trade-offs. The ticket "Session hierarchy: levels, reporting, routing and names" starts from it.
