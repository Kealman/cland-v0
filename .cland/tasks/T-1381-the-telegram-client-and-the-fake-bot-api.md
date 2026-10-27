---
id: T-1381
kind: task
title: "The Telegram client and the fake Bot API learn files: getFile, a capped download that keeps the token URL inside, sendPhoto and sendDocument"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: topic-1125
branch: t/T-1381-the-telegram-client-and-the-fake-bot-api
created: 2026-10-27T23:37:26.429Z
updated: 2026-10-27T23:38:30.224Z
---

## Summary

The Bot API client gains `getFile`, a download, and multipart `sendPhoto` and `sendDocument`. The download builds its token-bearing URL only inside the client, refuses redirects and stops at a byte cap even without a `Content-Length`. The fake Bot API serves these calls with Telegram's size rules, so every media ticket can test against it.

## What to build

`TelegramApi` gains the message types the media tickets read: `photo` sizes, `document`, `voice`, `audio`, `video_note`, `video`, `caption` and `media_group_id`. Each carries its `file_id`, `file_size`, `duration`, `mime_type` and `file_name` where Telegram has them. It also gains these calls:
- `getFile`;
- `download(filePath, maxBytes, signal)`:
  - it validates the path against `^[A-Za-z0-9_./-]+$` with no `..`;
  - it fetches `${root}/file/bot<token>/<path>` with `redirect: 'error'`;
  - it streams the body and aborts once the cap is passed;
  - every error is a `TelegramError` free of the URL and the token;
- `sendPhoto` and `sendDocument`, built from `FormData` and `openAsBlob`, with `chat_id`, a plain `caption` (no entities, no parse mode), `disable_notification` and `reply_parameters`.

The fake Bot API gains:
- `getFile`, and the `/file/bot<token>/` route;
- refusal of `getFile` above 20 MB ("file is too big");
- multipart parsing of `sendPhoto` and `sendDocument`, refusing a photo over 10 MB, a document over 50 MB and a caption over 1024 characters. It records the file name, MIME type, size, a digest and the caption;
- a control endpoint that queues a media message: a photo, document, voice note, audio file, video note or video, alone or in an album. Its bytes are registered by content, or only by declared size for large files.

Spec §3.7 (sizes, the token URL) and §3.12; builds on the T-1340 client seam.

## Acceptance criteria

- [ ] C1. A document registered on the fake downloads through `getFile` and `download` byte for byte, and a download whose body exceeds the cap without a `Content-Length` is aborted with a `TelegramError` (test).
- [ ] C2. A download answered with a 302 is refused without following it, and no error, log line or receipt from `getFile`, `download`, `sendPhoto` or `sendDocument` contains the token or a `/file/bot` URL, even when a fake fault echoes them (test).
- [ ] C3. `sendPhoto` and `sendDocument` deliver a file to the fake with its name, MIME type, digest and a plain caption with no `caption_entities` and no parse mode, and the fake refuses an 11 MB photo, a 51 MB document and a 1025-character caption (test).
- [ ] C4. The fake's media control queues a three-item album sharing one `media_group_id` as three message updates whose files resolve through `getFile` (test).

## Notes

Shared files: hub/src/remote/telegram-api.ts, hub/test/fakes/telegram/fake-api.ts

## Comments

### impl-1381 · 2026-10-27T23:38:30.224Z

Rule 20 consumer inventory before edits: telegram-api.ts types/API are consumed by remote/{telegram,telegram-inbound,telegram-outbox,telegram-polling,telegram-render,telegram-commands,telegram-prompts,telegram-cards,messenger}.ts and test/fakes/telegram/{fake-api,held-reaction}.ts. Tests importing these directly: telegram-{api,rendering,cards,pairing,pacing,mute,notices,commands,polling,approvals,inbound,liveness}.test.ts, telegram-polling-fixture.ts, setup-pairing-component.test.ts, remote-docs-pairing.test.ts. Search included all tiers, web/nvim/shared, skills, QA and docs: qa/briefs/E-1309.md and docs/agents/tests/*telegram* plus hub/README.md reference the existing seam. No persisted-record reader, wire client, startup probe or shipped skill calls the new methods. Existing methods/replies remain unchanged; new message fields optional and new fake controls additive, so these consumers are unaffected. Prior message shape retained by existing API tests. Tests use the pre-authorized T2 client/fake seam; no frame change.
