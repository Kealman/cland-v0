---
id: T-1053
kind: task
title: Unread counts with every message delta and one merged sessions projection
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-806
branch: t/T-1053-unread-counts-with-every-message-delta
created: 2026-10-21T14:04:14.662Z
updated: 2026-10-21T14:15:33.301Z
---

## Summary

Send a topic's unread count and last message time with every message delta, and give clients one merged sessions projection.

## Parent

E-413 (§3.3 "Unread counts" and "Merged session rows"; tracer step 2).

## What to build

A topic's `unread` (per human) and `lastMessageAt` travel with every message delta, so no client counts `message` frames. Sessions arrive as one projection per row: the process row with presence, the role, the item (a verifier's hold with +N, or a requested item marked as requested, per v0.1.2 §3.4), the state with its age and the command it waits on, the account and the usage. The two reads clients merge today (processes and presence) stay available for compatibility.

## Acceptance criteria

- [x] C1. A frame client's unread count and last message time for a topic follow three new messages from the deltas alone, and a `topic.read` resets the count (test).
  - done: impl-1053 · 2026-10-21T14:14:58.077Z
- [x] C2. A verifier's merged session row carries its hold with +N, a waiting row carries its state age and the command it waits on, and a row carries account and usage (test).
  - done: impl-1053 · 2026-10-21T14:14:58.105Z
- [x] C3. A presence or process change produces one merged row delta, not two partial ones (test).
  - done: impl-1053 · 2026-10-21T14:14:58.135Z
- [x] C4. `hub/README.md` describes `unread`, `lastMessageAt` and the sessions projection.
  - done: impl-1053 · 2026-10-21T14:14:58.169Z

## Comments

### impl-1053 · 2026-10-21T14:14:49.358Z

Implemented the additive topic fields and merged session projection. TDD at the agreed T2 frame seam: unread started red (undefined !== 1), merged rows started red (snapshot supplies complete session rows), and snapshot-only subscribers started red (no session.row received), then each passed after implementation. New tests cover authoritative counts/times/read resets; verifier holds/+N and pending work; waiting command/state age; a named account and usage; one complete row per presence/process/hold change; fresh-snapshot equivalence; rename, disconnect and unknown-identity removals. Legacy process and presence reads/events retained. origin/dev merged before first review; reviewed candidate head will be b3ce2e336adb07c23ed33143e65a2314f1128f70. Per-item QA is not required (affected after-stage policy; no QA brief supplied).
