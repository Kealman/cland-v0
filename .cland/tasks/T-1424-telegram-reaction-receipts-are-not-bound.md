---
id: T-1424
kind: task
title: Telegram reaction receipts are not bound to the captured pairing, so a later 👀 can reach a replaced chat
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1152
branch: t/T-1424-telegram-reaction-receipts-are-not-bound
created: 2026-10-28T11:43:34.103Z
updated: 2026-10-28T19:20:41.557Z
closed: 2026-10-28T19:20:41.557Z
---

## Summary

TelegramInbound's flush stores reaction receipts without binding them to the pairing captured when the update arrived, and doesn't recheck the pairing after the native reaction I/O. If the human's chat is unpaired or replaced while 👌 is held, a later 👀 can be scheduled against the old receipt and reach the old chat. This predates albums; the T-1386 reviewer found it aside and excluded it from T-1386's findings (topic-1150).

## Acceptance criteria

- [x] C1. A stored reaction receipt carries the pairing identity captured on arrival; after any native reaction I/O, flush rechecks it, and a receipt whose pairing was unpaired or replaced sends no later reaction (test: hold 👌, unpair or replace, then show no 👀 to the old chat on the fake).
  - verified: rev-32 [reviewer] · run rev-20261028-1424-evidence1 · 2026-10-28T14:01:48.778Z · commit 978e7bda07ecc675038a2ce34df30e62918b9edc
  - done: impl-1424 · 2026-10-28T17:04:25.417Z
  - verified: rev-32 [reviewer] · run rev-20261028-1424-evidence2 · 2026-10-28T17:26:03.699Z · commit d172be37dd9c3da62864ff3a10e147ed29567e66
  - verified: rev-32 [reviewer] · run rev-20261028-1424-evidence3 · 2026-10-28T19:14:20.640Z · commit 6b17027f4464afcd4a69a8e25f4549990696b8a7

## Notes

Reviewer aside on T-1386, 2026-10-28. Related: T-1385 (media queue), T-1378 (unsupported input).

## Comments

### coord · 2026-10-28T11:44:18.423Z

Moved into 0.3 (R-1278) on the human's answer to ask 843ac812 (2026-10-28 11:44Z), under the standing yes of 05:04Z.

### impl-1424 · 2026-10-28T11:45:33.760Z

Rule 20 consumer inventory before optional receipt pairing identity: telegram-inbound.ts is sole writer/reader of telegram.inbound:*; telegram.ts creates it and routes text/answers/media; media FIFO uses upload but keeps its own captured authority. Tests directly read receipts: telegram-inbound.test.ts (recovery), telegram-cards.test.ts (answer delivery), telegram-notices.test.ts and telegram-polling-restart.test.ts (receipt absence). No wire shape changes: gateway/frame clients, startup probes, web/nvim and previous-wire clients unaffected. Searches across hub/web/nvim/shared/docs/.agents/qa found docs in hub/README.md and guides for telegram-inbound and telegram-polling-restart; no shipped skill examples parse the receipt. Optional field preserves decoding of historical receipts; legacy recovery needs an explicit compatibility regression. Album targets from T-1386 share the receipt identity; media queue untouched. Tests use the authorized production frame + loopback fake Bot API seam.

### rev-31 · 2026-10-28T11:49:51.789Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1424-source1
commit: acd2fe86ab8b48f931592fbca4d238e89cbaaa7c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13266 full source1 clear: Standards 0 / Spec 0. Captured numeric receipt identity is checked before/after reaction I/O and at recovery; display names do not authorize. Optional-field legacy chat-id recovery is retained with a dedicated compatibility arm. Three held-native-result controls retain actual delivery, joined reaction completion, confirmed poll offset and exact reaction census. Existing pacing owner/helper bounds and cleanup inspected; consumer inventory/docs/skill CHANGES match. Local reported macOS 36/36/typecheck remains distinct from absent configured/Linux proof; C1 runtime-unverified. Per Coordinator 44f2af85, wait for T-1386 landing, authorized dev merge and album replacement regression, then request fresh delta source review before mode-free verify. No media queue changes or per-item QA.

### impl-1424 · 2026-10-28T13:08:00.973Z

Consumer inventory correction: telegram-cards.test.ts:1378 reads the entire saved receipt using deepEqual, so it requires explicit migration (not merely old-field compatibility). At acd2fe86a, targeted confirmed-prompt restart case failed with extra pairing {userId:'101',chatId:'101',guildId:null}. Updated exact expected receipt to include captured identity; answers must share reaction authority checks. Kept all restart/native delivery assertions. Running cards file locally per Coordinator cc26a71d; verification remains held by e4e8208a.

### rev-32 · 2026-10-28T13:09:56.215Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-source2
commit: aa7f388b91b2f57b1aacde8f82e88abf39e28ef2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13290 source2 checkpoint clear,Standards0/Spec0,carrying A-13266 full source1. Same-base correction only adds exact captured pairing identity to confirmed-prompt receipt deepEqual plus reason in guide; no production change or weakened assertion. Lost delivery/confirmed offset/ask answer/restart/native close/no-duplicate/final reaction assertions and legacy absent-field recovery remain. Coordinator cc26a71d/feaadce8 accepts this consumer migration; inventory corrected. C1 remains runtime-unverified; reported local62/62/typecheck not configured Linux proof. This does not release verification hold: await T-1386 landing,authorized dev merge+album replacement regression,cards recheck and another source review; droplet hold e4e8208a retained. No run requested/ready claim; reviewer read only.

### impl-1424 · 2026-10-28T13:40:16.538Z

Authorized T-1386 integration at origin/dev 40e5f3a0: receipt now also has optional album targets/storedTargets/seenTargets. Same pairing identity covers every target and is checked after each native exchange. New album-replace held-👌 test red ('Telegram send has no delivery receipt') before per-target recheck, green after it; requires targets [1,2], no settled per-target bits, actual session delivery, durable album completion and exact one-reaction census. New recovered-upload receipt creation captures identity too; existing old receipts retain optional-field compatibility. Media queue unchanged. Consumer migration reruns requested: cards/inbound/polling-restart/notices plus typecheck.

### rev-32 · 2026-10-28T13:44:29.497Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-delta1
commit: 978e7bda07ecc675038a2ce34df30e62918b9edc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13310 authorized album integration delta clear, Standards0/Spec0, carrying A-13266/A-13290. Receipt type retains optional identity plus album targets/progress. Pairing is checked after every awaited target reaction before progress/next target; recovered-upload new receipts capture numeric identity, existing/legacy receipts retain compatibility. New held-first-reaction album-replace arm preserves actual delivery, durable offset3/media completion, targets[1,2], original identity, unsettled bits and exact one-reaction/no-eyes census. Earlier three revocation cases, legacy recovery and cards exact receipt migration remain. Media queue/Telegram media path match incoming dev; skill/docs/provenance/consumer inventory retained. No Reviewer executions. A-13308 local macOS summary and initial40/41 observer timeout remain separate from successful unchanged reruns; none are configured/Linux evidence. C1 runtime-unverified. Mode-free verification may proceed at unchanged978e7bda; Coordinator aefaee6e separately requires full verify all for T3 receipt reader before readiness/enqueue. Any changed head needs new source review.

### rev-32 · 2026-10-28T14:01:48.778Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-evidence1
commit: 978e7bda07ecc675038a2ce34df30e62918b9edc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured evidence clear; C1 verified, Coordinator full-all still separate/pending. A-13329 audits original9e92ccca/A-13326 at unchanged delta1 head:3927ordinary passes/499files+50separate load,zero nonpassing/unfinished. Four held-native revocation arms unpair/replace/same-chat/album-replace each ordinary+5/5load; legacy recovery ordinary+5/5, max own0.51534829s. Original identity, actual session delivery, exact one👌/no👀, album targets[1,2]/unsettled bits/durable completion and non-album confirmed cursor assertions pass. Current-shape recovery and exact confirmed-prompt cards consumer pass, plus inbound41/cards62/notices14. Host T0fa283d25 separate; Linuxc-8lon1 T1/allT2fallback/Web complete, Shell156/1248,2general/4Web workers,lifetime870s/$0.0604 notwall. Budgets/lint report-only. No T3/T4 selected, polling-restart unexecuted; Coordinator aefaee6e/e339cedc separately requires same-head full-all before enqueue. No full-all/ready claim, Reviewer rerun or per-item QA.

Criteria: C1 verified.

### rev-32 · 2026-10-28T17:08:05.325Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-delta2
commit: d172be37dd9c3da62864ff3a10e147ed29567e66
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13374 authorized dev merge delta2 clear, Standards0/Spec0; carrying A-13266/A-13290/A-13310. Task inbound production, inbound/cards/polling-restart/notices tests and guide byte unchanged from978e7bda. All reaction/Discord-render/album skill blocks and both parents' nonblank CHANGES entries retained. Overall delta includes landed production/tests:53/56 paths exactly incoming dev, remaining3 additive skill/README preservation; manual resolution confined to skill text. Incoming T-1423 fix retained. Coordinator a122aa11 assigns continuity; rev26 released overlap without verdict. C1 old runtime mark stale: source clearance only, fresh mode-free configured verification and exact-head original-record evidence review required. Prior1a29cb17/A-13358 stays overall Web-red with8skips and no executed separateT4 phase; Coordinator b22a18b0/29f33070 accepts bounded successful T3 carry only. No Reviewer executions/edits or per-item QA. Head must remain d172be37 for this clearance.

### rev-32 · 2026-10-28T17:26:03.699Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-evidence2
commit: d172be37dd9c3da62864ff3a10e147ed29567e66
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13385 final current-head evidence clear; C1 refreshed. Source delta2 A-13374 retained. Original0d043574/A-13384 independently parsed3960ordinary test passes/501file passes +50separate load tests,zero nonpassing/unfinished. Four held-native reaction revocation arms and legacy recovery each ordinary+5/5 explicit load passes; max own0.481204321s. Captured numeric pairing, actual delivery, exact one👌/no👀, unsettled progress and album targets[1,2]/durable completion assertions retained. Inbound41/cards62/notices14 pass; current and legacy lost-delivery recovery plus cards exact consumer pass. Current Web copied-tracker parent+CLI-status child now pass. HostT0 check29.307s/gate01e1e403 separate; Linuxc8lon1 T1/allT2fallback/Web complete,Node24.21/Nvim.12.5/Shell156v1248,2general/4Web workers,life904s/$0.0628 notsuitewall. Budgets/lint134findings report-only. No currentT3/T4. Coordinator b22a18b0/29f33070 explicitly carries prior978e7bda A-13358 successful T3, incl4polling-restart cases independently confirmed. That old whole run remains exit1/5329pass/2fail/8skip,T0–T3pass/Webred,no separateT4 phase. No failed-run exception beyond that bounded phase carry, no full-green-all/currentT3 claim. Ready report can follow Coordinator's sequence; enqueue belongs to Coordinator. No Reviewer executions/edits/reruns or per-item QA.

Criteria: C1 verified.

### rev-32 · 2026-10-28T17:53:15.767Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-delta3
commit: 1455789d0ee00766722ff51cdb4853f22d29f5e2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13391 combined authorized merge delta3 clear, Standards0/Spec0: covers5fbe8ed64+1455789d since cleared d172be37. All Telegram production/tests/guides byte unchanged. All reaction/Discord feedback/render/album/Identify skill blocks exactly once; both parents' nonblank CHANGES retained. Overall21-file delta includes landedT1406/T1403 source/tests, not globally docs-only;18paths exactly final incomingdev341a071e, only3skill/README paths preserve our reaction guidance. No manual production/test changes; neutral messenger/wire untouched. Coordinator830f1fea/48bb677d/3083efe0 authorize and name continuity. Source clearance only: C1 old runtime mark stale; prior greenA-13384/A-13385 belongs d172be37. Fresh mode-free verification and original-record evidence review required at unchanged1455789d. PriorA-13358 successful T3 carry remains separately authorized, whole run Web-red/2fail/8skip/no distinctT4phase. No Reviewer execution/edits/reruns or per-item QA; enqueue stays Coordinator action.

### rev-32 · 2026-10-28T18:56:08.032Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-delta4
commit: 6b17027f4464afcd4a69a8e25f4549990696b8a7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13412 shared-fix merge delta4 clear, Standards0/Spec0. Parents1455789d+dev8e90d26f;8 incoming paths exactly dev,empty combined diff/no manual changes. Runtime delta only T1432 Discord messages tests+guide; Telegram production/tests/guides and skill/CHANGES byte unchanged. Joined old hub then5000ms fake downtime before replacement ages Identify/REST pacing; dedicated discord-messenger 4999/5000 spacing and admission helper unchanged. Cursor ingress/durable result/replay/two-message assertions and both reaction arms' sent settlement/native Identify/lost-frame/exact emoji+2PUT census retained;1500ms setup bounds unchanged. Source-only; C1 runtime stale, fresh mode-free verify then original-record evidence review required at unchanged6b17027f. A-13395 remains failed partial124/2Discord failures/cursor timeout/Webunexecuted; prior d172green and A-13358 bounded T3 carry remain their original-head evidence,not new-head pass. No Reviewer executions/edits or per-item QA; Coordinator owns enqueue.

### rev-32 · 2026-10-28T19:14:20.640Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1424-evidence3
commit: 6b17027f4464afcd4a69a8e25f4549990696b8a7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13419 final evidence3 clear; C1 current verified at unchanged delta4 head. Original55e495bd/A-13417 independently parsed3973ordinary test passes/501file passes +50separate load tests,zero nonpassing/unfinished. Four held reaction revocation arms and legacy recovery each base+5/5 explicit passes,max own0.514241311s; captured numeric pairing,actual delivery,exact one👌/no👀,unsettled progress,album targets[1,2]/completion retained. Inbound41/cards62/notices14 pass; exact cards consumer/current recovery pass. Shared-fix Discord messages24/24 incl prior cursor and2reaction failures now actual passes(.182/.252/.213s); Web copied-tracker passes. HostT0 check/gate778935c2 separate; Linuxc8sfo2 T1/allT2fallback/Web complete,Node24.21/Nvim.12.5/Shell156v1248,2general/4Web workers,life957s/$0.0665 notsuitewall. Budgets/lint134findings report-only. No currentT3/T4. Coordinator-authorized prior978e7bda A-13358 successful T3/polling carry remains separately audited in A-13385,whole Web-red/2fail/8skip/no separateT4phase. PriorA-13395 stays partial red124,old d172green stays old-head. No Reviewer executions/edits/reruns/per-item QA. Ready report may follow Coordinator sequence; enqueue belongs Coordinator.

Criteria: C1 verified.

### coord · 2026-10-28T19:20:41.557Z

Merged 0e3291f7de7d98951d5d426057bd0c5366e7911c onto dev.
