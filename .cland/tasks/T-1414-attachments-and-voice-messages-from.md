---
id: T-1414
kind: task
title: Attachments and voice messages from Discord become the human's artifacts and 🎤 transcripts
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1406
  - T-1413
  - E-1311
topic: topic-1172
branch: t/T-1414-attachments-and-voice-messages-from
created: 2026-10-27T23:38:48.717Z
updated: 2026-10-29T08:38:14.385Z
closed: 2026-10-29T08:38:14.385Z
---

> Pending: whether Discord attachments and voice stay in this epic (blocked by E-1311) or move to a 0.3.x release awaits the human's answer to ask 62b8d32f; the Coordinator's recommendation keeps them here. Do not launch before it is answered.

## Summary

A photo or file sent in the paired channel is fetched at once from its signed URL, without the token, and becomes the human's artifact on one message in General with the text as its caption. A voice message becomes the human's 🎤 transcript with the audio attached, echoed in the channel. A voice reply to a card answers its ask.

## What to build

**Attachments.** A counted message's attachments are checked by `size` against the `[artifacts]` limit before download. Each is fetched with a plain GET from its signed `url`, with no `Authorization` header and redirects refused. Only Discord's CDN hosts are allowed, or the fake's loopback origin under the fake root. If the URL has expired, the message is read again for a fresh one.

Together they go through E-1311's `artifact.upload` as one human message, with the content as its text and `via = "discord"`. A file over the limit gets a reply in the channel saying so.

**Voice.** A voice message is flag 8192 with one `audio/` attachment. Its `duration_secs` is checked against `[speech] max_seconds` before download. Its bytes go to E-1311's transcription path with their content type (`audio/ogg` when absent). The result is the 🎤 message with the audio attached, plus the echo as a reply in the channel (`fail_if_not_exists: false`) with the length, the times and the provider. A voice reply to a card answers its ask through the same path as a typed one.

The fake serves a CDN that records request headers and supports expiring URLs.

Spec §3.6 (inbound files, voice, bytes untouched), §3.8 (inbound voice); research rule 33.

## Acceptance criteria

- [x] C1. A photo with a caption sent in the channel becomes one human message in General with the photo as the human's artifact and the caption as its text, and the fake CDN sees no `Authorization` header (test).
  - done: impl-1414 · 2026-10-29T07:24:19.198Z
  - verified: rev-26 [reviewer] · run rev-20261029-1414-evidence-1 · 2026-10-29T07:55:28.664Z · commit 424d8bd077bee8db77c62c5e0c5c28240f98a56c
- [x] C2. A photo sent in Discord reaches the paired Telegram chat exactly once, captioned "you (Discord)" (test).
  - done: impl-1414 · 2026-10-29T07:24:19.282Z
  - verified: rev-26 [reviewer] · run rev-20261029-1414-evidence-1 · 2026-10-29T07:55:28.665Z · commit 424d8bd077bee8db77c62c5e0c5c28240f98a56c
- [x] C3. A voice message becomes the human's 🎤 message with the audio attached through the fake speech provider, and the channel gets the echo as a reply with the length, times and provider (test).
  - done: impl-1414 · 2026-10-29T07:24:19.374Z
  - verified: rev-26 [reviewer] · run rev-20261029-1414-evidence-1 · 2026-10-29T07:55:28.665Z · commit 424d8bd077bee8db77c62c5e0c5c28240f98a56c
- [x] C4. A voice message longer than `[speech] max_seconds` is refused before any download, and a voice reply to a card answers its ask (test).
  - done: impl-1414 · 2026-10-29T07:33:15.423Z
  - verified: rev-26 [reviewer] · run rev-20261029-1414-evidence-1 · 2026-10-29T07:55:28.665Z · commit 424d8bd077bee8db77c62c5e0c5c28240f98a56c

## Notes

Shared files: discord-inbound.ts; new hub/src/remote/discord-cdn.ts; hub/test/fakes/discord/ (CDN)

## Comments

### coord · 2026-10-28T05:05:33.511Z

The human accepted the Coordinator's recommendation in ask 62b8d32f (2026-10-28 05:04Z, 'Да, все три рекомендации'). The pending note at the top of this item is resolved: build the behaviour as written; the hold is lifted and the ticket launches with its stage.

### impl-1414 · 2026-10-29T07:17:46.287Z

Consumer inventory before implementation: DiscordInbound called by DiscordRemote and discord-catchup; factory in remote/messenger.ts; Gateway RemoteSend artifact.upload with metadata/files and durable ingress receipt; native mappings consumed by Discord cards, reactions, catchup, outbox and state readers; Telegram mirror/outbound artifact once fence consumes General artifact messages. Existing text, command, cards, resume/history tests (T2/T3), Telegram inbound/voice/answers/artifacts and artifact-upload tests plus shipped guides/QA briefs are compatibility consumers. Plan adds media handling behind existing frames and optional constructor options; no wire/schema migration. Retain text ingress/tombstones and old three-argument factories. Tests through production frame/fake Discord CDN and fake speech only.

### impl-1414 · 2026-10-29T07:25:35.584Z

Expanded named consumer inventory from rg over hub/src, hub/test (all tiers), web/test, nvim/test, qa/briefs, .agents/skills and docs/agents:
hub/src/remote/discord-inbound.ts
hub/src/remote/gateway.ts
hub/src/remote/telegram-inbound.ts
hub/src/remote/discord-outbox.ts
hub/src/remote/telegram.ts
hub/src/remote/discord.ts
hub/src/remote/discord-cards.ts
.agents/skills/implement/SKILL.md
.agents/skills/implement/CHANGES
hub/src/remote/discord-catchup.ts
hub/src/remote/voice.ts
hub/src/remote/discord-api.ts
docs/agents/tests/hub-test-artifact-upload.test.ts.md
hub/src/remote/authority.ts
qa/briefs/E-1311.md
hub/src/remote/messenger.ts
docs/agents/tests/nvim-test-artifact-upload.test.ts.md
nvim/test/artifact-upload.test.ts
docs/agents/tests/hub-test-telegram-artifacts.test.ts.md
hub/test/durations.json
hub/src/hub/audit.ts
hub/src/hub/dispatch.ts
hub/test/discord-render.test.ts
docs/agents/tests/index.md
hub/src/hub/web-upload.ts
hub/test/discord-messenger.test.ts
hub/test/web-authority.test.ts
hub/test/discord-commands.test.ts
hub/src/hub/web-authority.ts
hub/test/artifact-upload.test.ts
hub/test/telegram-notices.test.ts
hub/test/telegram-artifacts.test.ts
hub/test/config-set.test.ts
hub/test/discord-cards.test.ts
hub/test/tiers.json
hub/test/discord-messages.test.ts
hub/test/discord-cards-fixture.ts
hub/src/hub/daemon.ts
hub/test/discord-pairing.test.ts
hub/test/fakes/discord/fake-api.ts
hub/test/gateway.test.ts
hub/src/protocol.ts
hub/test/fixtures/cli-usage/commands.json
hub/src/cli/usage.ts

Production callers migrated: discord-inbound.ts, discord.ts, messenger.ts and discord-catchup.ts. DiscordApi/Outbox additions are optional and preserve old calls/payloads; existing text/tombstone recovery remains. Gateway, authority, artifact dispatcher/web upload, daemon and clients receive unchanged existing frames, with bytes in existing side metadata, so unaffected. Telegram uses existing General artifact + once fence, unchanged. Existing QA E-1311 and all listed old tests/fixtures/guides remain compatible; implement skill edit is proposed under freeze rather than edited. Related Telegram voice/voice-answers/inbound tests and their guides exercise unchanged shared voiceNote and upload implementations. No startup probe or persisted-record reader gains a required field; legacy native message and outbox fields remain readable.

### rev-26 · 2026-10-29T07:31:30.255Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1414-source-1
commit: 77c3a2af70a58c1485dc2c2a7c7fc795e575123e
scope: full
findings: [{"severity":"medium","text":"M1: prose bullet omits exact owning Test file/Notes row required by unchanged docs guard. Retain native red/green and correct only owning row.","file":"docs/agents/tests/index.md","line":327},{"severity":"medium","text":"M2: aborted media catch resolves inbound tail, so socket confirms/persists sequence despite absent upload/receipt; resumable stop can lose media. Reject cancelled input and cover held-CDN/speech native stop/resume with no pre-stop publication and exactly-once recovery.","file":"hub/src/remote/discord-inbound.ts","line":39},{"severity":"medium","text":"M3: history pages return redacted attachment URLs from state.messages; GET-one alone restores private native metadata. Attachment-only history fails download/tombstones. Preserve redacted captures, native history URLs and offline paged photo/voice/expired-refresh controls.","file":"hub/test/fakes/discord/fake-api.ts","line":245},{"severity":"medium","text":"M4: voice answer always sends text; free:false option asks reject recognised valid number/label and upload audio to General. Resolve valid captured-model options using established voice semantics; retain free-text, authority, first-answer and no-audio success controls.","file":"hub/src/remote/discord-inbound.ts","line":112},{"severity":"low","text":"L1: explicit native options ownership table omits new getMessage. Add getMessage:2 so refresh calls retain shared cancellation/join/options forwarding ownership.","file":"hub/test/fakes/discord/exchange.ts","line":61}]
finding_counts: {"high":0,"medium":4,"low":1}

Full source1 not clear: complete13-file diff pinned to base059af43f2/head77c3a2af7 inspected. StandardsM1/L1; SpecM2 interrupted-input confirmation, M3 native history fixture fidelity, M4 voice option resolution. Consolidated findings A-13620 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13620-t-1414-full-source-review-1-not-clear.md). Lead reports M1–M4 native red/green prepared locally; those patches are not reviewed head. Preserve all original bytes/CDN auth/once/echo/duration/card assertions and pre-owned bounded held request/observer/stop/drain fixtures, then fresh exact-head source review before verification. No runtime criteria verified, no reviewer execution; local initial7/24/typecheck not Linux/load/browser evidence. Frozen skill proposal belongs Coordinator; no dev merge after review except directed shared fix/conflict.

Criteria: C4 failed (Options-only mapped asks reject valid recognised option number or label because the voice path always submits free text.).

### rev-26 · 2026-10-29T07:35:36.058Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1414-source-2
commit: 239c80b1c2ef223848307d4935e3fbca6ce8b6f7
scope: full
findings: [{"severity":"medium","text":"M5: new media late suffix duplicates DiscordRemote's existing replay transformation for nonempty attachment captions. Use one media annotation owner, preserve text behavior, add actual captioned RESUME control with exactly one late note/artifact/mapping.","file":"hub/src/remote/discord-inbound.ts","line":107},{"severity":"medium","text":"M6: hub shutdown registered only after awaited projectHub; exchange.close snapshots stops before joining pending startup, so late acquisition can miss shutdown and successful-drain barrier. Pre-register captured startup/stop owner, cancel/join speech observation, add omitted/aborted setup controls retaining Store/root until actual drain.","file":"hub/test/discord-inbound-media.test.ts","line":155}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source2 not clear at239c80b1c/tree03a0f5657, sole parent77c3a2af7/no dev merge. All9 correction diffs inspected, carry original13-file audit A-13620. OriginalM1–M4/L1 resolved: exact Notes index/getMessage2; abort rejects so native sequence stays unconfirmed; private native history URLs/expired refresh/paged photo+voice proof; valid captured-model number/label answers with free/no-audio controls. New M5 double replay-caption annotation and M6 late startup ownership remain. A-13623 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13623-t-1414-full-source-review-2-not-clear.md). Local A-13621 red/green and12media/15history/guard/typecheck not Linux/load/browser evidence; no reviewer execution/runtime verification. Consolidated audit complete; correctM5/M6 with preserved assertions and native owner controls, fresh exact-head source request before verification. Separate Coordinator cover/frozen skill proposal remain.

### rev-26 · 2026-10-29T07:37:58.141Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1414-source-3
commit: 424d8bd077bee8db77c62c5e0c5c28240f98a56c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source3 clear, sole parent239c80b1c/treec0ccd7073; cumulative15-file audit carried from A-13620/A-13623, all3 latest diffs/shared ownership read. M5 media bypasses text replay wrapper, actual captioned RESUME retains literal prefix/exactly1late note/artifact/map. M6 pre-registers shared pacingOwner with exchange before acquisition; captured startup/late hubs/observations joined before successful Store/root barrier, speech observer abort-aware. Omitted/aborted controls retain Store/root through gated drain then actual stoppedhub/nativeclosed/0work/rootremoved; emergency release preowned. OriginalM1–M4/L1 remain resolved: exactindex/getMessage2, cancelledinput unconfirmed, private native pagedattachmentURLs/expiredrefresh, valid voice option/free/noaudio controls. A-13626 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13626-t-1414-full-source-review-3-clear.md). LocalDarwin14media/typecheck and A-13625 actualM5redgreen/newM6green not Linux/load/browser evidence. C1–C4 source implemented, runtime unverified. Proceed configured mode-free verify unchangedhead then original-record final criterion/timing/load review; any source change needs review first. No devmerge/reviewer execution; Coordinator separate fullcover/frozen skill proposal remain.

### rev-26 · 2026-10-29T07:55:28.665Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1414-evidence-1
commit: 424d8bd077bee8db77c62c5e0c5c28240f98a56c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record task evidence clear at unchanged424d8bd07/source3. Original6bf9eb27/A-13629 autoexit0: independently4105 ordinarypass+110 separate loadpass, no fail/cancel/skip or unfinished started identity. T0/allT1/allfallbackT2/Web complete; T3/T4 unrun. Media14base+70load(14×5), maxnewload1.081015401s, no new>=3s allowance needed. C1captionedphoto0.452767934s proves exactbytes/oneGeneral/viaDiscord/CDNnoAuth; C2samecase exactonce nativeTelegramyou(Discord); C3voice0.202824803s proves originalaudio/providerrequest/🎤/sentreply/durationtimingsprovider; C4free/number/label0.409640345/.377153891/.376369651s proves duration-before-download/inclusiveboundary/committedanswer/noaudio. All5/5load; heldCDN/speech/replayedcaption/history/expiredURL/setupdisposal controls base+5load pass. Existingmessages24/cards63/messenger38/Telegraminbound41/speech13 pass. A-13630 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13630-t-1414-final-evidence-review-1-clear.md) gives exact facts/lines/provenance. Linuxx64 c8lon1, Node24.21/Nvim0.12.5, CHS156.0.8078.4/v1248 Web49/237; hosttypecheck1f3841d9 reused, budgets/lint/ratchet report-only. C1–C4 verified; no Reviewer execution. Coordinator planned separate shared-code full/T3 cover and frozen skill proposal remain, not satisfied by this task run; no per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-29T08:38:14.385Z

Merged cd613880e1933cbe2ed677729894f863bfb655d6 onto dev.
