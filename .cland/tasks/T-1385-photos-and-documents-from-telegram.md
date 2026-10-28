---
id: T-1385
kind: task
title: Photos and documents from Telegram become the human's artifacts on one message, through a durable media queue, and no paired update stalls the poll loop
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1381
  - T-1382
topic: topic-1140
branch: t/T-1385-photos-and-documents-from-telegram
created: 2026-10-27T23:37:27.517Z
updated: 2026-10-28T09:49:57.416Z
---

> Overlap: T-1378 (Bugs, regression of T-1341) proposes a smaller fix for the same poll-loop stall and awaits the human's answer to ask 82ff046e. If T-1378 lands first, build on it and keep its tests; otherwise this ticket's fallback reply closes T-1378's criteria too.

## Summary

A photo or document from the paired human becomes their message in General, or a reply in the replied message's topic. The file is an artifact and the caption is the text, with `via = "telegram"`. The item is stored in a durable media queue before the offset is confirmed. A file over 20 MB gets a reply saying so, and the token-bearing URL never leaves the hub. Every other message kind gets a one-line reply instead of stalling the loop.

## What to build

**The durable media queue.** A messenger-neutral media module (`media.ts`) owns a durable per-chat queue in `hub.db`, keyed by chat and message id.
- The poller's media handler records the attachment's facts: kind, `file_id`, name, MIME type, declared size, duration, caption, reply target and `date`. It resolves only once that record is durable, so the offset follows it.
- A per-chat worker drains the queue in order, and recovers it at start.
- An ordinary text that arrives while the chat has queued media is queued behind it. Presses, commands and prompts are not.

**Each item.**
- A photo takes its largest size, named `photo-<message id>.jpg` as `image/jpeg`. A document keeps its name and MIME type, with `application/octet-stream` when absent.
- A declared size over the limit gets one reply and no download: "<name> is 25 MB: a bot can download at most 20 MB, so it was not stored". The limit is 20 MB or `max_upload_mb`, whichever is smaller.
- Otherwise the bytes are downloaded through ticket 01's capped download and passed to `artifact.upload` beside the frame, with the ingress id, the caption as text (formatting dropped), and General or the replied message's topic.
- The 👌/👀 receipts work as for text, and the late-message suffix of T-1348 applies to the caption.
- A failure gets one reply, and the item stays queued only for transient errors.
- Audio files, video notes and videos are stored the same way here. Voice and transcription come in ticket 08.

**The fallback.** Stickers, locations, contacts, polls, edited messages and every other kind from the paired human get one reply ("This kind of message does not reach General") and are confirmed.

**Shared contract:** none beyond ticket 02's frame. Spec §3.6 (inbound files), §3.9 (store, then confirm) and §3.12.

## Acceptance criteria

- [x] C1. A photo with the caption "the error" sent on the fake arrives as one General message from `human` "via Telegram" with that text and one `.jpg` artifact whose bytes match the largest size, and the photo message gets 👌 (test).
  - done: impl-1385 · 2026-10-28T08:20:37.586Z
  - verified: rev-32 [reviewer] · run rev-20261028-1385-final · 2026-10-28T09:09:26.339Z · commit d88826124244b561668ecf1d283217eebb38860c
- [x] C2. A document replying to a mirrored message in an item topic lands in that topic as a reply carrying the document artifact with its name, and a document without a caption arrives with an empty text and the artifact (test).
  - done: impl-1385 · 2026-10-28T08:20:37.709Z
  - verified: rev-32 [reviewer] · run rev-20261028-1385-final · 2026-10-28T09:09:26.339Z · commit d88826124244b561668ecf1d283217eebb38860c
- [x] C3. A document declared as 25 MB gets the 20 MB reply, `getFile` is never called for it, and nothing reaches General (test).
  - done: impl-1385 · 2026-10-28T08:20:37.964Z
  - verified: rev-32 [reviewer] · run rev-20261028-1385-final · 2026-10-28T09:09:26.339Z · commit d88826124244b561668ecf1d283217eebb38860c
- [x] C4. After a stopped hub restarts on a media item that was stored and confirmed but not yet uploaded, it is uploaded exactly once, and a text sent after it reaches General after it (test).
  - done: impl-1385 · 2026-10-28T08:33:41.700Z
  - verified: rev-32 [reviewer] · run rev-20261028-1385-final · 2026-10-28T09:09:26.339Z · commit d88826124244b561668ecf1d283217eebb38860c
- [x] C5. No frame, hub log line, journal record, artifact or General message produced by these cases contains the made-up token or a `/file/bot` URL, and a sticker and an edited message each get the one-line reply while a later text still reaches General (test).
  - done: impl-1385 · 2026-10-28T08:20:38.216Z
  - verified: rev-32 [reviewer] · run rev-20261028-1385-final · 2026-10-28T09:09:26.339Z · commit d88826124244b561668ecf1d283217eebb38860c

## Notes

Shared files: hub/src/remote/telegram.ts, hub/src/remote/telegram-inbound.ts, hub/src/remote/state.ts, hub/src/remote/media.ts (new)

## Comments

### impl-1385 · 2026-10-28T08:16:13.266Z

Implementation uses existing artifact.upload native byte port and ingress id, no wire change. Consumer inventory for changed fallback semantics: telegram.ts final handler; telegram-inbound.test.ts unsupported/restart/edit expectations; docs/agents/tests/hub-test-telegram-inbound.test.ts.md; hub/README.md Telegram inbound section. Search also covered all hub/web/nvim test tiers, QA briefs, skills and startup probes; no other fallback-string consumer. The messenger factory persistence gains an optional internal maxUploadMb getter; daemon is its production supplier and existing injected factories remain compatible. First photo test red: 'photo stored reaction: not within 2000 ms'; green after implementing queue/upload. Targeted new restart receipt now green.

### rev-32 · 2026-10-28T08:25:10.849Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1385-source
commit: ee70c2a4c6ad7389b5f3f1ffb075a47fe8e21a05
scope: full
findings: [{"severity":"high","text":"M2 Spec: pairing is checked only before awaited native I/O; unpair/replacement during getFile/download can still publish the old chat's artifact and human message. Revalidate captured authority at resume and actual upload commit, with held-I/O/unpair/replacement controls.","file":"hub/src/remote/telegram.ts","line":392},{"severity":"medium","text":"M1 Spec: enqueue between the last-empty observation and deferred finally owner removal sees an active worker but launches no successor; confirmed FIFO work can remain stranded. Make handoff atomic/recheck and cover enqueue at settlement with final order/completion assertions.","file":"hub/src/remote/media.ts","line":47},{"severity":"medium","text":"M3 Spec: swallowing fatal #track rejection after native 401/403/409 lets the aborted polling lifetime resolve, so Gateway never saves disabled/stopCause and unchanged reload sees no restart need. Propagate fatal completion through the observed remote lifetime; assert status/notice/drain/reload recovery.","file":"hub/src/remote/media.ts","line":39},{"severity":"medium","text":"M4 Standards: new native/UI observers bypass pacingOwner; fake default deadlines begin before acquisition and failed setup does not own/join observers. Register them before actions, separately bound setup/drain, observe exact held-getFile connection close, and cover omitted/aborted media setup while retaining final assertions.","file":"hub/test/telegram-inbound.test.ts","line":550}]
finding_counts: {"high":1,"medium":3,"low":0}

Consolidated full source audit A-13125. Standards: M4 medium; Spec: M2 high, M1/M3 medium. Source traces checked against actual gateway upload authorization, remote.unpair, ConfiguredGateway restart and pacingOwner, not executed reproductions. Ten files/one commit; no further findings in bytes/metadata/cap, ingress-id reuse, reply routing, late suffix or documented fallback changes. A-13122 is partial local Darwin summary (some T3 at preceding working tree); no configured/Linux/Web/load receipt. C4 failed; other runtime criteria remain unverified. Preserve assertions and original command receipts; fresh corrected committed head requires full source review before mode-free verification. Coordinator's separately authorized full verify all remains before enqueue.

Criteria: C4 failed (The FIFO can lose its drain owner when confirmed work arrives between the final empty check and asynchronous owner release.).

### impl-1385 · 2026-10-28T08:25:11.570Z

Before changing artifact.upload admission for M2, consumer inventory: production native upload path TelegramInbound -> RemoteSend/Gateway -> Dispatcher clientRequest -> uploadArtifacts authorize callbacks; web edge HTTP and composer socket producers (no via, unaffected); testMessenger/gateway artifact-upload.test.ts (old unpaired fake shape remains supported); gateway/web authority tests; all artifact.upload searches in hub/web/nvim/shared, QA briefs, test guides and implement skill. Only trusted gateway uploads with a captured pairing gain repeated current-pairing validation; existing optional via/messageId/bytes signatures and old unpaired injected test clients unchanged. No new wire fields. Telegram media record gains optional numeric pairing metadata, old records remain readable.

### rev-32 · 2026-10-28T08:35:38.421Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1385-source2
commit: 6e3cfdd5fdc9d3ee439ddd3016b930af96758bc8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source audit A-13137 carries A-13125 and all eight correction files; parent is exact reviewed ee70c2a4c, no dev merge. M1 successor recheck repairs last-owner handoff; M2 captured pairing is rechecked after native I/O and through uploadArtifacts authorize at actual commit, with held native/preparation revocation controls; M3 saved terminal error propagates after native poll drainage to Gateway disabled/reload handling; M4 pre-owned fake/UI observers, separate setup/drain bounds and exact held-media close controls retain final assertions. Standards 0, Spec 0 outstanding findings. Expanded dispatcher consumer inventory/doc/skill CHANGES are consistent; old unpaired injected and no-via paths remain compatible. C4 done restored; C1–C5 runtime verification remains pending exact-head configured named-case evidence. A-13134 labels local Darwin source evidence and intermediate failed/cancelled controls; preserve complete original outputs/exits/timings without transcription reruns. One mode-free verify may proceed at this head; Coordinator's separately authorized full verify all is still required before enqueue after final evidence review.

### rev-32 · 2026-10-28T08:37:02.749Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1385-preflight
commit: 6e3cfdd5fdc9d3ee439ddd3016b930af96758bc8
scope: full
findings: [{"severity":"medium","text":"M5 Standards: renamed edit test retains old measured duration identity 'Telegram silently confirms an edit and delivers the following text'; unchanged verify-tiers refuses admission. Migrate the key to the exact new identity, preserving 0.109134 and any matching allowance metadata; retain owning guard red/green.","file":"hub/test/durations.json","line":8081}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13138 records actual preflight refusal 2fa79749 and pinned source confirmation. This migration was missed in source2/A-13137; new finding supersedes that clearance. M1–M4 remain source-resolved. No runtime occurred and tracker verify is null; no criteria failed solely for admission refusal. Fresh corrected-head source review before any submission; no guard relaxation or alternate path.

### rev-32 · 2026-10-28T08:38:19.342Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1385-source3
commit: 57a17374fee667550cbaeaf3654707fc67b1b481
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13141 carries full source2 A-13137 and preflight correction A-13138. Sole diff from exact reviewed parent 6e3cfdd5 is owned edit-test duration identity migration to the shipped title; measured 0.109134 and all remaining manifest bytes/metadata preserved, unchanged guard. M5 resolved; M1–M4 source/test resolutions unchanged. A-13140 retains original admission-only refusal and unchanged guard red1/green0 on local Darwin arm64 Node24.21.0; no runtime or Linux pass attributed. Standards 0, Spec 0. C1–C5 remain runtime-unverified pending exact-head configured named-case evidence. One mode-free verification may proceed; Coordinator's separate full verify all remains before enqueue after final evidence review.

### impl-1385 · 2026-10-28T08:51:14.517Z

Coordinator decision 5c082a6d (topic-1140): T-1385 supersedes T-1378's silent edit confirm with the explicit one-line edit reply required by this item's body/C5. Edits retain the poller's one-reply fallback and never the former hold. Failed Linux run 2cb65551/A-13148 exposed missed shared fallback consumer telegram-cards.test.ts:1671; original error '0 !== 1'. Focused red control inserted a new-wording exactly-one assertion before the retained old expectation; the new count passed and old expectation failed at1672, proving actual sticker delivery. Migrated only expected wording and matching per-file guide, preserving count, serial sticker/button, offset and final answer/edit assertions. Corrected consumer inventory now includes this card test.

### rev-32 · 2026-10-28T08:51:23.810Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1385-evidence1
commit: 57a17374fee667550cbaeaf3654707fc67b1b481
scope: evidence
findings: [{"severity":"medium","text":"M6 item-owned compatibility: run 2cb65551/A-13148 fails 0 !== 1 because the sticker/button test still counts old fallback text. Migrate only expected copy to shipped 'This kind of message does not reach General', preserving one-reply count, serial handler/callback and final outcome assertions; fresh source review before retry.","file":"hub/test/telegram-cards.test.ts","line":1671}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13150 audits original failed configured receipt at source3 head. Exact assertion/error precedes classification: old-copy consumer, not shared defect/flake. Ordinary completed3195/3196, one test/file failure;125 separate load passes. Inbound32/32 plus100 explicit load passes, peak1.352329296s, native file finish9.447564111s. Host T0 separate33.872s/gate1b83f734; Linux c-8 lon1 cland-v0-35056157 Node24.21/Nvim0.12.5 workers2 T1 passed, fallback T2 failed; Web did not run, T3/T4 unselected. Machine lifetime517s/$0.0359 not suite wall; budget/lint report-only134/61. M1–M5 remain source-resolved; all C1–C5 runtime-unverified, no semantic criterion failed solely for stale test expectation. Hold submissions, correct owning consumer, request fresh source review before a new configured run. Coordinator full verify all remains later.

### rev-32 · 2026-10-28T08:52:33.845Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1385-source4
commit: d88826124244b561668ecf1d283217eebb38860c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13153 carries full source2/A-13137, source3/A-13141 and failed evidence/A-13150. Exact two-file correction migrates sticker/button expected fallback copy while retaining count=1, held/serial/open/offset/final answer/native edit assertions, plus matching guide. Pinned old-copy search has no remaining consumer. M6 resolved; M1–M5 unchanged/resolved, no production or duration identity change. A-13152 local Darwin original red/control and green62/62/tiers0 receipts retain Node vs tool-wall limits; no configured/runtime promotion of old failed run. Standards0, Spec0. C1–C5 runtime-unverified. One fresh mode-free verify at this head, then final original-record review; Coordinator separately owns full verify all before enqueue.

### rev-32 · 2026-10-28T09:09:26.339Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1385-final
commit: d88826124244b561668ecf1d283217eebb38860c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record audit A-13163 carries source4/A-13153 and full source2/A-13137. Fresh exact-head configured74f4f9e5/A-13161 exited0,3859 ordinary passes/497files with no fail/cancel/skip,125 separate load passes. Inbound32/32 and20 new identities exactly5/5 each=100 explicit load passes; worst1.405704420s, no new allowance needed, native file finish10.423631836s distinct from9.52s case aggregate. Named photo/docs/cap/restart/FIFO, owner handoff, held-I/O and actual commit revocation, six fatal/reload and two setup/drain controls all pass. Token/URL sink scans and unsupported/edit/following-text assertions support C5; corrected sticker/button identity passes0.153167383s with original count/serial/outcome assertions. C1–C5 verified. Host T0/check32.734s at excluded gatea5a50685 separate from Linux runtime; c-8lon1 cland-v0-288973c1 Node24.21/Nvim0.12.5 workers2, ordinary Web4, T1/all fallback T2/Web pass. T3/T4 unselected, no full cover claimed. Machine lifetime844s/$0.0586 not suite wall; isolated HeadlessShell156.0.8078.4/1248. Budgets/lint/ratchet report-only134/61. Prior preflight refusal and failed2cb65551/A-13148 stay retained old-head evidence. Standards0, Spec0. Coordinator's separately authorized full verify all remains required before enqueue; this task evidence verdict does not satisfy it.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-32 · 2026-10-28T09:28:20.900Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1385-delta1
commit: 919a22410a4cb988e8546037b1e25ed567434cb4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13176 audits Coordinator003a6abc-authorized dev integration: parents accepted d8882612 + dev95e764b1, treeae276486. Carries full source4/A-13153 and old-head final/A-13163. Both skill guidance sections and CHANGES retained. Native media/FIFO/pairing/commit/fatal logic, Telegram tests/guides, caption/cap/reply/receipts and exact duration key/value are byte-identical to accepted task; upstream Discord union/notice additions preserve Telegram mappings. Both-parent/combined diff has no integration findings. A-13174 true serial Darwin inbound32/cards62/typecheck/tiers exit0; overlapping earlier attempts separately labelled. Old A-13161 stays old-head; full400100f9/A-13172 cancelled143 before T0 completion, runtime counts unavailable. C1–C5 runtime marks stale at new head, not reverified here. One fresh mode-free configured run then final original-record review; Coordinator separately owns full verify all before enqueue.

### rev-32 · 2026-10-28T09:45:44.923Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1385-evidence2
commit: 919a22410a4cb988e8546037b1e25ed567434cb4
scope: evidence
findings: [{"severity":"medium","text":"E2 Evidence: configured14b05884/A-13184 exits1; actual locator.waitFor Timeout3000ms waiting for initial 'Live fixture stage' row. No merged-head passing configured receipt; candidate shared defect pending Coordinator classification, no media-source diagnosis.","file":"web/test/items.test.ts","line":57}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13185 audits exact merged-head original result. T0/T1/allfallbackT2 pass, Web fails; ordinary3868/3869 and one failed case/file,125 separate load passes. Inbound32/32 plus20×5load=100pass, max1.386984020s, native file10.910820602s distinct from reporter9.691s aggregate. Host T0 separate35.962s/gatebe635cfd; Linux c-8nyc1 cland-v0-16d743f1 Node24.21/Nvim0.12.5 general/load2/Web4, isolated HeadlessShell156.0.8078.4/1248. Lifetime903s/$0.0627 not suite wall; T3/T4 unselected; budgets/lint report-only134/61. C1–C5 remain stale/runtime-unverified; no criteria failed solely for external Web failure. Delta sourceA-13176 retained, old-headA-13161/cancelledA-13172 not current passes. Freeze head and await Coordinator disposition before retry/fix; changed head needs review. Full verify all gate remains.

### impl-1385 · 2026-10-28T09:46:12.285Z

Coordinator disposition a935c06c-492d-4270-ad49-278bd966693b (topic-1140): run14b05884 at919a22410/A-13184 is accepted as item evidence despite its sole Web failure, attributed by Coordinator to shared dev defect T-1419 (assigned impl-1419, reported on three other branches). This item's diff touches no web/ file. Exact failure: web/test/items.test.ts::the Items tree reads the copied live tracker snapshot, items.test.ts:57, locator.waitFor Timeout3000ms waiting for 'Live fixture stage' visible. Run remains exit1/Web red; this disposition does not relabel it green. T0/T1/T2 complete/pass; own inbound32 ordinary +100 explicit load pass. Head frozen; no Items diagnosis/edit/retry here. Coordinator submitted separate full verify all at919a22410 and will accept only T-1419 identities by the same disposition before enqueue.

### impl-1385 · 2026-10-28T09:49:57.416Z

Correction: Coordinator message3b3d3b87 (Agents,09:49:32Z) supersedes acceptance a935c06c. The failed T-1419 Web run14b05884/A-13184 cannot carry ready and is retained as failed history only. Hold919a22410 frozen until T-1419 lands and Coordinator authorizes rule11 dev merge. Then rerun touched files, delta source review, mode-free verification with actual green receipt, final evidence review. Coordinator full verify all07de2f02 continues for pre-merge T3 evidence; Coordinator states the upcoming T-1419 test-only merge will not invalidate that T3 evidence.
