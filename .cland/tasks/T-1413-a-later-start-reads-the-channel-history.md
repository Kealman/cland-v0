---
id: T-1413
kind: task
title: A later start reads the channel history back to the last id, re-sends every open card and adds the gap line
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1412
topic: topic-1171
branch: t/T-1413-a-later-start-reads-the-channel-history
created: 2026-10-27T23:38:48.468Z
updated: 2026-10-29T04:26:00.428Z
---

## Summary

When no resume is possible, the hub identifies afresh. It reads the channel's history back to the last message it processed and posts what it finds to General in order, marked late, at most 500 messages. It then adds one silent gap line when General messages were missed, and re-sends every open card at the bottom. A crash during the catch-up loses and duplicates nothing.

## What to build

**Reading history.** After a fresh identify with a stored cursor, the hub compares the cursor with the channel's `last_message_id` and stops if they match. Otherwise it pages back with `before`, newest first and 100 a page, until it reaches the cursor. It filters the messages by 05's inbound rules and deduplicates them by id against live events. It posts them in ascending order, each marked late with its Discord time. Past 500 it passes the newest 500 and posts one silent line in the channel saying the older ones were not passed on. The cursor advances after each stored message, so a crash resumes where it stopped.

**Then, in §3.9's order:**
1. the neutral gap line (`flushGap` with Discord's matcher), silent, only when N is above 0;
2. the cards and outcome edits that never got through;
3. every open card re-sent at the bottom with its old copies marked "↓ Re-sent below".

The fake's control posts messages while the hub is down and holds `last_message_id`.

Spec §3.8 (history catch-up), §3.9; research rule 32.

## Acceptance criteria

- [x] C1. Two messages typed during a three-minute restart reach General once each, in order and marked late, and every open card is re-sent at the bottom with its old copy marked "↓ Re-sent below" (test).
  - done: impl-1413 · 2026-10-29T03:43:33.186Z
- [x] C2. 620 messages typed during an outage pass the newest 500 to General in order, with one line in the channel saying the older ones were not passed on (test).
  - done: impl-1413 · 2026-10-29T03:54:14.827Z
- [x] C3. A hub killed in the middle of the catch-up passes no message twice and loses none after the next start (test).
  - done: impl-1413 · 2026-10-29T03:54:14.920Z
- [x] C4. General messages missed during an outage give one silent "N General messages missed since HH:MM" line before the re-sent cards, and none when N is 0 (test).
  - done: impl-1413 · 2026-10-29T03:54:15.013Z
- [x] C5. A last message id above 2^53 survives the restart as identical TEXT in `hub.db` and pages back exactly to it (test).
  - done: impl-1413 · 2026-10-29T03:43:33.699Z

## Notes

Shared files: discord-catchup.ts, discord.ts

## Comments

### impl-1413 · 2026-10-29T03:25:15.479Z

Consumer inventory before additive recovery changes: discord.lastMessageId is produced by discord-inbound.ts, read in discord-messages.test.ts and documented in hub/README.md. New history path will reuse unchanged DiscordApi getChannel/listMessages, DiscordDispatch, gateway ingress, RemoteStore TEXT values, DiscordOutbox payload and replay-press shape. Consumers searched across hub/src, hub/test (all tiers), web, nvim, qa, docs and .agents: discord.ts owns replay coordination; discord-cards.ts owns replay intents/publication; discord-outbox.ts owns native mappings; discord-socket.ts owns READY/RESUMED; fake-api/gateway own native history/session replay; discord-{api,messenger,messages,cards} tests exercise them. Neutral gap consumers (telegram-gap, remote-neutral tests) remain unchanged. No public frames, schema or refusal change; old outbox/sessionless fixtures remain compatibility controls. Pre-agreed seams: production frame port and fake native REST/ws.

### impl-1413 · 2026-10-29T03:40:00.139Z

Measured C2 failure: 140134 ms macOS/local with repeated all-outbox scans and persisted unavailable backlog; yield-only and initial SQL-filtered reads still failed the 15 s receipt. CPU profile ~95% in outbox SELECT/JSON decode. Corrected startup availability after authenticated check plus pending-state/exact-id reads: C2 passed 7171 ms macOS/local (pacing excluded). Shared consumer scope expanded before finalization: RemoteStore.outbox optional SQL filters and neutral Outbox candidate/exact-id reads preserve no-argument shape; consumers include Telegram and Discord queues plus direct native outbox fixtures. Coordinator requested telegram-{catchup,gap,pacing,notices} local files sequentially. Native process SIGKILL test added to existing T3 telegram-polling-restart file, passed macOS/local 10489.8 ms; Linux timing/allowance pending. Production dispatcher adds only parallel Discord test crash sentinel to existing Telegram committed-input test hook; public frames unchanged.

### rev-26 · 2026-10-29T03:49:07.927Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1413-source-1
commit: 9876835a6246df5b4798bc834e4e37d62489b57a
scope: full
findings: [{"severity":"medium","text":"M1: RESUMED bypasses persisted or still-running history batch and can unlock cards/live input before it finishes. Join active history owner or drain durable checkpoint on resumed recovery; cover actual resumable interruption and live drop during held history, without deleting the recovery session.","file":"hub/src/remote/discord.ts","line":172},{"severity":"medium","text":"M2: native crash fixture seed Store is unowned across awaited fake.say; exit/setup observations need caught cancellable joined ownership. Pre-own nullable Store/native lifecycle/observations in shared disposer with omitted/aborted setup controls, preserving real SIGKILL and durable recovery assertions.","file":"hub/test/telegram-polling-restart.test.ts","line":231},{"severity":"medium","text":"M3: gap and overflow callbacks use drain-only send completion, so missed/uncertain native jobs can still clear captured count/batch and admit cards. Require exact durable sent settlement, retain stable obligations on incomplete delivery and nonce/unknown fences; cover refusal and accepted/lost-response paths.","file":"hub/src/remote/discord.ts","line":193}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear: complete consolidated M1–M3 in A-13572 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13572-t-1413-full-source-review-1-not-clear.md). Standards M2 fixture ownership; Spec M1 recovery barrier and M3 native acknowledgement boundaries. All14 changed files, C1–C5 and expanded shared-outbox consumer inventory inspected at head9876835a6/base36fc73bb2. No reviewer execution or runtime criteria verified. Local A-13571 performance/native kill samples are not Linux/load/allowance evidence. Correct with native red/green/setup controls, then fresh exact-head source review before verification; no dev merge or full-all request.

Criteria: C2 failed (Overflow obligation can be cleared after drain resolves without exact native warning delivery.), C3 failed (Interrupted frozen history batch is not completed on successful RESUMED recovery; active history can also be bypassed by a live reconnect.), C4 failed (Gap callback can mark missed source jobs reported and clear saved count without native sent proof.).

### rev-26 · 2026-10-29T03:55:41.785Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1413-source-2
commit: b238ae0eb9978e1f1358c1cf73ab4b7d916dc406
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source2 clear at b238ae0eb. Standards M2 resolved: shared guarded exchange/pacing lifetime pre-owns Store, native acquisition, setup/exit observations; omitted/aborted controls retain real native absence, closed Store/fake and zero owned work. Spec M1 resolved: active/persisted history and queued FIFO input joined across READY/RESUMED before card recovery, covered by actual resumable and live-drop held-history controls. M3 resolved: exact stable warning job must be sent before gap/overflow acknowledgement; refused/accepted-lost native controls retain counts/batches, silent flags/nonce fences, no second POST or premature cards. Original14-file audit and all eight correction diffs read; no dev merge. A-13576 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13576-t-1413-full-source-review-2-clear.md). C1–C5 done present; no runtime verification. Local cards62/restart7/typecheck are not Linux/load/allowance evidence. Proceed unchanged-head mode-free verify, then original-record final review including changed T3/timing treatment.

### rev-26 · 2026-10-29T04:00:28.896Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1413-evidence-1
commit: b238ae0eb9978e1f1358c1cf73ab4b7d916dc406
scope: evidence
findings: [{"severity":"medium","text":"M4: existing final-read wrappers (also line541) discard new outbox states/id query arguments, breaking pending/exact-id read semantics under observation. Two T1 controls fail: arrival omitted from sends and unknown proof2 instead of1. Preserve read arguments, observe actual final pending boundary and retain all owner/send/proof/original-attempt assertions.","file":"hub/test/outbox.test.ts","line":475}]
finding_counts: {"high":0,"medium":1,"low":0}

Original-record evidence not clear: A-13577/run a42d3fe4 at b238ae0eb exit1. Independent finish census1142 ordinary pass/2 fail plus40 separate load pass, no unfinished started identities. Owned outbox final-read controls fail at assertions491/557 (0.017416130s/0.016558469s). T0 green/T1 red; T2/changed T3/Web/T4 unexecuted. No task runtime criterion failed or verified from unrun cases, no Linux task duration/allowance claim. I missed the direct outbox wrapper consumers at source. A-13578 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13578-t-1413-evidence-review-1-not-clear.md) records exact evidence and migration. Retain failure, reproduce/fix wrappers preserving invariants, fresh exact-head source review before another run; no blind retry/shared exception.

### impl-1413 · 2026-10-29T04:01:06.381Z

Rule20 inventory correction after Linux a42d3fe4 T1 failures: direct Store read-wrapper consumers at hub/test/outbox.test.ts lines475 and541 override remote.outbox. They must forward optional states/id, preserving exact returned snapshots, and inject final-read arrivals only on pending-selection reads. Search across hub/web/nvim/qa/.agents found exactly these two overrides. Both original generated cases reproduced red locally (missing second delivery; proofs2 vs1), then all26 owning-file cases green after wrapper migration; owner identity, delivery completion, one proof and original-attempt assertions unchanged. No production source change in this correction. T2, changedT3 and Web remain unexecuted on Linux.

### rev-26 · 2026-10-29T04:04:43.558Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1413-source-3
commit: 5ad59cec732dc7d661b52a3a533e6777e633b7ee
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source3 clear. M4 two Store observers now forward states/id unchanged, inject only at pending-selection reads and retain exact snapshots plus original exposed owner/both sends/one proof/original attempt assertions. A-13579 complete wrapper inventory inspected, including checkpoint Proxy which binds read methods; no production/schema change. Prior M1–M3 remain resolved. A-13580 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13580-t-1413-full-source-review-3-clear.md). Parent b238ae0eb, no dev merge; original audit and complete two-file delta reviewed. Local outbox26/typecheck green are not Linux evidence. Failed A-13577 remains separate; C1–C5 runtime unverified. Proceed configured mode-free verify at unchanged head, then original-record timing/load/changed-T3 review and applicable Linux allowance treatment.

### rev-26 · 2026-10-29T04:17:48.932Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1413-evidence-2
commit: 5ad59cec732dc7d661b52a3a533e6777e633b7ee
scope: evidence
findings: [{"severity":"medium","text":"M5: replay now starts after READY, but lifecycle fixture throws at Gateway.open and cannot reach held native REST; migrate to actual recovery boundary retaining bounded cancellation/attempt/no-send/native drainage and audit moved-start consumers.","file":"hub/test/discord-messages.test.ts","line":163},{"severity":"medium","text":"M6: new cap case Linux base27.622364890s/load max29.716285979s, file42.048s; duration treatment/Coordinator allowance remains unresolved. Preserve passing timings and independent6.3ms responsiveness; do not infer approval from report-only warnings.","file":"hub/test/discord-cards.test.ts","line":1005}]
finding_counts: {"high":0,"medium":2,"low":0}

Original-record evidence2 not clear. A-13581/run fa7e1e1f exit1 at5ad59cec7:3424 ordinary passes/1 fail plus95 scoped load passes, no unfinished started identity. Startup replay cancellation fails hold receipt at1.036476512s. T0/T1 green, T2 incomplete/red, changed T3/Web/T4 unexecuted. New cap correctness/base+5load passed, but actual Linux duration treatment remains open; native kill Linux proof absent. No C1–C5 runtime verification or functional criterion failure inferred from unrun gates. I missed direct lifecycle consumer at source. A-13582 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13582-t-1413-evidence-review-2-not-clear.md) preserves exact counts/timings/provenance. Correct M5, resolve M6 under Coordinator direction, fresh exact-head source review before another run; failed A-13577/A-13581 remain separate.

### rev-26 · 2026-10-29T04:25:12.873Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1413-source-4
commit: 7888f505e42310904079fa90049aa9883b4d89fa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source4 clear. M5 lifecycle consumer now reaches post-READY held recovery through one owned serviceable conversation; original attempt/500ms cancellation/no-map/no-copy/drain assertions retained, full REST options forwarded. M6 independently checked Coordinator396ede14 split: production cap500, fast native T2 cap20/25 with overflow→gap and active-request proof; original620→500 retained in existing T3/shared setup-only fixture with absolute45s bound. Sole45s R-1278 allowance through2026-11-05 cites original Linux passing worst29.716285979s and follow-upT-1436; owner/follow-up independently open. No unrelated duration change. Prior M1–M4 remain resolved; all10 correction diffs reviewed, no dev merge. A-13584 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13584-t-1413-full-source-review-4-clear.md). C1–C5 done present, runtime unverified. Proceed unchanged-head mode-free run and original changed-T3/timing/load review; Coordinator's separate verify-all gate remains.

### rev-26 · 2026-10-29T04:26:00.428Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1413-evidence-3-preflight
commit: 7888f505e42310904079fa90049aa9883b4d89fa
scope: evidence
findings: [{"severity":"medium","text":"M7: fixture import precedes T3 lifecycle header, removing leading-comment exemption and causing3 startDaemon findings against frozen0. Restore header first; preserve lint policy/baseline and retain red/green before fresh source review.","file":"hub/test/telegram-polling-restart.test.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Preflight evidence3 not clear at7888f505e. Hub verify-test-lint refused before execution (2db1713f): startDaemon lines38/124/237. Source inspection confirms leading-comment lifecycle rule in test-lint.ts318–329/policy77. No new run/platform/timing/load/changed-T3 evidence and no criteria failed or verified. A-13585 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13585-t-1413-preflight-evidence-review-3-not-clear.md). I missed moved header at source4. Correct header only, no frozen allowance increase; fresh exact-head review before resubmission. Prior failed runs and Coordinator full-all gate remain separate.
