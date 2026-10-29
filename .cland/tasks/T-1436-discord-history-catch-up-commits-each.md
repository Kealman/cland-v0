---
id: T-1436
kind: task
title: "Discord history catch-up commits each replayed input separately: about 55 ms per input on Linux"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1217
branch: t/T-1436-discord-history-catch-up-commits-each
created: 2026-10-29T04:18:09.413Z
updated: 2026-10-29T20:48:09.354Z
closed: 2026-10-29T20:48:09.354Z
---

## Summary

Found by T-1413 (topic-1171). Once the quadratic outbox scan was fixed, a 620→500 history catch-up took 7 s on macOS but 25–30 s on a Linux c-8 droplet: about 55 ms against 14 ms per input. The hub keeps answering (an active `topic.send` takes 6 ms), so this is throughput, not a stall.

## Cause (suspected)

The frame dispatcher commits each replayed `topic.send` and its reaction receipt as separate durable transactions. Each one pays the droplet's fsync (8–35 ms). T-1413 deferred batching the durable writes of one history page because that needs a dispatcher transaction seam across awaited remote results.

## What to build

Commit one history page (or a bounded group of inputs) in a single durable transaction, keeping order, the at-most-once receipts, and the interruption semantics T-1413 established (persisted selection, process-kill recovery). Measure the Linux 620→500 case before and after, then shrink its T3 allowance (owner R-1278).

## Acceptance criteria

- [x] C1. The 620→500 production-frame catch-up completes in under 10 s in the task's Linux c-8 verify run (before: 23.5 s in A-13961 and 19.8 s in A-14040, integrated runs) and in 5 of 5 local macOS repeats under two workers plus owned CPU load; later c-8 cover samples are recorded as landing evidence.
  - done: impl-1436 · 2026-10-29T20:38:46.447Z
  - verified: rev-31 [reviewer] · run rev-20261029-1436-final1 · 2026-10-29T20:40:30.054Z · commit da7c1d5dbf2b674f46e3e6b1a7be5fa589271751
- [x] C2. Killing the hub during a page commit replays no input twice and loses none, shown by a T3 process-kill case.
  - done: impl-1436 · 2026-10-29T20:38:46.633Z
  - verified: rev-31 [reviewer] · run rev-20261029-1436-final1 · 2026-10-29T20:40:30.054Z · commit da7c1d5dbf2b674f46e3e6b1a7be5fa589271751
- [x] C3. Telegram catch-up and gap tests pass unchanged.
  - done: impl-1436 · 2026-10-29T20:38:46.969Z
  - verified: rev-31 [reviewer] · run rev-20261029-1436-final1 · 2026-10-29T20:40:30.054Z · commit da7c1d5dbf2b674f46e3e6b1a7be5fa589271751

## Comments

### impl-1436 · 2026-10-29T19:32:56.321Z

Rule 20 consumer inventory before changes: internal Conversation (hub/dispatch.ts, hub/budget.ts plus harness project dispatch consumers); Remote.start/RemoteSend (gateway.ts, discord.ts, discord-inbound/cards/commands.ts, telegram.ts/telegram-inbound.ts, test/fakes/messenger.ts, discord-cards-fixture.ts); native history persisted reader/writer discord-catchup.ts/discord.ts and T2 discord-cards.test.ts, T3 telegram-polling-restart.test.ts. Search covered hub/src hub/test nvim web shared .agents/skills qa docs. Plan additive optional native synchronous batch callback, no frame/reply/schema/policy change; legacy callbacks omit it and retain individual processing. Telegram unchanged. Existing gateway, Telegram, Discord command/card/media tests and QA guides consume no new field; startup probes/workbench clients retain identical frames. Preserve old frozen history/readback and previous three/four-argument adapters.

### impl-1436 · 2026-10-29T19:37:51.823Z

Second slice: initial text/receipt batching passed full T3 locally but 620→500 still costs 6.60 s, versus pristine 7.28 s. Reaction attempt/settlement writes remain per input. Extend neutral Outbox with optional bounded idempotent batching, enabled only for Discord reaction PUT jobs; inventory: DiscordOutbox and TelegramOutbox production constructors, remote outbox tests and pacing/recovery native tests. Existing callers omit option and retain exact flow; no persisted payload/schema/frame changes. New regression at production-frame/fake seam fails 1 !== 20 for durable reaction attempts before first native PUT.

### impl-1436 · 2026-10-29T19:44:12.854Z

Measured dominant cost (macOS instrumented tree): total6257ms; overlapping outboxRead4931ms/6201 calls/3,074,279 decoded rows; native reactions3802ms/1002; fetch-to-headers3802ms/1015; Store transactions217ms/530; SQLite COMMIT/RELEASE68ms/3702; topic.send/fanout50ms/501. Coordinator approved indexed source/last-row/depth reads and constant per-input decoded-row guard. Contract inventory: RemoteStore (all production adapter/outbox/status consumers, tests and persisted tables) gains additive helpers and nonunique source index; existing outbox() and all shapes unchanged. Migrate neutral enqueue last-row read, Discord source lookups, daemon remote-depth projections. Other old consumers remain semantically unchanged. Plan drop reaction batching if indexed reads make it unnecessary; retain synchronous text grouping to prove requested page rollback/recovery.

### impl-1436 · 2026-10-29T19:47:46.902Z

Evidence at65763e60fb27dfa937e7d241c4fd9136b72d69cc (origin/dev merged before first source review): A-14066 five loaded pairs,10/10 measured [1948.3,1979.0],[1776.1,1779.1],[1834.6,1838.8],[1732.1,1732.5],[1760.3,1760.0]ms; total13.226s, peak1-minute load4.473. macOS local two test workers + two owned CPU workers. Measurement includes restart/input+native feedback/overflow receipt; excludes injected pacing, later semantic assertions and cleanup. No browser. Workguard≤50k decodedrows passed all10. Afterindexed local diagnostic: total1405.7ms, outbox68.2ms/16,546rows, reaction864ms, fetch862ms, SQLite commits149ms, fanout49ms (overlapping timings incl instrumentation). Reaction batching removed after diagnosis; bounded20-text-input and adapter receipt transactions retained for page atomicity. T2 bounded-group native-hold and restart regressions; T3 pre-commit rollback and post-commit/pre-receipt SIGKILL controls. Linux c-8 and unchanged Telegram catchup/gap evidence pending reviewed-head verification.

### rev-31 · 2026-10-29T19:58:47.893Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1436-source1
commit: 65763e60fb27dfa937e7d241c4fd9136b72d69cc
scope: full
findings: [{"severity":"medium","text":"M1: all group run() calls send before buffered results persist mappings. A type19 history reply to an earlier same-group input therefore reads no native→hub mapping and loses replyTo/routing compared with serial ingress. Preserve dependency order and add exact-identity native same-group reply coverage.","file":"hub/src/remote/discord-inbound.ts","line":87}]
finding_counts: {"high":0,"medium":1,"low":0}

Source1 not clear; M1 only, A-14082. Bounded commits, post-commit results, frozen replay, media exclusion and indexed ledger reads otherwise retain their intended boundaries. Consolidated audit complete. Local reported timings/tests remain separate from pending Linux <10s, allowance sizing and unchanged Telegram runtime evidence. Replacement source review before verification; no Reviewer execution or runtime criterion verification.

### impl-1436 · 2026-10-29T19:58:49.802Z

Source-review M1 adds T-1406 mapped reply routing as an explicit batch consumer: each type19 history input resolves earlier native mappings before dispatch. Native fake say now supports optional reply_to; old controls unchanged. New T2 native three-message reply chain anchored in a non-General topic failed before fix (only first input retained topic, second/third lost routing). Keep type19 outside synchronous ordinary-text groups, awaiting each receipt/mapping before the next input; full-scale ordinary-text batching unchanged.

### rev-31 · 2026-10-29T20:02:02.949Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1436-source2
commit: 9f9528b3f48946a5c5654291c41befae5c55d74c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 full source clear, M1 resolved; A-14090. Serial type19 replies preserve exact mapped topic/reply identity; ordinary-text grouping, media path, crash controls and indexed work guard retained. C1–C3 runtime unverified; fresh local macOS samples remain separate from pending Linux throughput/allowance/Telegram evidence. No Reviewer execution. Source1 artifact reference is A-14083; prior tracker A-14082 was a typo.

### impl-1436 · 2026-10-29T20:03:38.599Z

Verification at source-clear9f9528b3 refused admission before enqueue: startDaemon3 > frozen allowance0. Cause was profile import before pre-existing T3 lifecycle header. Per Coordinator, restored unchanged header to first line; no baseline/guard widening. npm run test:lint green: all static checks passed, report-only census124 findings/60files, enforced admission0refusals. No Linux runtime evidence from refused submission. Comment-order-only correction returning for delta source review; loaded-runtime evidence at9f9528b3 unaffected in executable code.

### rev-31 · 2026-10-29T20:04:44.145Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1436-evidence1
commit: 9f9528b3f48946a5c5654291c41befae5c55d74c
scope: evidence
findings: [{"severity":"medium","text":"Hard verify-test-lint admission refusal: profile import precedes retained T3 first-comment header; startDaemon sites count3 exceeds frozen allowance0. No run/Linux receipt. Restore unchanged header and review corrected head before verification.","file":"hub/test/telegram-polling-restart.test.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Admission-only evidence not clear; A-14097 retains original hub refusal dd750330 at9f9528b3. No enqueue/droplet/Linux timing. Source2 behavior clear retained; correction uses unchanged guard/baseline then fresh source review. No runtime criteria verified or Reviewer execution.

### rev-31 · 2026-10-29T20:04:58.363Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1436-source3
commit: c4dfe02849eafccfa2bf125a3ffa8ba043152297
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear, A-14098; exact one-file comment reorder restores retained T3 header before import. Executable code, guard and frozen baseline unchanged; source2 full behavior audit retained. A-14097 original admission refusal stays separate/no Linux run. Reported unchanged guard green0 refusals; prior macOS stress at9f9528b3 not Linux proof. Runtime C1–C3/allowance pending configured verification and final evidence review. No Reviewer executions.

### rev-31 · 2026-10-29T20:19:33.999Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1436-evidence2
commit: c4dfe02849eafccfa2bf125a3ffa8ba043152297
scope: evidence
findings: [{"severity":"medium","text":"Original A-14104 exits1: new rollback-kill identity passes6.396172347s but exceeds enforced5s with no allowance. Coordinator sizing/source-review manifest delta required; requested shrink of old fullscale allowance also pending. Web not executed.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence2 not clear, A-14105. Original3913 ordinary+90 load passes;9 selectedT3 once/allpass. Valid Linux completion diagnostic4.9214s/fullcase5.165974280s,16,545 decodedrows,activeUI32.6ms; separate from macOS stress. Hard duration gate fails despite passing assertions; Web unrun. Preserve partial/admission-only receipts. Final C1–C3/ready held pending allowance disposition and passing exact-head configured evidence. No Reviewer execution or unchanged-head retry.

### rev-31 · 2026-10-29T20:22:39.477Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1436-source4
commit: da7c1d5dbf2b674f46e3e6b1a7be5fa589271751
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear; A-14107. Exact metadata-only delta matches Coordinator3a617287: rollback10s/E-880,newdates; history45→8s/E-880/originaldates; committed-kill owner-onlyE-880/originalreason+dates. Nine measured case baselines/file23.782627s/source attribution agree with A-14104. Guide corrected; executable source3 retained. Failed partial A-14104 (9T3 pass,Webabsent) and admission-only A-14097 remain separate. Final C1–C3 evidence pending new configured receipt; no Reviewer execution.

### rev-31 · 2026-10-29T20:40:30.054Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1436-final1
commit: da7c1d5dbf2b674f46e3e6b1a7be5fa589271751
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear,C1–C3 verified; A-14113 originalA-14111 audit. 4212ordinary+90separate loads pass;9selectedT3 once+Web complete. Linuxfullcase4.912936557s/diagnostic4.6917s,16,545decodedrows; macOSfivepaired10samples separately attributedA-14086. Both kill boundaries pass6.265/6.228s; replychain/group consumers base+5loads; unchanged8Telegramcatchup+4gap pass. Baseline mapping corrected from originals:A-13961=23.495788359s,A-14040=19.758447139s. Hostreuse/report-only warnings/remainingT3T4 exclusions retained; approvedallowances pass. Failedpartial/admission originals separate. Coordinatorlatercover/landing samples still owned separately. No Reviewer executions;QA none.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1436 · 2026-10-29T20:41:01.934Z

Ready at unchanged da7c1d5db: final A-14113 clear/C1–C3 verified, configured A-14111 green. Fresh origin/dev fetch359b43fb and merge-tree clean tree68e3cecc928b0cd7c5bff6dfb9deef8dd5c9145d; branch/source unchanged. Coordinator enqueued; claim retained until landing. Correct baseline attribution: A-13961=23.496s and A-14040=19.758s; prior implementation evidence reversed those IDs. E-1314 demo-staleness warning belongs to Coordinator landing/cover bookkeeping.

### coord · 2026-10-29T20:48:09.354Z

Merged 5e7dbb33ceed9abf56ddabba875955e8cdd45582 onto dev.
