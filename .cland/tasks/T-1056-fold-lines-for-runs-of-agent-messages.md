---
id: T-1056
kind: task
title: Fold lines for runs of agent messages
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: null
branch: null
created: 2026-10-21T14:04:15.025Z
updated: 2026-10-21T14:04:15.025Z
---

## Summary

Fold a run of agent messages into one hub-built fold line made of facts, sent with the history pages and updated by a delta as the run grows.

## Parent

E-413 (§3.4 "The fold line"; tracer step 4).

## What to build

A run is consecutive agent-to-agent messages with nothing between them that never folds: an ask, a verdict, an answer, or anything to or from the human or an Aide (v0.1 §3.14). The hub gives each run an id and its first message number. Its fold line names the first three sessions and a count of the rest, the number of messages, the latest message's kind and first words, and its age. A model never writes it. The line comes with the history pages and in a delta each time the run grows. `nvim/lua/cland/thread.lua`'s folds define the run boundaries.

## Acceptance criteria

- [ ] C1. Four messages between a fake Implementer and a fake Reviewer arrive as one run whose fold line names both sessions, four messages, the latest step and its age (test).
- [ ] C2. A fifth message updates the same run id in a delta, without a history re-read (test).
- [ ] C3. An ask, a verdict, an answer, or a message to or from the human or an Aide ends a run, and the next agent message starts a new one (test).
- [ ] C4. A history page that starts mid-run carries that run's id and its full fold line (test).
- [ ] C5. `hub/README.md` describes runs and fold lines.
