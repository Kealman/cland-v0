---
id: T-1395
kind: task
title: The documentation describes photos, files and voice from Telegram, and the composer's attachments
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1386
  - T-1387
  - T-1389
  - T-1390
  - T-1391
  - T-1394
topic: null
branch: null
created: 2026-10-27T23:37:29.571Z
updated: 2026-10-27T23:37:29.571Z
---

## Summary

The remote-control page gains a "Photos, files and voice" section, and the web page names the composer's attachments and inline images. The page states the limits, the 🎤 message and echo, the providers with `provider = ""`, the `command` contract, and the data-use line. Both pages pass the site's docs tests.

## What to build

The section covers:
- inbound photos, documents and albums;
- the 20 MB and `max_upload_mb` limits;
- outbound photos, documents and the line for larger files;
- what is transcribed;
- the 🎤 message, the "not transcribed" cases and the echo;
- a voice reply to a card;
- `[speech]` with `elevenlabs`, `command` (argv, stdin, the two environment variables, no secrets) and `""`;
- doctor's speech lines and the data-use line, copied from `SPEECH_DATA_USE`.

Setup's offer of the key stays with T-1369. The site's remote-docs test gains checks that the commands and keys named exist. Spec §3.6; §4 (documentation pages).

## Acceptance criteria

- [ ] C1. The remote-control page names `max_upload_mb`, `[speech] provider`, `command`, `CLAND_SPEECH_MIME`, `CLAND_SPEECH_LANGUAGE` and the data-use line identical to `SPEECH_DATA_USE`, and the site's docs tests pass (test).
- [ ] C2. The web page names file attachments in the composer and inline PNG, JPEG, GIF and WebP, and its existing docs checks pass (test).

## Notes

Shared files: site/src/content/docs/docs/remote-control.md, site/src/content/docs/docs/web-and-phone.mdx, site/test/remote-docs.test.ts
