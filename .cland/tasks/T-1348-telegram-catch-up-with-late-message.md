---
id: T-1348
kind: task
title: Telegram catch-up with late-message times, the gap line and the offline and recovery lines
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1343
topic: topic-1101
branch: t/T-1348-telegram-catch-up-with-late-message
created: 2026-10-26T19:09:07.793Z
updated: 2026-10-27T06:46:22.713Z
closed: 2026-10-27T06:46:22.713Z
---

## Summary

After an outage the Telegram chat gets late messages marked with when they were written, then one gap line "N General messages missed since 13:20" when N is above 0. After 3 minutes offline General gets one offline line, and one recovery line when the remote returns.

## What to build

Catch-up from what Telegram kept, each late inbound message marked ("written on Telegram at 13:20; the hub was down until 13:24"). The gap line comes from T-1324's missed count. The offline and recovery lines go to General. A remote shows as connected only after a recent successful exchange. Outages are made while the hub runs, since after a plain hub restart the gap is almost always 0. Spec §3.9.

## Acceptance criteria

- [x] C1. A 10-second fake outage with three General posts ends in one gap line "3 General messages missed since …", and a late inbound message is marked with its written time (test).
  - done: impl-1348 · 2026-10-27T04:55:32.376Z
  - verified: rev-26 [reviewer] · run rev-20261027-1348-evidence-1 · 2026-10-27T06:40:34.335Z · commit 071e1be6dfc813b9cbbb3bf2a68ae7c719904966
- [x] C2. A four-minute outage under an injected clock also writes "Telegram remote offline since …: <reason>" to General and one recovery line (test).
  - done: impl-1348 · 2026-10-27T04:55:32.532Z
  - verified: rev-26 [reviewer] · run rev-20261027-1348-evidence-1 · 2026-10-27T06:40:34.335Z · commit 071e1be6dfc813b9cbbb3bf2a68ae7c719904966

## Comments

### impl-1348 · 2026-10-27T02:58:48.641Z

Rule 20 consumer inventory before optional native-contract additions: production pollTelegram is called only by TelegramRemote.run; TelegramRemote is constructed by messengerFactory plus explicit test injection in telegram-{inbound,polling,pairing,messenger}. TelegramInbound is constructed only by TelegramRemote. messengerFactory persistence callbacks originate in daemon.startGateway; direct factory tests retain optional persistence. remoteNotice is called by daemon and will gain an optional formatting flag while preserving its existing fatal line. Outbox consumers: native Outbox tests, outbox-gateway and fake messenger; state rows are read by daemon remote.status, gateway-state/remote-state/remote-cli tests and persisted restart fixtures. No public frame/schema/authority field changes planned; all new native callbacks optional, old positional clients unchanged. Repository searches include hub/nvim/web/shared production and all test tiers, .agents skill examples, qa briefs, docs/agents startup/test guides. Existing previous-wire gateway regression remains unchanged. Docs to update: hub README Telegram polling/catch-up, per-file catch-up test guide and implement skill/CHANGES; role clause already covers remote isolation and secret boundaries and has no byte capacity.

### impl-1348 · 2026-10-27T03:47:52.129Z

Added an independent native gap acknowledgement service and T1 regression while awaiting landed T-1347. It captures missed native General jobs for the current pairing, counts source ids (not split parts), persists an immutable gap key/captured ids before send, acknowledges only on successful delivery, and leaves arrivals during that send missed. Restart retains the same key for the native queue to reconcile rather than resend uncertain deliveries. New internal reported state is terminal and outside existing queued/sending/uncertain status-depth selectors; public wire remains unchanged.

### impl-1348 · 2026-10-27T04:50:37.457Z

Landed T-1347 merged at 5685bf469. Before optional native SendFacts.key/missed additions: TelegramOutbox consumers are TelegramRemote's General/send/reaction paths plus direct telegram-pacing.test.ts queue cases; persisted payload readers are its own resume/prove and the new captured-gap service. Existing payloads omit key/missed and remain valid. New key is optional native storage metadata, with source/mapping null for gap lines; no public frame change. General completion treats durably missed jobs as accounted-for without successful traffic; keyed gap completion still requires sent. Class status and depth readers retain unchanged selectors. Existing legacy frame clients and no-persistence native clients remain covered by prior gateway/messenger regressions.

### rev-26 · 2026-10-27T05:00:29.228Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1348-source-1
commit: 419d405a7824e1e302d0ea3509ff839cd20d11cf
scope: full
findings: [{"severity":"medium","text":"M1: the two new Telegram catch-up/gap test guides are unindexed; unchanged test-docs membership fails. Add only the missing rows and preserve guard receipts.","file":"docs/agents/tests/index.md","line":1},{"severity":"medium","text":"M2: held flushTelegramGap writer has no unconditional barrier/producer cleanup or bounded setup. A pre-release assertion failure leaves the writer pending while finally closes SQLite. Pre-own/release or cancel/join before closing storage; add omitted/aborted setup controls through that disposer without weakening capture/ack assertions.","file":"hub/test/telegram-gap.test.ts","line":24}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated full audit complete: A-12586 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12586-t-1348-full-source-1-consolidated-findings-at-419d405a7.md. Standards M1/M2; no additional source-level Spec findings. C1/C2 not runtime-verified. A-12584 is local macOS targeted evidence only; A-12585 preserves M1 original red/working-tree green. Prepared corrections are outside this reviewed commit. Request fresh pushed-head review after corrections and preserve ordered T-1345 integration/final-head review; Coordinator owns all verification, enqueue and landing.

### rev-26 · 2026-10-27T05:02:29.803Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1348-source-2
commit: 275446a9d2e44573a018c0f743f3f3d3e9837e05
scope: full
findings: [{"severity":"medium","text":"M2 remaining: ordinary start() waits on readiness using setupClock, but only the negative control advances that clock; lost ordinary readiness never reaches its deadline/disposer. Make setup bound progress independently of receipt, connect test cancellation, and use the same release/cancel+join-before-close disposer. Preserve existing capture/ack and negative-control assertions.","file":"hub/test/telegram-gap-fixture.ts","line":48}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated correction audit complete, A-12588 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12588-t-1348-source-2-remaining-setup-bound-finding-at-275446a9d.md. M1 resolved; M2 writer drain/storage ordering fixed, but ordinary setup deadline is inert without external fake-clock advancement. No production changes or new Spec finding. A-12587 local macOS targeted receipts do not verify C1/C2 at configured runtime. Fresh pushed-head review required; ordered T-1345 integration/final review and Coordinator all occasion remain separate.

### rev-26 · 2026-10-27T05:04:16.837Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1348-source-3
commit: 079fa32ba862baca2b11f4c772e015849dfaa0a1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-12589 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12589-t-1348-source-3-clearance-at-079fa32ba.md. M1/M2 resolved: self-progressing separate setup clock, test abort propagation, same registered cancel/release+producer/observer/driver join before Store close, retained original and negative-control assertions. No production changes since initial full audit and no Spec findings. C1/C2 are not configured-runtime-verified. Keep head stable pending ordered T-1345 integration and fresh final-head source review; Coordinator owns all verification and landing, no item/mode-free run.

### rev-26 · 2026-10-27T05:44:23.347Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1348-source-4
commit: 52226703b9566e7247307ec579575208aaa842f0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final-head merge-delta source clear; A-12597 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12597-t-1348-final-head-merge-delta-source-clearance-at-52226703b.md. Ordered landed T-1345 merge checked against both parents: mute admission/command/state coexist with unchanged catch-up, stable-key gap queue and reviewed M1/M2 fixture corrections. Imported mute source/tests match reviewed/verified sibling; no additional source edits. No Standards/Spec findings. A-12596 reports final-head local macOS targeted validation only; C1/C2 remain configured-runtime-unverified. Keep head stable; Coordinator owns rule-6 all at this head and subsequent landing, no item/mode-free run.

### impl-1348 · 2026-10-27T05:45:02.723Z

Ready for Coordinator exact-head rule-6 all at pushed 52226703b9566e7247307ec579575208aaa842f0. Source-3 full clear A-12589 plus final ordered T-1345 merge-delta source clear A-12597. Both criteria done; configured-runtime verification outstanding. Fresh origin/dev fetch=5c38c7a822aa8936c116888f072d8dfef0d2d4aa; merge-tree exits 0, result 80a56d3ab5d63076a22029de1de65a3da4b004fe; head unchanged/clean. Local evidence A-12596 (macOS, 4 T1+8 catch-up T2+6 mute T2, docs guard and typecheck) does not replace Linux/full verification. No item run per Coordinator instruction. Head frozen for all receipt and final evidence review.

### impl-1348 · 2026-10-27T05:58:30.527Z

Rule-6 all 46d04031 at 52226703b was partial red: T0/T1 completed, one T2 command-priority/own-result failure, T3/Web not run (A-12598). Exact symptom `Error: executor operation deadline reached` reproduced with the unchanged isolated command control locally. Falsifiable cause confirmed by a single change: #caughtUp awaited #outbox.resume/#inbound.recover on every successful poll, joining later ordinary queue work before the next offset despite the command's durable sent result. Recovery joins now require an active outage; gap reconciliation remains. Existing regression/assertions unchanged. Requested queue consumers run serially on corrected source: commands 7/7, pacing 33/33, mute 6/6, gap 4/4, catch-up 8/8, plus typecheck; local macOS only, not a new Linux/full receipt. Docs and implement skill record the boundary. No dev merge or new verifier submitted; fresh source review required.

### rev-26 · 2026-10-27T06:01:30.662Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1348-source-5
commit: 071e1be6dfc813b9cbbb3bf2a68ae7c719904966
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Regression correction source clear, A-12605 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12605-t-1348-source-5-regression-correction-clearance-at-071e1be6d.md. Active-outage guard removes healthy per-batch drain barrier, preserving normal gap reconciliation and actual-outage queue/feedback joins. Command and catch-up tests unchanged; original deadline failure and isolated red/green checked. A-12601 plus A-12603 retain all requested serial local macOS checks, 68 targeted passes including inbound8 and native polling-restart2; not Linux/configured proof. Prior46d04031/A-12598 remains failed partial evidence, C1/C2 unverified. Keep corrected head stable for Coordinator's next exact-head all and later evidence review; no item verification.

### rev-26 · 2026-10-27T06:40:34.335Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1348-evidence-1
commit: 071e1be6dfc813b9cbbb3bf2a68ae7c719904966
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified at unchanged source-5 head. A-12622 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12622-t-1348-final-full-run-evidence-clearance-at-071e1be6d.md. Original Coordinator full31522e30/A-12618 checked:4988 ordinary passes+8 explained prerequisite skips, no failures/cancellations; no load-gate repetitions. C1 .124074702s, C2 .410157422s, prior command regression .105427213s pass; all12 new gap/catch-up identities and native restart controls pass. T0/T1/T2/T3/Web complete, T4 outside occasion. Linux droplet/pinned Headless Shell1248; host typecheck not remotely repeated; budgets/lint report-only and timing limits retained. Old46d04031/A-12598 remains failed partial evidence. No findings; Coordinator owns enqueue/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T06:46:22.713Z

Merged 3b26f29374c393030f47362310f2d15a366ef0e5 onto dev.
