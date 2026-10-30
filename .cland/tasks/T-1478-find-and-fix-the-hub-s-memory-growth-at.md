---
id: T-1478
kind: task
title: Find and fix the hub's memory growth at rest, and add a memory budget report
state: open
status: review
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
updated: 2026-10-30T20:37:53.379Z
---

## Summary

The live hub grew from 4.4 GB to 6.7 GB footprint in 75 minutes with the crew idle (T-204, restart #61 record, 2026-10-30), a growth that the T-1467 startup measurement does not explain. Measure a scratch hub at rest for 30 minutes with heap sampling, name what accumulates, fix it, and add the memory budget report.

## Acceptance criteria

- [ ] C1. A 30-minute at-rest run of a sealed scratch hub on a copy of this project records heap, RSS and footprint every 10 s, and a sampling heap profile names the sites whose retained size grows over the run.
- [ ] C2. Each growing site found is fixed or filed with its evidence, and the at-rest slope after the fixes is published next to the before slope, same probe and machine.
- [ ] C3. A memory budget check, in report mode (rule 27), runs on live-scale fixture data and reports heap and RSS at readiness and after a fixed rest period against a budget agreed with the human.
  - failed: rev-26 [reviewer] · 2026-10-30T20:02:24.550Z · note Completed-rest budget endpoint can be overwritten by later shutdown samples; freeze and prove the exact measurement boundary before live-scale reporting.

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
