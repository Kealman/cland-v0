---
id: T-1412
kind: task
title: "A restart within the resume window resumes: messages typed meanwhile arrive late, and only the pressed cards are re-sent"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1403
  - T-1411
topic: null
branch: null
created: 2026-10-27T23:38:48.333Z
updated: 2026-10-27T23:38:48.333Z
---

## Summary

A hub stop closes the socket resumably and keeps the session in `hub.db`, and the next start resumes. The replay brings the messages typed meanwhile, which reach General marked late. It also brings the clicks made meanwhile, which came too late to answer, so only their cards are re-sent at the bottom. Disabling Discord ends the session cleanly.

## What to build

**Stopping and starting.** `stop()` closes with code 4000 and persists the session id, the resume URL, the last sequence and the stop time under the `discord` messenger. Disabling the remote through configuration closes with 1000 and forgets the session. A start with a stored session sends RESUME first (08's rule); a refused resume falls through to ticket 18.

**Replayed messages.** Between RESUME and RESUMED, a replayed MESSAGE_CREATE that passes 05's checks reaches General with "(written on Discord at HH:MM; the hub was down until HH:MM)".

**Replayed clicks.** A replayed component INTERACTION_CREATE is never answered and never answers an ask. Its card is re-sent at the bottom with "a button pressed then may have been lost; press again", and its old copy is edited to "↓ Re-sent below" without buttons. Cards not pressed meanwhile stay as they are. Replayed command interactions are dropped.

Every replayed event is deduplicated by id against what was handled before the stop.

Spec §3.8 (resume), §3.9 (catch-up order, hub restarts); Q-1293 (resumed after 60 and 90 seconds, refused after 120).

## Acceptance criteria

- [ ] C1. A hub stop closes the socket with a code other than 1000, and a start 30 seconds later resumes with no identify on the fake (test).
- [ ] C2. A message typed during a 30-second restart reaches General once, marked with the time it was written and the time the hub came back (test).
- [ ] C3. A press during a 30-second restart answers no ask, and only that card is re-sent at the bottom with its old copy marked "↓ Re-sent below" without buttons (test).
- [ ] C4. Disabling Discord with `cland config set remote.discord.enabled false` and `cland hub reload` closes the socket with 1000, and the next enabled start identifies afresh (test).

## Notes

Shared files: discord-socket.ts, discord.ts; new hub/src/remote/discord-catchup.ts
