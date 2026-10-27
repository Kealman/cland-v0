---
id: T-1413
kind: task
title: A later start reads the channel history back to the last id, re-sends every open card and adds the gap line
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1412
topic: null
branch: null
created: 2026-10-27T23:38:48.468Z
updated: 2026-10-27T23:38:48.468Z
---

## Summary

When no resume is possible, the hub identifies afresh. It reads the channel's history back to the last message it processed and posts what it finds to General in order, marked late, at most 500 messages. It then adds one silent gap line when General messages were missed, and re-sends every open card at the bottom. A crash during the catch-up loses and duplicates nothing.

## What to build

**Reading history.** After a fresh identify with a stored cursor, the hub compares the cursor with the channel's `last_message_id` and stops if they match. Otherwise it pages back with `before`, newest first and 100 a page, until it reaches the cursor. It filters the messages by 05's inbound rules and deduplicates them by id against live events. It posts them in ascending order, each marked late with its Discord time. Past 500 it passes the newest 500 and posts one silent line in the channel saying the older ones were not passed on. The cursor advances after each stored message, so a crash resumes where it stopped.

**Then, in §3.9's order:**
1. the neutral gap line (`flushGap` with Discord's matcher), silent, only when N is above 0;
2. the cards and outcome edits that never got through;
3. every open card re-sent at the bottom with its old copies marked "↓ Re-sent below".

The fake's control posts messages while the hub is down and holds `last_message_id`.

Spec §3.8 (history catch-up), §3.9; research rule 32.

## Acceptance criteria

- [ ] C1. Two messages typed during a three-minute restart reach General once each, in order and marked late, and every open card is re-sent at the bottom with its old copy marked "↓ Re-sent below" (test).
- [ ] C2. 620 messages typed during an outage pass the newest 500 to General in order, with one line in the channel saying the older ones were not passed on (test).
- [ ] C3. A hub killed in the middle of the catch-up passes no message twice and loses none after the next start (test).
- [ ] C4. General messages missed during an outage give one silent "N General messages missed since HH:MM" line before the re-sent cards, and none when N is 0 (test).
- [ ] C5. A last message id above 2^53 survives the restart as identical TEXT in `hub.db` and pages back exactly to it (test).

## Notes

Shared files: discord-catchup.ts, discord.ts
