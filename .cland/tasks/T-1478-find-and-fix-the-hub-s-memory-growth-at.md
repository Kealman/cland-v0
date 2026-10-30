---
id: T-1478
kind: task
title: Find and fix the hub's memory growth at rest, and add a memory budget report
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by:
  - T-1483
topic: topic-1235
branch: t/T-1478-find-and-fix-the-hub-s-memory-growth-at
created: 2026-10-30T07:54:04.924Z
updated: 2026-10-30T22:28:17.687Z
closed: 2026-10-30T22:28:17.687Z
---

## Summary

The live hub grew from 4.4 GB to 6.7 GB footprint in 75 minutes with the crew idle (T-204, restart #61 record, 2026-10-30), a growth that the T-1467 startup measurement does not explain. Measure a scratch hub at rest for 30 minutes with heap sampling, name what accumulates, fix it, and add the memory budget report.

## Acceptance criteria

- [x] C1. A 30-minute at-rest run of a sealed scratch hub on a copy of this project records heap, RSS and footprint every 10 s, and a sampling heap profile names the sites whose retained size grows over the run.
  - verified: rev-26 [reviewer] · run rev-20261030-1478-evidence-2 · 2026-10-30T22:10:13.085Z · commit aa8e5ecdf0333cbcb134b76709dbf47332b2d3aa
  - done: impl-1478 · 2026-10-30T22:12:08.127Z
  - verified: rev-26 [reviewer] · run rev-20261030-1478-source-7 · 2026-10-30T22:21:35.577Z · commit 0c2236271361ed3123a6fca41f5aeb440593fe41
- [x] C2. Each growing site found is fixed or filed with its evidence, and the at-rest slope after the fixes is published next to the before slope, same probe and machine.
  - verified: rev-26 [reviewer] · run rev-20261030-1478-evidence-2 · 2026-10-30T22:10:13.085Z · commit aa8e5ecdf0333cbcb134b76709dbf47332b2d3aa
  - done: impl-1478 · 2026-10-30T22:12:08.246Z
  - verified: rev-26 [reviewer] · run rev-20261030-1478-source-7 · 2026-10-30T22:21:35.577Z · commit 0c2236271361ed3123a6fca41f5aeb440593fe41
- [x] C3. A memory budget check, in report mode (rule 27), runs on live-scale fixture data and reports heap and RSS at readiness and after a fixed rest period against a budget agreed with the human.
  - verified: rev-26 [reviewer] · run rev-20261030-1478-evidence-2 · 2026-10-30T22:10:13.085Z · commit aa8e5ecdf0333cbcb134b76709dbf47332b2d3aa
  - done: impl-1478 · 2026-10-30T22:12:08.716Z
  - verified: rev-26 [reviewer] · run rev-20261030-1478-source-7 · 2026-10-30T22:21:35.577Z · commit 0c2236271361ed3123a6fca41f5aeb440593fe41

## Comments

### impl-1478 · 2026-10-30T11:52:09.291Z

Confirmed test seam from item/T-1467 guidance: sealed measure-memory.ts worker through memoryProducer IPC and native-close receipts, plus offline aggregate analysis. Consumer inventory for probe-only additions: measure-memory.test.ts, memory-producer.ts, analyze-memory.py, docs/agents/tests/hub-test-measure-memory.test.ts.md, implement skill memory guidance. No production/wire contract change planned yet; production growth-site inventory follows measurement.

### impl-1478 · 2026-10-30T11:59:48.103Z

Probe preparation progress on base origin/dev bb353309ee4467e8fabc67aef40c02933505fca9 (contains T-1476/T-1477): rest measurement and report-only comparisons committed as 2aa324491; streaming helper now passes synthetic six-run durable result/cleaned receipts. Latest touched T3 file: 20/20 passed on local macOS arm64, embedded hub/fake executor, no browser. Rest and streaming controls were red before implementation. No live-scale hub launched; no slopes or final budget claimed. T-1483 owns newly found copied recovery/live-path hazard; measurements wait for its landing plus Coordinator slot. Probe-only consumer inventory expands to memory-budget.ts and memory-streaming.ts; production wire/schema unchanged. Budget limits remain unconfigured until measured and human-agreed.

### impl-1478 · 2026-10-30T12:14:41.609Z

T-1483 integration update: replacement source review pending after indirect artifact paths, relative paths, lifecycle ownership and recovered PID authority fixes. Its preparation/worker seed boundary is unchanged. Measurement comparisons must disclose cleared copied suite artifact IDs, rewritten artifact-index paths and removed artifact redirects/entries, with artifact row counts retained. These payload-attribution exclusions add to sparse body placeholders. No live-copy measurement launched; await landed fix and Coordinator slot.

### rev-26 · 2026-10-30T20:02:24.550Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1478-source-1
commit: 3e793e12fe9c9cc90c9d8aeb6301e9a2ade1f422
scope: full
findings: [{"severity":"medium","text":"M1 (Spec/C3): periodic sampling remains admitted after the rest-end sample through native capture and concurrent disposal; queued samples keep overwriting restMemory, so completed-rest budget output can use a later shutdown value. Freeze an immutable endpoint while the hub runs, close admission and drain admitted work, and bind phase/time per sample.","file":"hub/test/measure-memory.ts","line":327},{"severity":"medium","text":"M2 (Standards/rule9): the 20-second completion deadline is checked only around an unbounded await settled(); a held settlement bypasses the deadline. Bound the exact settlement/result operation using shared deadline/ownership, retaining release/join and explicit incomplete evidence.","file":"hub/test/memory-streaming.ts","line":57},{"severity":"medium","text":"M3 (Spec/rule17): native('startup') now executes after rest/streaming, mislabelling the end-of-run vmmap capture as startup-vmmap.txt. Capture readiness before rest or label the end boundary accurately, migrate readers/docs and retain ordering controls.","file":"hub/test/measure-memory.ts","line":335}]
finding_counts: {"high":0,"medium":3,"low":0}

A-14666: probe tooling source not clear for M1 immutable rest endpoint, M2 bounded streaming settlement, M3 truthful native capture labels. T-1483 isolation/seeding order retained. No live-scale measurements or criterion completion claimed; C1/C2 pending and C3 tooling correction required. Coordinator measurement grant/human budget agreement remain separate. Fresh source review before measurement; no Reviewer execution.

Criteria: C3 failed (Completed-rest budget endpoint can be overwritten by later shutdown samples; freeze and prove the exact measurement boundary before live-scale reporting.).

### rev-26 · 2026-10-30T20:08:25.667Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1478-source-2
commit: fe3a535eedac107adeed7f9d6c642214184d769e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14668: M1–M3 source defects closed: immutable still-live rest endpoint, owned/bounded settlement and truthful readiness native capture. T-1483 sealing and synthetic-only seams unchanged. Tooling/source-only clear; C1/C2/C3 remain incomplete/unverified with no live-scale run, slopes or agreed budget. Coordinator slot and human budget agreement remain separate; no Reviewer workload or measurement grant.

### rev-26 · 2026-10-30T20:17:16.447Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1478-source-3
commit: 51f579f6d4cb6a4503cddf6af53ba3714c4fb9c7
scope: full
findings: [{"severity":"medium","text":"M4 (Spec/grant and owned shutdown): expiry starts disposal only ten seconds before the grant, while memoryProducer can spend ten seconds graceful wait plus captured-process fallback plus another ten-second close wait, and blocking probes add scheduling delay. Use one full shutdown/slack reserve for phase admission and expiry; prove forced native close before a short injected grant endpoint.","file":"hub/test/measure-memory.ts","line":132},{"severity":"medium","text":"M5 (Standards/rules9,17): parent guard catch discards native read/parse failure and worker guard drops refusal text, so unknown/worker-only stops lack durable cause/native failure evidence. Persist bounded redacted unavailable/refusal diagnostics and retain guard-interrupted classification through native disposal.","file":"hub/test/measure-memory.ts","line":146}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14670: explicit quiet-slot guard source not clear for M4 complete disposal reserve and M5 durable failed-reader/refusal facts. Source2 M1–M3 stay closed, sealing/default budget behavior unchanged. No measurement criterion was executed or verified; C1–C3 remain pending. Later Coordinator ee3f625d requires fresh measure-ready/grant after source clearance, not running against the old20:36 window.

### rev-26 · 2026-10-30T20:30:00.513Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1478-source-4
commit: 66ba42ca2aa11424040f2f465c0987d079aebda1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14674: M4/M5 closed by shared full disposal reserve/deadline-aware launch-birth fallback and durable guarded-reader facts; source2 boundaries and T-1483 sealing retained. Source/tooling only clear, no criteria verified and no measurement slot granted. C1–C3 stay incomplete pending actual live-scale records, diagnosis/before-after evidence and human-agreed report limits. Request fresh Coordinator machine check/24-minute grant per ee3f625d; preserve incomplete/forced/native-unknown distinctions.

### impl-1478 · 2026-10-30T20:37:00.428Z

First live-scale diagnostic on66ba42ca2 aborted before readiness; A-14676 retains curated receipts and original private root remains unchanged. No idle slope/streaming result. Coordinator572bb1d0 corrected raw vm.memory_pressure counter versus native level. New sourcec4550248d adds pressureLevel/freeMemoryPercent, preserves rawpressure field, guards only nativelevel<=1; context counter neverabort. Consumer inventory: memory-machine-guard exports used only by measure-memory.ts parent/worker and measure-memory.test.ts; persisted private machine-preflight/guard-stops/supervisor/system JSON records consumed manually for evidence. Existing rawpressure field retained; old records missing nativelevel remain unknown, never rewritten. Offline allocation/sample analysis reads memory/time fields, unaffected. No production wire/client schema, T1/T2/T4 or Web/Nvim contract changes. Final source57/57 local T3 controls, typecheck0/lint0; replacement delta review pending before new slot request.

### rev-26 · 2026-10-30T20:37:53.379Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1478-source-5
commit: c4550248dfe93953c03e97436fa5fd43a5e39b9a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14678: approved native pressure-level metric correction clear; transient counter/free percentage contextual, shared guard/batched sealed native receipt and75s reserve retained. Source/tooling only; C1–C3 remain incomplete/unverified. A-14676 old attempt stays aborted with no readiness/slope or warning-level inference. Request fresh measure-ready/grant after released slot, no authority from this verdict to launch.

### coord · 2026-10-30T21:08:10.689Z

C3 budget agreed: heap 256 MiB and RSS 768 MiB, report only (rule 27). The answer to ask 53ad10db came at 2026-10-30 21:08:07Z, as the human under the standing permission of 2026-10-28 05:04Z («Да, и давай для всех будущих подобных сразу да на все»), relayed by the stand-in. Basis: measured maxima heap 166.6 MiB and RSS 586.0 MiB (A-14690), so the budget is about 1.5×.

### rev-26 · 2026-10-30T21:10:51.356Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1478-source-6
commit: aa8e5ecdf0333cbcb134b76709dbf47332b2d3aa
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14693: agreed256MiB heap/768MiB RSS defaults clear under Coordinator5e054584/ask53ad10db. Single exported default, explicit overrides, generic unconfigured distinction and report-only exits preserved; docs/help/skill aligned. Sampling/endpoint/isolation/disposal/guard behavior unchanged. Source/tooling only: no C1–C3 verification, no fixed-leak/final-ready claim, no slot extension. Intermediate original-record numeric audit remains separate.

### rev-26 · 2026-10-30T21:12:05.658Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1478-evidence-1
commit: c4550248dfe93953c03e97436fa5fd43a5e39b9a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14694: intermediate interpretation only clear; no criteria verified/final readiness. Independent original A-14692 hashes/script identity, OLS/maxima, live endpoint-budget equality, native close and all-stack stage sampling comparisons reproduce A-14690. Positive post120s idle slope and two one-quantum candidates remain unconfirmed. Both600s diagnostic budgets remain unconfigured; later agreed256/768/source6 separate. Explicit stage profiles valid; native automatic-exit-profile error retained as limitation. Different input snapshots/contention/exclusions disclosed. Coordinator c1945457 C2 disposition and same-probe-before unavailability preserved; final1800s original records pending.

### impl-1478 · 2026-10-30T21:46:20.837Z

Final once-only1800s record complete on aa8e5ecdf, original numeric evidence A-14699; final narrative artifact posted. C2 required limit explicitly recorded per Coordinatorc1945457: no production fix justified or fixed leak claimed; same-probe before unavailable/not reproducible because T1476/T1477 landed first, not zero. Current 30min after slopes heap-0.204/RSS+0.054/footprint-1.055MiB/min; after120s footprint+0.252 retained. Final sampled survivors96.958->81.939MiB, no positive source stacks, so prior1MiB candidates not filed under disposition. Historical live 48336 8.2GB/88min,17875 5.3GB/2h43 and post79176 943MB/+10min,1255MB/2h02 are different-probe context only. C3 agreed256/768 report-only defaults; readiness140.460/586.125MiB and endpoint99.483/549.141 allwithin, native/disposalcomplete. Final source review/verification still pending before ready.

### rev-26 · 2026-10-30T22:10:13.085Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1478-evidence-2
commit: aa8e5ecdf0333cbcb134b76709dbf47332b2d3aa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14710: C1/C2/C3 verified at ORIGINAL aa8e5ecdf only: actual1800.578s/182Mac samples/profile/immutable endpoint/native-disposal proof plus configured6946de51/A-14709 native0,4869ordinary+125loadpasses,5657IDsallpaired. T0/T1/allT2/selected23T3/Web0;remainingT3/T4unexecuted. C2 c1945457 disposition preserves unavailable same-probe-before/different-probe live context/no fixed-leak claim; no positive final sampled stack, slow positiveRSS/footprint caveats retained. Human-agreed256/768report-only actual fourwithin; automatic exit-profile unavailable separate from validstageprofiles. Source6clear remains baseline. Lead39bd1213 proposed docs-conflict merge NOT cleared: hold final readiness for new pushed-head delta/waiver; no old-run relabelling.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1478 · 2026-10-30T22:19:52.003Z

Docs-conflict waiver supplement A-14714: pinned merged head0c2236271/tree9c35956f6; both-tree literal text, phrase, reader and identifier inventories,67 candidate dispositions,28 single-file native code0 receipts/337passes/0skips on local macOS arm64 Node24.21.0, no browser/fullsuite. Original configured verify and1800s measurement remain predecessor aa8 evidence A-14709/A-14710; no relabelling. Fresh fetchdev aa73012f/merge-tree clean exact candidate tree; own source diff empty. Exact-head Reviewer delta settlement pending.

### rev-26 · 2026-10-30T22:21:35.577Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1478-source-7
commit: 0c2236271361ed3123a6fca41f5aeb440593fe41
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14715: exact docs-conflict delta clear; C1–C3 carried under standing d4eb4f30/active rule6. Both README sections retained, own probe/helper/analyzer unchanged, imported production matches dev. A-14714 closes waiver evidence gap: independently reproduced67-file union/39 scoped unaffected dispositions,28 original nonoverlapping native closes0/null,337passes0adverse,hashes/scan valid. Predecessor actual1800s Mac/A14699 and configured6946de51/A14709 remain labelled aa8, final auditA14710; no merged-head measurement/full-run claim. C2 unavailable same-probe-before/different-probe live context/no fixed leak, slow positive RSS/footprint, valid stage versus unavailable automatic profile and report-only256/768 limits retained. Final readiness permitted by waiver; lead reports exact SHA/fresh conflict check to Coordinator.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-30T22:28:17.687Z

Merged e410380a8ebff06662f6718f56e8609517f7cfaa onto dev.
