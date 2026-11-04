---
id: T-1681
kind: task
title: Validate against the real Claude Code binary that it starts no new turn or mod hooks after SIGTERM beyond SessionEnd
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-04T17:37:23.637Z
updated: 2026-11-04T17:37:23.637Z
---

## Summary

T-1678 made remote Claude stop root-first: TERM the pinned root, then converge on its descendants. Its native tests run against a scripted fake that shuts down gracefully (coord decision 9aac13d3). The assumption that real Claude Code starts no new turn hooks or mod posts after SIGTERM, beyond SessionEnd, and that its native writers close, is recorded in `docs/agents/host-agent.md` but not verified against the real binary. If it's false, stop ends `cleanup-incomplete` with the row held, which is safe but needs a manual re-stop.

## What to build

A QA check against the real Claude Code binary, in an authorised account under a QA grant from the human. Start a session, stop it mid-turn and right after a turn, and record whether any non-SessionEnd hook or mod post starts after TERM, and whether the stop completes without a manual re-stop. Record the binary version.

## Acceptance criteria

- [ ] C1. A recorded real-binary receipt (version, the timeline of hooks around TERM) confirms or refutes the assumption (evidence).
- [ ] C2. If it's refuted, a follow-up item is filed with the observed hook timeline (evidence).
