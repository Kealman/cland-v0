---
id: T-1053
kind: task
title: Unread counts with every message delta and one merged sessions projection
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: null
branch: t/T-1053-unread-counts-with-every-message-delta
created: 2026-10-21T14:04:14.662Z
updated: 2026-10-21T14:04:38.377Z
---

## Summary

Send a topic's unread count and last message time with every message delta, and give clients one merged sessions projection.

## Parent

E-413 (§3.3 "Unread counts" and "Merged session rows"; tracer step 2).

## What to build

A topic's `unread` (per human) and `lastMessageAt` travel with every message delta, so no client counts `message` frames. Sessions arrive as one projection per row: the process row with presence, the role, the item (a verifier's hold with +N, or a requested item marked as requested, per v0.1.2 §3.4), the state with its age and the command it waits on, the account and the usage. The two reads clients merge today (processes and presence) stay available for compatibility.

## Acceptance criteria

- [ ] C1. A frame client's unread count and last message time for a topic follow three new messages from the deltas alone, and a `topic.read` resets the count (test).
- [ ] C2. A verifier's merged session row carries its hold with +N, a waiting row carries its state age and the command it waits on, and a row carries account and usage (test).
- [ ] C3. A presence or process change produces one merged row delta, not two partial ones (test).
- [ ] C4. `hub/README.md` describes `unread`, `lastMessageAt` and the sessions projection.
