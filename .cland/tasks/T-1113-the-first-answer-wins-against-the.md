---
id: T-1113
kind: task
title: The first answer wins against the harness and across hub restarts
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1111
  - T-1112
topic: topic-888
branch: t/T-1113-the-first-answer-wins-against-the
created: 2026-10-22T15:16:11.772Z
updated: 2026-10-23T02:21:24.881Z
---

## Summary

Make the gate hold when the harness's own TUI answers while a hub answer is on its way, and rebuild pending records with their ids after a hub restart, so no approval is lost to a restart.

## Parent

E-414 (§3.4 "One gate for answers"; "Losing the race" and "Restarts"; tracer step 4).

## What to build

A harness can resolve a request while the hub's answer is on its way: an attached TUI answered first, or the harness withdrew the request. Then exactly one outcome is recorded, the harness's. The human's answer is refused with who answered and when, and no client reads the hub's choice as the outcome. A Deny that loses this race never ends as an approval.

When the hub restarts, the records of pending requests come back with the same ids as each adapter reconnects: from Codex's replay of pending requests, from OpenCode's snapshot of pending permissions, and from Claude Code's waiting state. A request answered in the harness while the hub was down reads as closed with the harness's outcome. An answer given after the restart reaches the harness. Closed records keep their outcomes in the inbox archive.

## Acceptance criteria

- [ ] C1. When another client resolves a Codex request while the hub's Deny to it is in flight, only the harness's outcome is recorded, and the human's answer is refused naming the harness (test).
- [ ] C2. When an OpenCode reply is refused as not found because the TUI answered first, the record closes with the TUI's reply, never with the hub's choice (test).
- [ ] C3. A hub restarted with one pending Codex request, one OpenCode request and one Claude Code request serves the three records with their ids, and an Approve once after the restart reaches the Codex request (test).
- [ ] C4. After a restart, a request answered in the harness while the hub was down reads as closed with the harness's outcome (test).
- [ ] C5. A closed record's outcome is in the inbox archive after a restart (test).
- [ ] C6. `hub/README.md` describes the race with a harness's TUI and how records are rebuilt after a restart (docs).
