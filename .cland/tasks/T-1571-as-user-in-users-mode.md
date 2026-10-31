---
id: T-1571
kind: task
title: "`--as <user>` in users mode"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1562
topic: null
branch: null
created: 2026-10-31T23:47:53.293Z
updated: 2026-10-31T23:47:58.528Z
---

## Summary

In users mode the CLI's `--as` on `cland topic answer`, `topic create` and `topic send` must name an existing active user. The request is then recorded as that user's, and the acting user must be an admin, which every user is for now. In single mode `--as` keeps its stand-in meaning. A launched session's shell still cannot act as a person.

Hot files: `hub/src/cli/inbox.ts`, `hub/src/cli/actor.ts`, `shared/frame-actor.ts`, `hub/src/hub/dispatch.ts` [Host] (`topic.answer`, `topic.create`, `topic.send` stand-in handling), `hub/src/cli/usage/topic.ts`.

## Acceptance criteria

- [ ] C1. In users mode `cland topic answer <ask> 1 --as <user>` records that user as the answerer in the outcome and the journal.
- [ ] C2. `--as` naming an unknown or invited-only user is refused with a message naming the user.
- [ ] C3. Without `--as` the CLI's request is recorded as the first user's.
- [ ] C4. In single mode `--as <stand-in name>` records a stand-in answer exactly as today.
- [ ] C5. A shell with `CLAND_SESSION_*` set still acts as its session whatever `--as` says.
