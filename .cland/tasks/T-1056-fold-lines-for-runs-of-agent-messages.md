---
id: T-1056
kind: task
title: Fold lines for runs of agent messages
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-837
branch: t/T-1056-fold-lines-for-runs-of-agent-messages
created: 2026-10-21T14:04:15.025Z
updated: 2026-10-22T06:42:07.048Z
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

## Comments

### impl-1056 · 2026-10-22T06:42:07.048Z

TDD at the brief's agreed T2 history/live-frame seams: C1 red was `one full run accompanies history: undefined !== 1`; C2 red was `the message delta carries the updated full run` (undefined); C3 red was a verdict incorrectly retaining a run id. Current four criterion tests pass locally on Darwin arm64 (~0.73 s file): complete factual line, same-id fifth-message delta, ask/verdict/answer/human/Aide boundaries plus midnight, and numeric/message-id mid-run pages with full metadata including first-three/+N. C4 passes using the existing full-run projection; no new reread behavior was needed. Persistence/legacy/byte-bound checks and docs are in progress; this is targeted development evidence, not queued verification.
