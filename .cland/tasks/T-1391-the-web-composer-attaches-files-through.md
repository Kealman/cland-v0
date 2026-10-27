---
id: T-1391
kind: task
title: The web composer attaches files through an HTTP endpoint on the web edge, with its cookie and Origin checks
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1382
topic: null
branch: null
created: 2026-10-27T23:37:28.755Z
updated: 2026-10-27T23:37:28.755Z
---

## Summary

The web edge's own listener gains `POST /upload`. It accepts files only with a valid session cookie, a matching Origin and an allowed Host, and turns them into one `artifact.upload` through the web's conversation. The composer gains file attachments: chosen files show as chips, and sending the message posts them with its text.

## What to build

**The endpoint.**
- It accepts `multipart/form-data`: `topic`, `text`, `kind`, `to` or `replyTo`, and up to 10 files.
- It answers 401 without a valid cookie (`auth.session`), 403 for a foreign Origin or a disallowed Host, 405 for other methods, and 413 as soon as `Content-Length` or the streamed body passes 10 × `max_upload_mb` or a file passes `max_upload_mb`. It holds no more than that in memory.
- It hands the Buffers beside the frame to the same web conversation. The web authority table and its audit apply.
- It returns the result JSON with the message id.

**The composer.**
- An "Attach a file" control opens the browser's file picker. If it gets a key, the binding goes through `keymap.ts`.
- Chosen files show as chips with their name and size beside the existing artifact chips. A file over the limit shows as refused, with the limit in its tooltip.
- With files, Enter sends through the endpoint, so the message text becomes the caption. Without files the send is unchanged.
- Styling uses CSS Modules and tokens, with phone width respected.

**Shared contract:** the new HTTP route on the web edge. v0.2 §3.7's checks are kept, and the hub tests of the web edge's routes are updated. Spec §3.6.

## Acceptance criteria

- [ ] C1. In headless Chromium, a PNG attached in General's composer and sent with a text arrives as one human message with that text and the PNG artifact, with no ▣ message (test).
- [ ] C2. `POST /upload` without the cookie answers 401, with a foreign Origin 403, and with a body over the limit 413, and none of them creates an artifact or a message (test).
- [ ] C3. A file over `max_upload_mb` chosen in the composer shows as refused and is not sent, and the composer's other keys and the existing artifact chip still work (test).

## Notes

Shared files: hub/src/hub/web-edge.ts, hub/src/hub/web-auth.ts, web/src/Composer.tsx, web/src/Composer.module.css, web/src/composer-drafts.ts, web/src/keymap.ts
