---
id: T-1681
kind: task
title: Validate against the real Claude Code binary that it starts no new turn or mod hooks after SIGTERM beyond SessionEnd
state: open
status: backlog
size: S
labels: []
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-04T17:37:23.637Z
updated: 2026-11-20T02:53:23.802Z
---

## Summary

T-1678 made remote Claude stop root-first: TERM the pinned root, then converge on its descendants. Its native tests run against a scripted fake that shuts down gracefully (coord decision 9aac13d3). The assumption that real Claude Code starts no new turn hooks or mod posts after SIGTERM, beyond SessionEnd, and that its native writers close, is recorded in `docs/agents/host-agent.md` but not verified against the real binary. If it's false, stop ends `cleanup-incomplete` with the row held, which is safe but needs a manual re-stop.

## What to build

A QA check against the real Claude Code binary, in an authorised account under a QA grant from the human. Start a session, stop it mid-turn and right after a turn, and record whether any non-SessionEnd hook or mod post starts after TERM, and whether the stop completes without a manual re-stop. Record the binary version.

## Acceptance criteria

- [ ] C1. A recorded real-binary receipt (version, the timeline of hooks around TERM) confirms or refutes the assumption (evidence).
- [ ] C2. If it's refuted, a follow-up item is filed with the observed hook timeline (evidence).

## Comments

### coord · 2026-11-16T07:30:04.637Z

The human decided on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813): one short, sealed real-binary QA run, late in 0.4.1 (E-1885), under the human's grant. If it refutes the expectation, a follow-up is filed. The current behaviour is safe, because the row stays held.

### coord · 2026-11-20T02:53:15.942Z

Deferred out of 0.4.1 by the human on 2026-11-20 ("1681 отложи пока", answer to ask b46c12fa): it needs the real Claude Code binary in an authorised account under a QA grant. Moved to Follow-ups (C-326) and removed from E-1885 stage 2.
