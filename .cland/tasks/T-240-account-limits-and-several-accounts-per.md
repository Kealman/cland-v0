---
id: T-240
kind: task
title: Account limits and several accounts per harness
state: open
status: backlog
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:01.590Z
updated: 2026-10-11T17:49:01.711Z
---

## Open question

The human wants to see each account's current subscription limits (weekly limits, how much is used, when they reset) and to configure several accounts per harness, for example several CLAUDE_CONFIG_DIRs, used per role, per session or round-robin (observation 5). Needs research into which harnesses expose limits and how each selects an account. Relates to spec §3.8 and roles.toml launch defaults.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.
