---
id: T-83
kind: question
title: What the harnesses offer for teams and sub-agents, and what the hub can see
state: open
labels:
  - wayfinder:research
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:38.000Z
updated: 2026-10-09T19:13:18.223Z
---

## Question

What do the three harnesses offer natively for one session to run or coordinate others, what of it is visible or controllable from outside the harness process, and where should the hub's hierarchy stop and the harness's own delegation begin?

## Context

For Claude Code (current release: agent teams and teammates, subagents, `claude agents --json`, hooks), Codex (current release: sub-agents and any multi-agent feature of the app-server protocol) and OpenCode (current release: subagents, sessions, its server API). The hub today sees only the session it launched; a session's in-harness sub-agents are invisible. The human wants, for some crews, one session that manages its own sub-agents over a group of items instead of one fresh session per item. Reuse `docs/research/harness-surfaces.md` on branch `research/harness-surfaces` for the baseline and version numbers.

## Deliverable

`docs/research/harness-teams.md` on branch `research/harness-teams`: a comparison table (feature, how it is started, what is observable from outside through process boundary, API, hooks or events, what it costs in context and tokens, whether the hub could launch, address or observe it); the versions tested; and a recommendation on the boundary between hub hierarchy and in-harness delegation. The ticket "Crew configuration and session reuse" starts from it.
