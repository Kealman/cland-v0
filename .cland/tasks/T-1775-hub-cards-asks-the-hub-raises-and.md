---
id: T-1775
kind: task
title: "Hub cards: asks the hub raises and answers itself"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1455
branch: t/T-1775-hub-cards-asks-the-hub-raises-and
created: 2026-11-09T12:44:08.860Z
updated: 2026-11-09T15:20:03.885Z
closed: 2026-11-09T15:20:03.885Z
---

## Summary

The hub can raise a card itself: an ask from `hub` in a topic, with options and an optional free answer, whose answer goes to a hub handler registered for the card's kind instead of to a session. It shows in the inbox frame, the web and Neovim inboxes, and on Telegram and Discord through the v0.3 card model. The first answer wins, every copy folds, and the remotes' authority table gains no request.

## What to build

A hub card service over the asks store with three operations:
- `raise(kind, topic, question, options, free, payload)`, which returns the card id;
- `withdraw(id, reason)`;
- `onAnswer(kind, handler)`.

A card is stored with its kind and payload, so a pending card survives a restart and its handler is found by kind at start. An answer for a kind with no handler keeps the card open and is logged. Answering uses the existing human ask-answer path (the frames and the remote buttons), routed by `from: hub` to the handler, and the handler's result becomes the outcome line. A card may mark its free answer secret, as T-1791's pasted code is. A secret answer reaches the handler verbatim; history, the journal, the log and mirrored topics hold only "answered". The login cards of T-1785, T-1789 and T-1791 use this service; this ticket tests it with a test kind.

## Acceptance criteria

- [x] C1. A hub-raised card appears in the inbox frame as an ask from `hub` with its options, and on the test messenger as a card on Telegram and on Discord (test).
  - done: impl-1775 · 2026-11-09T12:58:25.291Z
  - verified: rev-37 [reviewer] · run rev-37-1775-evidence-1 · 2026-11-09T13:48:29.636Z · commit b1a2b227862bc9a85616a5d385b3e5b311763589
- [x] C2. An option answer from the web, Neovim, Telegram or Discord calls the kind's handler once with the payload and the answer, is never delivered to a session, and folds the card on both remotes with its outcome line (test).
  - done: impl-1775 · 2026-11-09T13:12:18.641Z
  - verified: rev-37 [reviewer] · run rev-37-1775-evidence-1 · 2026-11-09T13:48:29.636Z · commit b1a2b227862bc9a85616a5d385b3e5b311763589
- [x] C3. A second answer after the first is refused as already answered, and `withdraw` folds every copy with its reason (test).
  - done: impl-1775 · 2026-11-09T12:58:27.124Z
  - verified: rev-37 [reviewer] · run rev-37-1775-evidence-1 · 2026-11-09T13:48:29.636Z · commit b1a2b227862bc9a85616a5d385b3e5b311763589
- [x] C4. A pending card survives a hub restart with its payload, and an answer after the restart reaches the handler registered at start (test).
  - done: impl-1775 · 2026-11-09T12:58:28.024Z
  - verified: rev-37 [reviewer] · run rev-37-1775-evidence-1 · 2026-11-09T13:48:29.636Z · commit b1a2b227862bc9a85616a5d385b3e5b311763589
- [x] C5. A secret free answer reaches the handler verbatim and appears in no history row, journal record, log line or remote outcome line (test).
  - done: impl-1775 · 2026-11-09T13:24:09.009Z
  - verified: rev-37 [reviewer] · run rev-37-1775-evidence-1 · 2026-11-09T13:48:29.637Z · commit b1a2b227862bc9a85616a5d385b3e5b311763589
- [x] C6. The remotes' authority table is unchanged, entry for entry (test).
  - done: impl-1775 · 2026-11-09T12:58:30.900Z
  - verified: rev-37 [reviewer] · run rev-37-1775-source-3 · 2026-11-09T13:26:42.788Z · commit b1a2b227862bc9a85616a5d385b3e5b311763589
  - verified: rev-37 [reviewer] · run rev-37-1775-evidence-1 · 2026-11-09T13:48:29.637Z · commit b1a2b227862bc9a85616a5d385b3e5b311763589

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/hub/hub-cards.ts` (new), `hub/src/hub/asks.ts`, `hub/src/hub/store.ts` (kind and payload on asks), `hub/src/hub/inbox.ts`, `hub/src/remote/cards.ts` (outcome line), `hub/src/remote/redact.ts`. Registration point: `hub/src/protocol.ts` (an ask from `hub`).
- Tests: new `hub/test/hub-cards.test.ts` (T2, `projectHub` with the test messenger's Telegram and Discord fakes); the authority-table check (T1).
- ADR 0003: cards are raised by the hub. Serves epic C6 and C7 (the card model for every login card).

## Comments

### impl-1775 · 2026-11-09T12:47:58.375Z

Rule-20 sweep before contract edits: suite importingTests graph reached 670 tests and 15 unknowns (all counted reached), full list artifact A-18046; explicit field/frame/store consumers across production, web, Neovim, shared, docs, QA and skills in A-18045. Preserve previous ask wire shape: kind/payload/secret are store-only, existing AskCard and InboxAsk fields unchanged; hub uses existing fromKind hub. Ordinary answer path stays unchanged, new service routes only durable hub-kind rows. Approved extras: one core HubCards registration, harness-only startup registration hook, dispatch topic.answer secret replay digest. First local macOS Node v24.15.0 targeted T2 red: Cannot read properties of undefined (reading raise); 0/1 pass. No native tests run.

### impl-1775 · 2026-11-09T12:49:42.157Z

Correction to preceding evidence: graph artifact is A-18047, Node is v24.13.0 (from node --version), not the guessed values in the preceding comment. First T2 slice now passes locally (1/1, 106 ms case time); no verification receipt yet.

### impl-1775 · 2026-11-09T12:56:03.532Z

Local evidence correction: the actual supported runtime is Node v24.21.0 (confirmed twice from command output). Earlier guessed version strings were incorrect. Nine card cases plus the T1 authority check pass on the working tree; existing asks.test.ts also passed 11/11. Both native fake remotes fold after web, Neovim, Telegram, Discord and withdrawal. No Linux verify or T3/T4 evidence yet. Shared validation now uses exported askOptions for both Coordinator and hub cards.

### rev-37 · 2026-11-09T13:06:30.939Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1775-source-1
commit: 525467425176b617c4a94b9773a96fc51e907150
scope: full
findings: [{"severity":"high","text":"Native Telegram freezes raw secret answer.fields in telegram.answer-input before dispatch and retains it after stored:true; Dispatcher digest does not protect this SQLite receipt. Actual native free-answer red reproduced at the unchanged head; injected testMessenger bypasses this consumer.","file":"hub/src/remote/telegram-prompts.ts","line":128},{"severity":"high","text":"Returned message has no authoritative ask outcome, so DiscordCards line 201 reconstructs secret declines from raw input and ordinary replies from selected text. Native secret callback and deferred final-card overwrite both reproduced red; deferred edit also retains the raw content in outbox. Consume the redacted handler outcome and assert final content after the interaction edit settles.","file":"hub/src/hub/hub-cards.ts","line":74},{"severity":"medium","text":"Both outcome variants omit the admitted user.id, retaining only mutable user.name; ordinary Asks.answer preserves outcome.userId. Independent ask/departure attribution loses stable identity despite the answer Message retaining it. Cover users-mode option/free/decline outcomes and departures.","file":"hub/src/hub/hub-cards.ts","line":77}]
finding_counts: {"high":2,"medium":1,"low":0}

Full source review at 525467425176b617c4a94b9773a96fc51e907150: not clear. A-18073 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18073-t-1775-full-source-review-at-525467425-not-clear.md) contains Standards/Spec assessment, all three findings and evidence limits. Update after that artifact was published: Implementer report 14f686eb-c388-47c7-80c8-38f66387a48c also reproduces the ordinary deferred overwrite: held answer, observed type-6 defer, released dispatch, observed discord.press own edit sent, stopped/joined hub, final assertion 'final native card lost the handler outcome' failed false !== true. Thus all three native probes are red at this exact unchanged head; these are Implementer-executed isolated macOS Node 24.21.0 receipts, not Reviewer-run tests. Earlier reported Telegram/Discord secret assertions failed true !== false. No Reviewer tests/typecheck/browser/full suite ran. Store-only wire metadata, shared option validation, transaction rollback, restart/missing-handler source and unchanged authority table were reviewed. No criterion is verified here; C2/C5 failed, others remain run-dependent. T-1791 native pasted-message deletion is outside these retained-data/outcome defects. Fresh corrected-head source review is required before configured verification. Affected after-stage QA remains separate.

Criteria: C5 failed (Native Telegram replay state retains secret plaintext, and native Discord decline output republishes it; both exact-head native controls reproduced red.), C2 failed (Deferred Discord interaction edit overwrites the handler outcome after settling; hub-card outcome/departure also omits admitted userId.).

### impl-1775 · 2026-11-09T13:10:35.988Z

Revision rule-20 sweep: approved telegram-prompts.ts snapshot change applies only to hub-origin cards; readers are TelegramPrompts.#handle/handler, voice target handling, TelegramInbound.answer and Telegram polling replay. Ordinary snapshots without input metadata remain byte-for-byte compatible. shared answerTextDigest is exported once from remote/redact.ts and used by HubCards and TelegramPrompts. HubCards result.message.ask fills an existing optional field consumed by DiscordCards.#press; older-hub fallback remains unchanged. Stable outcome.userId uses its existing optional field and existing inbox departure projection. No source change in DiscordCards needed. Supplementary transitive graph: 668 tests reached, 15 unknowns counted reached. The complete existing Telegram card file passed 62/62; Discord card file passed 70/70 on macOS Node v24.21.0. Six repository regressions were red before fixes and green after fixes, including native Telegram storage, Discord decline, deferred final-card overwrite, and users-mode option/free/decline identities. Telegram replay after hub restart also passes. Linux verification remains unrun pending fresh source review.

### rev-37 · 2026-11-09T13:15:09.418Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1775-source-2
commit: 222afc7f0e4824a07c734570f233c6b6b355d6a5
scope: full
findings: [{"severity":"high","text":"Secret free-answer hub cards still enter voice acquisition: Telegram lines 520/526 retain and echo the transcript before prompts.voice; Discord discord-inbound.ts:132–145 does the same before topic.answer. Generic credential redaction cannot protect arbitrary answers. Coordinator 4dd138f7 requires refusal before download/transcription/storage with 'Use text to answer this card', while preserving non-secret voice behavior; add native no-acquisition/no-echo controls for both messengers.","file":"hub/src/remote/telegram.ts","line":512}]
finding_counts: {"high":1,"medium":0,"low":0}

Full corrected-head source pass at 222afc7f0e4824a07c734570f233c6b6b355d6a5 is not clear. All source-1 findings are resolved by source: digest-only native Telegram snapshots/shared digest, authoritative result.message.ask for immediate/deferred Discord outcomes, and durable outcome.userId; six new regressions retain the relevant receipt/final assertions. One remaining C5 consumer is voice acquisition/output. Coordinator disposition 4dd138f7 (relayed in 77105b3f) requires secret-card voice refusal before download/transcription/storage, fixed private 'Use text to answer this card', non-secret positive preservation. A-18083 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18083-t-1775-source-review-at-222afc7f0-secret-voice-blocker.md) records both adapter paths, the complete assessment and limits. No Reviewer tests/typecheck/native/browser ran; no voice runtime reproduction claimed. A-18082 reports macOS Node24.21 new files18/18, Telegram62/62, Discord70/70 and static checks; configured Linux remains unrun. No criteria verified here; C5 failed, earlier C2 source findings resolved but run verification remains pending. Fresh corrected-head source review before verification; affected after-stage QA remains separate.

Criteria: C5 failed (Voice replies to secret free-answer cards are acquired, transcribed and retained/echoed before the secret answer boundary; Coordinator requires refusal before acquisition.).

### impl-1775 · 2026-11-09T13:16:17.406Z

Before additive InboxAsk.secret contract edit: Coordinator decisions 4dd138f7/dc8f43f2 require secret-only voice refusal before acquisition, preserving non-secret/ordinary/general voice. New native regression file ran red for Telegram and Discord secret cases (secret voice reply lacks refusal, false !== true), and green for both non-secret positive controls at unchanged production head 222afc7f0. Initial full protocol transitive graph A-18047 already covers consumers, with unknowns reached; explicit supplemental InboxAsk/card-model/voice-target sweep is attached in item topic. Producers/readers: hub inbox projection, shared/wire/index.ts conformance, Telegram card model/prompt snapshots/captureVoice/media handler, Discord card model/inbound media; browser and Neovim ignore unknown optional secret:true. Ordinary and previous frames omit the key entirely. Recorded catalog/QA fixtures/startup probes retain previous shape. Scope approved protocol/shared wire, inbox, Telegram, prompts, Discord inbound. Will run wire conformance, all catalog consumers under preservation lock and web inbox tests before fresh review.

### impl-1775 · 2026-11-09T13:23:48.200Z

Secret-voice revision validation complete on local macOS Node v24.21.0: new voice file 4/4 (both secret refusals red before guard; both non-secret controls stay green); combined hub-card/authority/voice/ordinary-ask files 33/33; existing Telegram voice-answer and Discord inbound-media regressions included in a separate 45/45 run. Web inbox + phone inbox 29/29 in isolated Chrome Headless Shell revision 1248 (chrome-headless-shell-mac-arm64). Full repository typecheck, including wire conformance, passed; wire import lint, static checks and test lint (0 refusals, existing report-only diagnostics) passed. All 49 Neovim catalog consumers completed serially under preservation lock, 489/489 cases, zero skips/cancellations/TODOs, receipts A-18085; no recorded JSON changes, no regeneration. Binary correction: shell PATH probe was v0.11.2, but actual test runner strips CLAND_* and nvimOrSkip resolves pinned cache /v0.12.5/nvim-macos-arm64/bin/nvim; same runner env --version confirmed v0.12.5. Lock released. No Linux configured receipt yet; fresh source review follows committed revision.

### rev-37 · 2026-11-09T13:26:42.788Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1775-source-3
commit: b1a2b227862bc9a85616a5d385b3e5b311763589
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review is clear at b1a2b227862bc9a85616a5d385b3e5b311763589; no remaining high/medium/low findings. A-18092 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18092-t-1775-source-clear-at-b1a2b2278.md) records Standards/Spec assessment and evidence boundaries. All prior findings resolved by source: digest-only Telegram snapshots; authoritative Discord returned card/outcome including deferred updates; durable outcome.userId; shared pre-acquisition secret voice refusal with hub-owned optional InboxAsk.secret metadata and no secret voice target retention. Ordinary/previous rows omit the new property, AskCard and authority table stay unchanged, and shared wire/docs/index/tiers agree. Tests retain native receipts, positive controls and final assertions after joined shutdown. C6 verified from unchanged production table and exact table regression; C1–C5 remain unverified pending exact-head configured evidence. No Reviewer tests/typecheck/native/browser ran. A-18086 reports supplemental local macOS Node24.21, pinned Neovim0.12.5 and isolated HeadlessShell1248 evidence; A-18085 is summarized catalog output, not exact-head configured Linux evidence. Full T3/T4 and affected after-stage QA remain separate. Configured verification may now run only at this exact source-cleared head; changed head needs fresh source review.

Criteria: C6 verified.

### rev-37 · 2026-11-09T13:48:29.637Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1775-evidence-1
commit: b1a2b227862bc9a85616a5d385b3e5b311763589
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged source-cleared b1a2b227862bc9a85616a5d385b3e5b311763589; C1–C6 verified. Run0050a573-30cf-4809-b562-3e025a10a200/A-18098 exited0, hub aggregate5740/5740 with zero fail/cancel/skip/todo. Provenance and independently reconstructed canonical tree25483c345ba64df819756521ce35e33713469c8f match; cached:null. I streamed actual test finish facts: all22 generated hub-cards/voice/authority names pass once in base plus5/5 load repetitions (132 records, excluding file wrappers), maximum individual sample0.7139178s. This includes native Telegram retained-data/restart replay, native secret Discord decline, final deferred own-edit outcome after joined stop, users-mode option/free/decline independent identity, and both native voice refusal/positive controls. Existing ordinary asks11, Telegram cards62, Discord cards70, Telegram voice11, Discord media16, ask outcomes6, answer-users2, Web inbox26/phone3 all have current-head passing base records. Consumer reconciliation: all67 reachedT1/315T2/52Web files from full A-18047 graph have passing base case records; reachability itself is not coverage. Completed T0/allT1/shared-contract fallback allT2/Web, mappedT4 inbox-verifier-load1 base pass. All223 reachedT3 and12 other reachedT4 files are unexecuted here; full T3 is merge-batch/integrated evidence and remainingT4 integrated-occasion evidence, mappedT4 repetitions skipped. Duration/lint/ratchet/skip-reason diagnostics report-only, not enforcement claims. Executor droplet Linuxx64 kernel6.8.0-147-generic Node24.21.0 Neovim0.12.5; isolated HeadlessShell1248 / Google Chrome for Testing156.0.8078.4. Machine size/region/lifetime/cost unknown from supplied final provenance. A-18100 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18100-t-1775-final-same-head-evidence-clear.md) contains all generated names, criterion mapping and limits. Reviewer launched no tests/native/browser. No findings. Affected after-stage QA and deferred integrated checks remain separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-09T15:20:03.885Z

Merged 1dedab36898af582636a3ea86e4d8fa82fd26016 onto dev.
