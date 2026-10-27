---
id: T-1415
kind: task
title: Outbound artifacts reach Discord once per remote within its file limits
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1404
  - T-1405
  - E-1311
topic: null
branch: null
created: 2026-10-27T23:38:48.861Z
updated: 2026-10-27T23:38:48.861Z
---

> Pending: whether Discord attachments and voice stay in this epic (blocked by E-1311) or move to a 0.3.x release awaits the human's answer to ask 62b8d32f; the Coordinator's recommendation keeps them here. Do not launch before it is answered.

## Summary

An agent's artifacts go to the paired channel as files with the message's header as caption, each exactly once per remote. A message holds at most 10 files, each file 20 MiB and each request 25 MiB. A larger file arrives as a line naming the artifact and its path.

## What to build

**Sending.** `createMessage` gains multipart: `files[n]` with names and a `payload_json` that keeps the nonce, `enforce_nonce` and the empty `allowed_mentions`. A message's artifacts are grouped into sends of at most 10 files and 25 MiB. Each send carries the header as its caption, and a single artifact with a short text carries the text too. A file over 20 MiB becomes a line naming the artifact and its path. HTML and diagrams go as files.

**Once per remote.** E-1311's per-remote ledger records each artifact once, and a timed-out multipart send is proven by its nonce, as 09 does. A photo the human sends from Telegram reaches Discord under "you (Telegram)".

The fake accepts multipart, enforces the counts and sizes, and stores the files.

Spec §3.6 (outbound artifacts); research rule 22.

## Acceptance criteria

- [ ] C1. An agent's message with an image and a PDF arrives in the channel once with both files and the header, and a send retried after a timeout posts nothing twice (test).
- [ ] C2. Twelve artifacts totalling 30 MiB arrive in several messages of at most 10 files and 25 MiB each, every artifact exactly once (test).
- [ ] C3. A 21 MiB artifact arrives as one line naming it and its path (test).
- [ ] C4. A photo sent from Telegram reaches the channel exactly once, captioned "you (Telegram)" (test).

## Notes

Shared files: discord-api.ts (multipart), discord-outbox.ts, discord.ts (General out)
