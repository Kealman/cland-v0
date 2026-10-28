---
id: T-1388
kind: task
title: A voice note becomes the human's 🎤 transcript message with the audio attached, and the bot echoes it with its timings and provider
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1383
  - T-1384
  - T-1385
topic: topic-1157
branch: t/T-1388-a-voice-note-becomes-the-human-s
created: 2026-10-27T23:37:28.063Z
updated: 2026-10-28T19:20:22.531Z
closed: 2026-10-28T19:20:22.531Z
---

## Summary

A voice note joins the media queue. The gateway downloads it, then transcribes the original bytes through the configured provider within one 90-second deadline, and posts the human's message "🎤 <transcript>" with the audio attached. A missing key, a failure or silence still posts the audio, with "🎤 not transcribed", "🎤 not transcribed: <reason>" or "🎤 nothing recognised", and the chat gets one line. The bot echoes the transcript with the note's length, the download and transcription times and the provider's name.

## What to build

**Wiring.** The messenger factory receives the speech provider built from the reloaded `[speech]` settings and secrets by ticket 04's factory. It is rebuilt on every gateway reload.

**Shared contract change:** the `MessengerFactory` signature. Consumers to migrate: `messengerFactory` in `gateway.ts`, `ConfiguredGateway`, and the injected factories in hub tests (`hub/test/fakes/messenger.ts` and others), which E-1312's Discord factory will follow.

**A messenger-neutral voice pipeline** (`voice.ts`):
1. download through a messenger-supplied fetch, timed;
2. call `transcribeNote`, timed;
3. compose the General text, the attachment name and title, and the echo or the chat line.

The audio is uploaded with the sender's MIME type (`audio/ogg` when absent) and a matching name: `voice-<message id>.ogg`, `.mp3` or `.m4a`.

**The four outcomes.**
- **Transcribed:** General "🎤 <text>"; the echo is a reply to the note, "🎤 <text>", then "0:42 · download 0.3 s · transcription 1.6 s · elevenlabs".
- **No key:** General "🎤 not transcribed"; the chat line is "Transcription needs a key: cland secret set speech.elevenlabs_key, then cland hub reload".
- **`provider = ""`:** General "🎤 not transcribed"; the chat line is "Transcription is off ([speech] provider)".
- **Failure:** General "🎤 not transcribed: <reason by kind>", plus one chat line.

An empty transcript posts "🎤 nothing recognised".

The note's message is never edited later. A replayed note posts one message (the upload's ingress dedupe). No messenger URL reaches the provider. Spec §3.6 (the transcript message, the echo, bytes untouched); GLOSSARY Transcript.

## Acceptance criteria

- [x] C1. A voice note on the fake with the fake ElevenLabs answering "привет, это тест" arrives in General as "🎤 привет, это тест" from `human` "via Telegram" with one `.ogg` artifact holding the note's exact bytes, and the provider received `audio/ogg` bytes rather than any URL (test).
  - done: impl-1388 · 2026-10-28T17:11:39.851Z
  - verified: rev-26 [reviewer] · run rev-20261028-1388-evidence-2 · 2026-10-28T17:39:28.360Z · commit 6c406cbaaf6492d9de9dca5deef577cfdace2b25
  - verified: rev-31 [reviewer] · run rev-20261028-1388-final3 · 2026-10-28T19:13:56.661Z · commit 177d1b33575aa83911845f01bb5a3fc08d91a150
- [x] C2. The chat receives one echo replying to the note with the transcript, the note's length, a download time, a transcription time and "elevenlabs", and the General message is not mirrored back (test).
  - done: impl-1388 · 2026-10-28T17:18:45.781Z
  - verified: rev-26 [reviewer] · run rev-20261028-1388-evidence-2 · 2026-10-28T17:39:28.360Z · commit 6c406cbaaf6492d9de9dca5deef577cfdace2b25
  - verified: rev-31 [reviewer] · run rev-20261028-1388-final3 · 2026-10-28T19:13:56.661Z · commit 177d1b33575aa83911845f01bb5a3fc08d91a150
- [x] C3. With no key the note arrives as "🎤 not transcribed" with the audio and the chat gets the one line naming `cland secret set speech.elevenlabs_key`, and with `provider = ""` it arrives the same way with the "off" line and the fake provider receives no request (test).
  - done: impl-1388 · 2026-10-28T17:11:56.028Z
  - verified: rev-26 [reviewer] · run rev-20261028-1388-evidence-2 · 2026-10-28T17:39:28.360Z · commit 6c406cbaaf6492d9de9dca5deef577cfdace2b25
  - verified: rev-31 [reviewer] · run rev-20261028-1388-final3 · 2026-10-28T19:13:56.662Z · commit 177d1b33575aa83911845f01bb5a3fc08d91a150
- [x] C4. A fake failing with 402 posts "🎤 not transcribed: …" naming quota with the audio and one chat line, and an empty transcript posts "🎤 nothing recognised" with the audio (test).
  - done: impl-1388 · 2026-10-28T17:11:56.392Z
  - verified: rev-26 [reviewer] · run rev-20261028-1388-evidence-2 · 2026-10-28T17:39:28.360Z · commit 6c406cbaaf6492d9de9dca5deef577cfdace2b25
  - verified: rev-31 [reviewer] · run rev-20261028-1388-final3 · 2026-10-28T19:13:56.662Z · commit 177d1b33575aa83911845f01bb5a3fc08d91a150
- [x] C5. Switching `[speech]` to a fake `command` and running `cland hub reload` transcribes the next note through the command, and the echo names "command" (test).
  - done: impl-1388 · 2026-10-28T17:11:56.626Z
  - verified: rev-26 [reviewer] · run rev-20261028-1388-evidence-2 · 2026-10-28T17:39:28.360Z · commit 6c406cbaaf6492d9de9dca5deef577cfdace2b25
  - verified: rev-31 [reviewer] · run rev-20261028-1388-final3 · 2026-10-28T19:13:56.662Z · commit 177d1b33575aa83911845f01bb5a3fc08d91a150

## Notes

Shared files: hub/src/remote/voice.ts (new), hub/src/remote/media.ts, hub/src/remote/telegram.ts, hub/src/remote/gateway.ts, hub/src/remote/configuration.ts

## Comments

### impl-1388 · 2026-10-28T17:05:05.317Z

Rule 20 consumer search before change: MessengerFactory type in remote/configuration.ts, ConfiguredGateway.update; production remote/messenger.ts and hub/daemon.ts; injected gatewayMessenger factories via test/harness.ts, test/fakes/messenger.ts and gateway/reload fixtures; direct messengerFactory callers in discord-{messenger,render,messages,pairing}.test.ts and telegram-notices.test.ts. Repo-wide search of hub, docs, qa and .agents found no additional signature consumers, persisted readers, startup probes or T3/T4 users. Add optional fourth speech-provider argument (old three-argument callers and injected factories remain valid); ConfiguredGateway constructs it on reload using daemon-owned environment/redactor. Existing wire/receipt shapes remain unchanged; gateway previous-wire regression retained.

### rev-26 · 2026-10-28T17:17:52.793Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1388-source-1
commit: 2d1e1f53c16db242c13ca83b3cd0ea5b0ebb5dde
scope: full
findings: [{"severity":"medium","text":"M1 Standards: the new telegram-voice tier row is out of lexical order, and its per-file guide has no tests/index.md membership. Restore only the owning tier/index entries and retain unchanged-guard red/green receipts.","file":"hub/test/tiers.json","line":564},{"severity":"medium","text":"M2 Standards: the reload case launches a real Node speech child but is classified T2. Move the native command case and its lifecycle ownership to a T3 file; retain the loopback provider cases at T2 and update guides/manifests.","file":"hub/test/telegram-voice.test.ts","line":118},{"severity":"medium","text":"M3 Spec: voice echo sends the complete transcript plus timing footer in one unbounded sendMessage. A transcript fitting General can exceed Telegram's native message budget and lose its echo. Use literal-preserving bounded parts with durable stable part keys, and cover a long transcript with one General publication and no mirror.","file":"hub/src/remote/telegram.ts","line":408},{"severity":"high","text":"M4 Spec: native echo failure after the General upload has committed rejects the media processing callback. MediaQueue retries recoverUpload followed by the same fenced/uncertain echo key indefinitely, blocking later input for that chat. Separate durable input completion from owed/unknown echo delivery, preserve unknown-send fencing, and cover lost accepted-echo receipts plus restart and later-input progress without duplicate transcription or General publication.","file":"hub/src/remote/telegram.ts","line":411},{"severity":"medium","text":"M5 Spec: every non-null provider's not-configured error is rendered as a missing ElevenLabs key. CommandProvider emits that error for empty argv or a missing executable, so the instruction is wrong for command configuration. Render provider-appropriate setup guidance and add a command-not-configured control while preserving missing-key and off behavior.","file":"hub/src/remote/voice.ts","line":35}]
finding_counts: {"high":1,"medium":4,"low":0}

Full source review in A-13379 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13379-t-1388-full-source-review-1-not-clear.md). Standards M1/M2 and Spec M3/M4/M5 remain at the reviewed commit. Local reported working-tree guard/split corrections require a fresh pushed source head. No reviewer workloads run; no configured runtime evidence exists. Consolidated audit complete; request fresh source review after all corrections, before verification.

Criteria: C2 failed (Native echo has no message budget and post-upload echo failure can permanently block this chat's media FIFO.).

### impl-1388 · 2026-10-28T17:18:21.450Z

Source review corrections M1–M5: sorted only owning tier entries and indexed both guides; command reload native proof moved to T3, loopback voice remains T2. Added failing long-echo and held accepted-echo controls, then split literal output via existing commandParts/plainCommandReply budget with stable durable part keys. Added separate redacted ready echo intent and sent/incomplete outcome; pre-owned tracked worker and startup recovery never hold media FIFO, and unknown outbox attempts remain fenced. New persisted namespace consumers are only TelegramRemote startup/media/echo methods and voice receipt tests; existing snapshots/wire/receipt readers unchanged. Empty/missing command red controls now retain audio and name [speech] command. Guard red receipts: tier not sorted at telegram-liveness; docs 'each per-test document must be indexed exactly once'. Both unchanged guards green after correction.

### rev-26 · 2026-10-28T17:20:07.199Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1388-source-2
commit: 6c406cbaaf6492d9de9dca5deef577cfdace2b25
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13381 full source2 clear resolves all M1–M5 from A-13379. Independent durable echo intent/readiness and tracked worker release inbound completion from unknown echo receipts, preserve stable part keys/fences and join on shutdown; long literal parts, held close/restart/later input, provider setup and T3 command boundaries reviewed. C1–C5 remain unverified pending exact-head configured mode-free original execution evidence; no reviewer workload run. Local correction A-13380 is not Linux/suite evidence. No dev merge or head change authorized by this verdict.

### rev-26 · 2026-10-28T17:24:03.559Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1388-evidence-1
commit: 6c406cbaaf6492d9de9dca5deef577cfdace2b25
scope: evidence
findings: [{"severity":"medium","text":"Configured run ef42af60/A-13382 failed SSH delivery before remote runtime. Only T0 host check passed; T1/T2/changed T3/Web and all runtime criterion evidence are absent. Retain unchanged-head source clearance."}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13383 records independently inspected original A-13382 and hub failed-transfer receipt. No actual criterion behavior failure inferred; C1–C5 remain unverified, source2/A-13381 remains clear. Allocation/billing/projections are not platform/runtime measurements. Newly admitted successor 6c55de78 is pending and not evidence for this verdict.

### rev-26 · 2026-10-28T17:39:28.361Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1388-evidence-2
commit: 6c406cbaaf6492d9de9dca5deef577cfdace2b25
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13387 final evidence2 clear: original A-13386 independently parsed 3971 ordinary passes plus 60 separate load passes (35 voice,25 site), no nonpass/unfinished. All seven named voice T2 cases base+5/5; three native command T3 cases once, all pass. Source2 assertions and exact-byte/Russian/no-mirror/outcome/reload/long/unknown-receipt controls retained. C1–C5 verified. T0/all T1/fallback all T2/changed T3/Web passed on recorded Linux/CHS156-v1248; remaining T3/T4 absent. Host-gate reuse, timing/report-only lint/ratchet limits explicit. Earlier A-13382 remains failed SSH loss. Coordinator full cover/landing remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-28T18:56:52.738Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1388-delta1
commit: 177d1b33575aa83911845f01bb5a3fc08d91a150
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13413 authorized merge delta clear, Standards0/Spec0. Coordinator88dab2d0 named reassignment; rev-26 source2/evidence2 A-13381/A-13387 carried. Combined parent diff retains every SKILL/CHANGES paragraph (independently checked both parent paragraph sets); README merges disjoint guidance. Task production/voice test/fixture blobs identical to reviewed6c406cba, no authored source algorithm or new identity/allowance. Incoming dev T-1403/T-1406/T-1432 inherited. Prior A-13386/A-13402 remain old-head receipts; Coordinator1991284f retained full T3 carry, including8 skips/report-only ratchet, not current-head runtime. C1–C5 pending merged-head original configured evidence. One stable-head mode-free verify then final audit; no extra full/stress/per-item QA requested.

### rev-31 · 2026-10-28T19:13:56.662Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1388-final3
commit: 177d1b33575aa83911845f01bb5a3fc08d91a150
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13418 final merged-head evidence clear. Independently parsed exact-head ed9a4447/A-13416:3978 ordinary passes+60 separate load passes, zero nonpass/duplicate ids. All7 voice T2 base cases each5/5 load,3 command T3 cases once, max voice load.540244504s. Current exact byte/MIME/Russian human transcript/native echo/no mirror, missing/off/quota/empty retention, native command reload, long split and unknown-echo restart assertions inspected; C1–C5 verified. T0/T1/all fallback T2/changed T3/Web complete; remaining T3/T4 absent. Linux c-8 sfo2, pinned CHS156/v1248, task2/Web4, host TREE reuse, case/phase/added-wall distinctions retained. Budgets/lint/ratchet report-only with current +.551s growth disclosed. Prior SSH-loss A-13382 and old-head greens retain attribution. Coordinator-retained full A-13402 independently confirms5375 pass/8skip at6c406cba,T0–T3/Web,no separate T4; explicit1991284f carry, not relabeled current-head. No extra run/per-item QA; fresh conflict check/ready then Coordinator enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-28T19:20:22.531Z

Merged 74faa984bfb2da1eb3182ee8c739bc1c6b765bbf onto dev.
