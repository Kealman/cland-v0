---
id: T-1381
kind: task
title: "The Telegram client and the fake Bot API learn files: getFile, a capped download that keeps the token URL inside, sendPhoto and sendDocument"
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: topic-1125
branch: t/T-1381-the-telegram-client-and-the-fake-bot-api
created: 2026-10-27T23:37:26.429Z
updated: 2026-10-28T00:12:44.792Z
closed: 2026-10-28T00:12:44.792Z
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

- [x] C1. A document registered on the fake downloads through `getFile` and `download` byte for byte, and a download whose body exceeds the cap without a `Content-Length` is aborted with a `TelegramError` (test).
  - done: impl-1381 · 2026-10-27T23:41:36.769Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1381-final · 2026-10-28T00:02:50.089Z · commit 1a1758484c29fdb32e2c0864962a63e9dc2ab718
- [x] C2. A download answered with a 302 is refused without following it, and no error, log line or receipt from `getFile`, `download`, `sendPhoto` or `sendDocument` contains the token or a `/file/bot` URL, even when a fake fault echoes them (test).
  - done: impl-1381 · 2026-10-27T23:41:37.855Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1381-final · 2026-10-28T00:02:50.089Z · commit 1a1758484c29fdb32e2c0864962a63e9dc2ab718
- [x] C3. `sendPhoto` and `sendDocument` deliver a file to the fake with its name, MIME type, digest and a plain caption with no `caption_entities` and no parse mode, and the fake refuses an 11 MB photo, a 51 MB document and a 1025-character caption (test).
  - done: impl-1381 · 2026-10-27T23:41:39.564Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1381-final · 2026-10-28T00:02:50.089Z · commit 1a1758484c29fdb32e2c0864962a63e9dc2ab718
- [x] C4. The fake's media control queues a three-item album sharing one `media_group_id` as three message updates whose files resolve through `getFile` (test).
  - done: impl-1381 · 2026-10-27T23:41:41.295Z
  - verified: rev-34 [reviewer] · run rev-34-20261028-1381-final · 2026-10-28T00:02:50.089Z · commit 1a1758484c29fdb32e2c0864962a63e9dc2ab718

## Notes

Shared files: hub/src/remote/telegram-api.ts, hub/test/fakes/telegram/fake-api.ts

## Comments

### impl-1381 · 2026-10-27T23:38:30.224Z

Rule 20 consumer inventory before edits: telegram-api.ts types/API are consumed by remote/{telegram,telegram-inbound,telegram-outbox,telegram-polling,telegram-render,telegram-commands,telegram-prompts,telegram-cards,messenger}.ts and test/fakes/telegram/{fake-api,held-reaction}.ts. Tests importing these directly: telegram-{api,rendering,cards,pairing,pacing,mute,notices,commands,polling,approvals,inbound,liveness}.test.ts, telegram-polling-fixture.ts, setup-pairing-component.test.ts, remote-docs-pairing.test.ts. Search included all tiers, web/nvim/shared, skills, QA and docs: qa/briefs/E-1309.md and docs/agents/tests/*telegram* plus hub/README.md reference the existing seam. No persisted-record reader, wire client, startup probe or shipped skill calls the new methods. Existing methods/replies remain unchanged; new message fields optional and new fake controls additive, so these consumers are unaffected. Prior message shape retained by existing API tests. Tests use the pre-authorized T2 client/fake seam; no frame change.

### rev-26 · 2026-10-27T23:43:59.469Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1381-source-1
commit: 8d6bb380d82c7f79f9b2f748c7c092dbde0b8df0
scope: full
findings: [{"severity":"medium","text":"M1 Standards: capped exchange only awaits method-matched held/close events without checking exact ids; t.signal replaces independent bounds and an early held-observer failure leaves download/assertion/close promises unjoined. Pre-own cancellation/drain, bound setup independently, assert closed.id === held.id, add missing/aborted setup controls retaining cap/bytes assertions.","file":"hub/test/telegram-api.test.ts","line":457}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated full source audit complete: Standards one medium M1, Spec no independent finding. Optional message/API/fake additions, path/cap/redirect/redaction handling, FormData metadata/limits and album controls reviewed. A-12933 local26/26/typecheck is targeted macOS evidence, not configured/Linux/load proof. C1–C4 runtime marks pending. Correct ownership/receipt control and request fresh pushed-head source review before verification; no further dev merge. QA none.

### rev-34 · 2026-10-27T23:48:09.054Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261027-1381-source2
commit: 1a1758484c29fdb32e2c0864962a63e9dc2ab718
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear. Standards 0 / Spec 0 findings; prior M1 resolved. A-12949 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12949-t-1381-correction-source-review-at-1a175848.md) retains rev-26 source-1 continuity and current full source audit. Pre-owned capped exchange has separate readiness/observer/drain bounds, aborts and joins transfer/observers before fake shutdown, and asserts exact held/close ids. Missing/aborted setup controls retain a live below-cap transfer and native disposal receipts; original byte equality and cap-error assertions remain. Additive client/fake media API, optional old message shape, redirect/path/cap/privacy handling and multipart metadata/limits/album coverage remain source-sound. Docs and skill CHANGES match. C1–C4 runtime criteria remain unverified until same-head configured original-record evidence. A-12933/A-12943 local macOS receipts are not Linux/load/configured proof; Reviewer executed no tests or browsers. Proceed with configured mode-free verification at this head; no full run requested.

### rev-34 · 2026-10-28T00:02:50.089Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1381-final
commit: 1a1758484c29fdb32e2c0864962a63e9dc2ab718
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1–C4 verified. A-12968 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12968-t-1381-final-original-record-evidence-at-1a175848.md) audits exact-head d4a9f1ad/A-12964. Unique generated FINISH records show3772 ordinary passes/491files, zero fail/cancel/skip/todo, plus50 separate load passes (25 task/25 site-doc). All five new media/owner identities have base +5/5 passes, all27 telegram-api cases pass; largest new base1.243174441s and max task load1.242935134s, below3s allowance threshold. Source-checked facts retain exact bytes/cap/held-close id, redirect no-follow/privacy fault controls, multipart metadata/digests/plain caption and limits, album file resolution and live-transfer missed/aborted-setup drainage. HostT0/check and LinuxT1/all fallbackT2/Web passed; remote host-gate tree8ad2afe974371b05971b06a3453e3f1f5b98bcee reused, not repeated Linux typecheck. T3/T4 unrun. Linuxx64 6.8.0-142-generic droplet c-8lon1 Node24.21/Neovim0.12.5, isolated Chrome Headless Shell156.0.8078.4/build1248, workers2/Web4. Timing/lint134findings/ratchet report-only; Web over-wall remains explicit. Lifetime746s/$0.0518 accounting not suitewall. No provider/stageQA claim; Reviewer executed no tests/browser. Source2/A-12949 unchanged.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-28T00:12:44.792Z

Merged 93dcb88ee4b1fd02b6a7f40b4008d77300d51d82 onto dev.
