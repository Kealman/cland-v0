---
id: T-1324
kind: task
title: "A durable outbox per remote: attempts, provable resends, merged edits, dropped closed jobs, missed General jobs"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1323
topic: topic-1080
branch: t/T-1324-a-durable-outbox-per-remote-attempts
created: 2026-10-26T02:28:46.997Z
updated: 2026-10-26T07:08:41.244Z
closed: 2026-10-26T07:08:41.244Z
---

## Summary

Each remote gets a durable outbox: an attempt record before every send, a resend only for what provably never left, merged edits, dropped jobs whose source closed, and General jobs during an outage counted as missed for the gap line instead of dropped.

## What to build

An outbox per remote over the remote tables. Write the attempt record before each send. Resend only when the messenger client supplies proof the job never left (Discord's enforced nonce, Telegram's message map); the client interface carries that proof. Merge consecutive edits of one target. Drop a job whose source closed, such as the card of an answered ask. While the messenger refuses sends, mark General jobs missed and count them for the gap line. Spec §3.9; the patterns in `docs/research/messenger-bridges.md` (research/messenger-bridges ffee79d8).

## Acceptance criteria

- [x] C1. While the test messenger refuses sends, three General messages are marked missed and counted, a card whose ask is answered meanwhile is dropped, and after recovery nothing leaves twice (test).
  - done: impl-1324 · 2026-10-26T06:01:50.038Z
  - verified: rev-26 [reviewer] · run rev-20261026-1324-evidence-1 · 2026-10-26T06:26:42.368Z · commit abee02633496a3cdb47be87c3456b21465406c57
- [x] C2. An attempt record exists before each send, a job whose client cannot prove non-delivery is never resent, and two edits of one target queued together leave as one edit (test).
  - done: impl-1324 · 2026-10-26T06:10:29.304Z
  - verified: rev-26 [reviewer] · run rev-20261026-1324-evidence-1 · 2026-10-26T06:26:42.368Z · commit abee02633496a3cdb47be87c3456b21465406c57

## Comments

### impl-1324 · 2026-10-26T05:53:05.144Z

Rule 20 consumer audit before contract changes: searched production hub/src, shared/wire, web/, nvim/, hub/test including all T1–T4, shipped skills/ and .agents/skills, qa/, docs/ for OutboxJob, OutboxAttempt, putOutbox/putAttempt and outbox()/attempts(). Existing storage consumers are hub/test/remote-state.test.ts and gateway-state.test.ts; owner is hub/src/remote/state.ts (Store.remotes). No production queue/client, startup probe, workbench reader, skill example or QA fixture currently consumes job/attempt semantics. Keep existing row fields and old-wire/storage round trips intact; additive queue metadata defaults for old rows. New Outbox client contract is internal, not a new frame or authority. Existing testMessenger callers (gateway.test.ts, gateway-state.test.ts) retain their frame-only default. Seams: C1 real projectHub frame sends/ask answer with fake platform delivery; C2 cheaper durable outbox/fake messenger seam, injected clock, no process/platform.

### rev-26 · 2026-10-26T06:06:40.636Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1324-source-1
commit: 49ac37cef3a1c345460bde175ce1a5137bcb1e2b
scope: full
findings: [{"severity":"medium","text":"M1: New outbox/outbox-gateway tier rows are outside global lexical order and reversed. Move only these entries within tests, retain tier values/guard, preserve original red and actual green outputs; the intermediate loadGuards/unclassified run is not passing evidence.","file":"hub/test/tiers.json","line":289},{"severity":"medium","text":"M2: Held-send setup gives caseDeadlines an entered.promise that never settles if the receipt is missing, while cleanup relies only on lexical finally. Caller timeout/cancellation can leave the pending-work drain stuck or skip resource disposal. Register unconditional pre-trigger ownership, independently bound/cancel/settle the observer, release and join underlying client/drain/stop before SQLite close; add omitted/aborted setup controls using that path, retaining assertions and matching guidance.","file":"hub/test/outbox.test.ts","line":123}]
finding_counts: {"high":0,"medium":2,"low":0}

Full Standards/Spec audit complete; A-12311. M1 global tier ordering; M2 unconditional held-send setup/disposal including suppressed receipt and abort controls. No additional production client-proof, durable attempt, atomic completion, edit/source/drop/missed/reopen findings. Item consumer inventory and A-12310 focused local summary inspected with source/capture limits; reported uncommitted corrections are outside reviewed head. Commit/push complete correction set, preserve original failures/actual greens, restore C2 done and request corrected-head review before verification. T-1325 pacing/arrivals and production mirror rendering remain declared separate scope. C1/C2 runtime unverified; no reviewer execution/delegation. Coordinator owns full storage-change cover.

Criteria: C2 failed (Tier admission and held-send missing-receipt cleanup need M1/M2 corrections before safe same-head verification.).

### rev-26 · 2026-10-26T06:09:03.838Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1324-source-2
commit: 7948098c177d09f3a8e8c8725eb2748ae45d5e8d
scope: full
findings: [{"severity":"medium","text":"M3: Corrected held tests advance FakeClock by zero then await setup/actual entry; the fake deadline cannot expire if beforeSend never enters, and all three declarations lack an outer test timeout. Add an independent finite guard/cancellation path (with fake behavior time kept separate) and prove omitted actual entry reaches the registered disposer without external worker termination. Keep all assertions.","file":"hub/test/outbox.test.ts","line":140}]
finding_counts: {"high":0,"medium":1,"low":0}

Correction full audit complete; A-12313. M1 resolved by mapping-identical globally sorted tests rows. M2 registered pre-acquisition ownership and same-disposer missing/abort controls are present; production unchanged. M3 new observer gap: normal/control cases await fake-clock setup/actual after advance0 without finite outer test timeout, so absent producer entry cannot drive timeout/cancellation/cleanup. Add independent guard and omitted-actual-entry disposal proof, then request new source review before verification. A-12312 original excerpt/focused limits retained; no reviewer tests or runtime verification claim.

Criteria: C2 failed (Held-send setup can still wait indefinitely when the producer never enters; independent bounded setup/test guard and disposal proof required.).

### rev-26 · 2026-10-26T06:11:09.333Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1324-source-3
commit: abee02633496a3cdb47be87c3456b21465406c57
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-12314 carries the full A-12311/A-12313 audit. M1 sorted mapping retained; M2 pre-acquisition disposal and exactly-one entered-send controls retained; M3 all four held/pre-entry cases now have independent5s outer guards and a no-entry control expires both observers then proves same-disposer drainage, zero sends, post-stop refusals, closed SQLite/no timers. Production unchanged/no dev merge; no remaining Standards/Spec findings. Original reported local13/13/typecheck retains focused/source/capture limits, no reproduced hang or current Linux claim. C1/C2 claimant done, runtime unverified. Submit one mode-free verify here then request same-head final evidence. Coordinator owns full storage-change cover.

### rev-26 · 2026-10-26T06:26:42.368Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1324-evidence-1
commit: abee02633496a3cdb47be87c3456b21465406c57
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head task evidence clear; A-12316. A-12315/run61905e5b matches source A-12314; independent finish-record audit reconciles3383 ordinary passes/455 file passes and80 separate load passes (16 new identities ×5), no fail/cancel/skip. C1 frame outage/drop/recovery/reopen, all13 C2 durable-attempt/proof/edit/unknown/drain/cleanup identities and both schema/atomic rollback controls have exact base and five load pass receipts. New max0.307982128s, no allowance. T0/all T1/fallback all T2/Web completed, no T3/T4/full-cover claim. Host prepared-tree typecheck reuse/report-only diagnostics retained. C1/C2 verified, no findings or reviewer execution. Coordinator owns separate required full storage-change cover/landing; T-1325/messenger scope unchanged.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-26T07:08:41.244Z

Merged 88aaf5c88c3f09dba466d24fd00464b6845a08c9 onto dev.
