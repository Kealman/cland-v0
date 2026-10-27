---
id: T-1390
kind: task
title: A voice reply to a card, or a voice note after "Other answer…" or "Decline…", answers the ask
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1388
topic: null
branch: null
created: 2026-10-27T23:37:28.501Z
updated: 2026-10-27T23:37:28.501Z
---

> Pending: the voice-reply behaviour below is the Coordinator's recommendation awaiting the human's answer to ask 62b8d32f; do not launch before it is answered.

## Summary

A voice note that replies to an open ask's card, or that comes while E-1310's prompt waits, answers the ask with its transcript under the rules for a typed reply, with `via = "telegram"`. When it cannot answer, the ask stays open and the chat gets one line.

## What to build

When a voice note targets a card or a waiting prompt, the pipeline runs as in ticket 08, but the transcript goes through the same path as text: `TelegramPrompts`'s answer, never a General message.
- A free-answer ask takes the transcript as its text, and a decline prompt takes it as the reason.
- An options-only card accepts an option's number or an option's text, matched ignoring case and trailing punctuation. Anything else gets E-1310's note.
- The echo replies to the note with the transcript and "answered", and the card's outcome edit follows as for any answer.

When the note cannot answer (no key, off, a failure, nothing recognised or no match), the ask stays open and the chat gets one line. The audio follows the recommended reading in the assumptions (open): an answering note keeps no artifact, and a note that cannot answer goes to General as an ordinary 🎤 message. A late note never answers (E-1310 ticket 05's rule). Spec §3.6 ("a voice reply to a card answers its ask") and §3.5.

## Acceptance criteria

- [ ] C1. A voice reply to a free-answer card answers the ask with the transcript "via Telegram", the card is edited to its outcome, and the transcript is not posted to General (test).
- [ ] C2. A voice note after "Decline…" records the decline with the transcript as the reason, and a voice reply "Second." to an options-only card whose second option is "second" answers option 2 (test).
- [ ] C3. A voice reply to a card while the fake provider fails leaves the ask open with its buttons, the chat gets one line, and the audio reaches General as a "🎤 not transcribed" message (test).

## Notes

Shared files: hub/src/remote/telegram-prompts.ts, hub/src/remote/telegram.ts, hub/src/remote/voice.ts
