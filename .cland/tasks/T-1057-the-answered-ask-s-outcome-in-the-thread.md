---
id: T-1057
kind: task
title: The answered ask's outcome in the thread and the inbox departure
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-836
branch: t/T-1057-the-answered-ask-s-outcome-in-the-thread
created: 2026-10-21T14:04:15.186Z
updated: 2026-10-22T06:42:05.247Z
---

## Summary

Carry an answered ask's outcome into its thread and into the inbox's departure, so a client folds it in place to one line.

## Parent

E-413 (§3.4 "The answered ask" and "The inbox's leave rule, refined"; tracer step 4).

## What to build

An ask's record carries its outcome for good: the option or the free answer, who answered and when. The thread shows it, and the inbox's departure reports the row as `answered` with that outcome. How long a client keeps the folded row is the client's choice; the hub reports the outcome.

## Acceptance criteria

- [x] C1. Answering an ask with an option makes its thread entry carry the option, the answerer and the time, also on a later history read (test).
  - done: impl-1057 · 2026-10-22T06:41:24.439Z
- [x] C2. The inbox's departure for that row says `answered` with the same outcome (test).
  - done: impl-1057 · 2026-10-22T06:41:24.527Z
- [x] C3. A free-text answer is carried the same way (test).
  - done: impl-1057 · 2026-10-22T06:41:24.691Z
- [x] C4. `hub/README.md` describes the outcome fields and the departure.
  - done: impl-1057 · 2026-10-22T06:41:24.764Z

## Comments

### impl-1057 · 2026-10-22T06:41:18.051Z

Implemented durable AskCard.outcome {status, text, option?, by, at}, with a declined/reason union variant reserved for T-1059. Inbox departures persist the identical outcome, publish pending departures on the next coalesced event, and retain them in archive reads across restart. Added three criterion-level T2 public-frame tests with disposable projectHub/FakeClock; C1 and C2 observed missing-field red assertions before their implementation; C3 exercises the shared path for multiline text and stand-in attribution. Targeted Darwin arm64 checks: ask-outcomes 3/3, asks 11/11, inbox-actions 5/5, ask-chain 13/13; root typecheck passed; test lint report mode has zero refusals. No Linux or full-suite receipt yet. README and test guidance updated. Proposed durable-outcome retention rule to the supervising lead in the item topic.
