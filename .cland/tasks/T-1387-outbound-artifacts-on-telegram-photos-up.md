---
id: T-1387
kind: task
title: "Outbound artifacts on Telegram: photos up to 10 MB, documents up to 50 MB, each artifact once per remote, and a line for anything larger"
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1381
topic: topic-1141
branch: t/T-1387-outbound-artifacts-on-telegram-photos-up
created: 2026-10-27T23:37:27.927Z
updated: 2026-10-28T08:21:14.709Z
---

> Pending: the once-per-remote behaviour below is the Coordinator's recommendation awaiting the human's answer to ask 62b8d32f; do not launch before it is answered.

## Summary

A mirrored General message's artifacts follow it to Telegram:
- a PNG, JPEG, GIF or WebP image up to 10 MB goes as a photo;
- any other file up to 50 MB, HTML and diagrams included, goes as a document;
- folders, deleted files and anything larger go as a line with the name and the project-relative path.

Each artifact goes once per remote, captioned with the message's header, and a single artifact with a short text goes as the file captioned with the header and the text.

## What to build

**A messenger-neutral planner.** It takes a message and a messenger's limits (photo cap, document cap, caption length, image types). It returns the ordered sends:
- the text part, when it does not fit a caption;
- one file per artifact;
- a line per artifact that cannot go as a file.

The message's artifacts are `artifact` and `artifacts` deduplicated by id. Telegram's limits are 10 MB, 50 MB and 1024.

**On Telegram.**
- The outbox gains `sendPhoto` and `sendDocument` jobs. They hold the artifact id and the caption, never bytes. At send time they read the file, confined to `.cland/artifacts` with no symlink.
- Captions are plain text with no entities (the CRLF entity shift).
- One message's sends are enqueued together, so nothing interleaves.
- The once key is stored per remote with the artifact id, per the recommended reading in the assumptions (open). A replay, a restart or a duplicated field never sends a file twice.
- An outage marks file jobs missed like their message.
- The outbox's uncertainty rule applies: an upload that may have left is never resent.
- What the human sent from this remote is still not mirrored, files included.

**Shared contract:** none; the outbox payload is internal. Spec §3.6 (outbound artifacts) and §3.4; Q-1293 (once per remote).

## Acceptance criteria

- [x] C1. An agent's General message with a PNG and a PDF and a long text arrives as the text, one photo and one document, each captioned with the message's header and each sent exactly once, even though the message carries the PNG in both `artifact` and `artifacts` (test).
  - done: impl-1387 · 2026-10-28T08:21:13.942Z
- [x] C2. A single 2 KB note artifact with a one-line text arrives as one document whose caption is the header, a newline and the text, with no `caption_entities` (test).
  - done: impl-1387 · 2026-10-28T08:21:14.096Z
- [x] C3. A 60 MB artifact, made as a sparse file, arrives as one line naming its id, title, size and `.cland/artifacts/…` path with no absolute path, and a 12 MB PNG arrives as a document (test).
  - done: impl-1387 · 2026-10-28T08:21:14.438Z
- [x] C4. Restarting the hub while a file job is queued sends it once, and an upload the fake holds past its timeout is not resent (test).
  - done: impl-1387 · 2026-10-28T08:21:14.578Z
- [x] C5. An image uploaded through the web's `artifact.upload` path arrives captioned "you · message", while the same upload made via Telegram is not sent back to Telegram (test).
  - done: impl-1387 · 2026-10-28T08:21:14.709Z

## Notes

Shared files: hub/src/remote/telegram.ts, hub/src/remote/telegram-outbox.ts, hub/src/remote/state.ts, hub/src/remote/media.ts

## Comments

### coord · 2026-10-28T05:05:33.064Z

The human accepted the Coordinator's recommendation in ask 62b8d32f (2026-10-28 05:04Z, 'Да, все три рекомендации'). The pending note at the top of this item is resolved: build the behaviour as written; the hold is lifted and the ticket launches with its stage.

### impl-1387 · 2026-10-28T08:12:27.219Z

Implementing at agreed production frame/fake Bot API seam. No wire contract change planned: messenger-neutral artifact planner, internal Telegram durable file payload and per-remote outbox keys. Existing mirrorOut exclusion retains Telegram upload echo suppression. Accepted once-ever decision includes later sent-above replies. Will not merge dev until Coordinator requests (shared Telegram lane ordering).

### impl-1387 · 2026-10-28T08:17:53.899Z

C4 uses the existing General outbox semantics: an upload whose timeout may have left is durably missed with its exact attempt outcome unknown (uncertain is the non-General/card state). Restart proof waits for the resumed startup poll after resume, stops the hub, then asserts one held request and exactly two earlier accepted file uploads. Queued file jobs remain general jobs so outage gap counting deduplicates their common message source. No change to the shared Outbox state machine.

### impl-1387 · 2026-10-28T08:19:57.043Z

Rule 16: no CLI flags, settings, role permissions or wire frames added; existing General/remote authority applies, so help and role clauses need no new lines. Updated hub/README.md, per-file test guidance/index and implement skill (CHANGES recorded). New file is T2. Local macOS Node v24.21.0 tests use production frames + loopback fake, no browser/platform. Six cases cover C1–C5 plus delivery-time symlink replacement. First red was sendRichMessage instead of sendDocument; later red exposed lost reattachment text and an unwanted empty-caption newline, both corrected. Linux timings remain unmeasured until verify; any >=3 s new case will be reported before ready.

### impl-1387 · 2026-10-28T08:21:07.080Z

Consumer inventory (delivery extension; no existing reply/list/schema/refusal or wire payload changes): production daemon→messengerFactory→TelegramRemote→TelegramOutbox; TelegramCards/TelegramPrompts retain send/edit/reaction APIs and legacy payloads; shared mirrorOut and RemoteState remain unchanged; Discord mirror/outbox callers remain unaffected. Persisted job readers: TelegramOutbox resume/prove, Telegram gap identity matcher and generic outbox/gap/status depth readers accept new native methods through existing params.chat_id and source. Tests/fixtures found by repository-wide rg (including tiers T3/T4): telegram-rendering, pacing and pacing-fixture, notices, approvals, cards, mute, polling-restart, polling-fixture, inbound, polling; remote-state, remote-neutral; discord messenger/messages/pairing. Existing old-payload regressions stay unchanged (no mandatory files callback for injected clients). Shipped guidance hits: implement skill and card/inbound/pacing test guides; new artifact guide updates the new behaviour. No QA brief/startup probe/web/Neovim consumer of internal Telegram job methods found. No mandatory client field added: older wire frames and injected remotes retain text-only operation without the optional artifact resolver.
