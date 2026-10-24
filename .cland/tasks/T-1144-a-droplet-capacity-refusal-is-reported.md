---
id: T-1144
kind: task
title: A droplet capacity refusal is reported as a red periodic dev T3 run, and no executor fallback applies
state: open
status: review
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-940
branch: t/T-1144-a-droplet-capacity-refusal-is-reported
created: 2026-10-22T15:30:31.381Z
updated: 2026-10-24T08:25:16.311Z
---

## Summary

From 15:21Z on 2026-10-22, DigitalOcean offered no c-8 in any of the snapshot's regions (lon1, nyc1, sfo2). Every droplet run failed before execution with `droplet size c-8 unavailable in regions lon1, nyc1, sfo2`: two T-1104 task runs (A-9200, A-9201) and the periodic dev T3 run 45af0c60 at f35f5e2b (A-9210). The hub posted that periodic run as "Periodic dev T3 red", although no test ran ("counts unavailable"), and then started a culprit search that ended "inconclusive; no failing files identified".

## What to build

A run refused by the provider before any test executes reads as unavailable, not red. The periodic notice says "not run: provider capacity", it starts no culprit search, and it does not move the last-green or last-red markers. Task runs get the same distinct outcome, so leads do not mistake it for a failure. Whether a fallback (another region or size) applies is a separate decision for the human, because it changes spend.

## Acceptance criteria

- [x] C1. A periodic dev T3 run whose droplet acquisition is refused for capacity posts a "not run" notice naming the refusal, with no "red" wording and no culprit search (test).
  - done: impl-1144 · 2026-10-24T08:24:01.065Z
- [x] C2. A task verify refused for capacity before any test reports a distinct unavailable outcome in its result and its suite result line (test).
  - done: impl-1144 · 2026-10-24T08:24:01.253Z

## Comments

### coord · 2026-10-22T15:44:54.346Z

Related, from rev-32 (T-1117 review, A-9249). A reviewer cannot record 'runtime evidence unavailable' at a head. A not-clear evidence verdict requires a nonempty failed list, so a capacity refusal can only be told to the lead in prose. Consider a verdict or evidence state for 'not run (provider)' that names no criterion failure, alongside C2's distinct unavailable outcome.

### impl-1144 · 2026-10-24T08:15:10.957Z

C1/C2 red→green at sealed fake-provider/public-report seams: unavailable region catalog first produced `Periodic dev T3 red` and `auto exit 1`; capacity now retains outcome.notRun=provider-capacity plus original cause and reports not run/unavailable. Default and explicit droplet task paths covered, no local/region/size fallback. Item verify projection and journal display also required migration from exit-code-only failure labels; Neovim recorded client updated. Baseline/restart/retry coverage extended for provider capacity.

### rev-26 · 2026-10-24T08:21:56.146Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1144-source-1
commit: 484a0d118122f62ce1ac6fcd1eb3e8fda60c4f77
scope: full
findings: [{"severity":"medium","text":"M1 (C1/C2): checkSpend still generically rejects missing/unavailable configured sizes; Suites#start calls it at528 before durable job persistence536 for explicit droplet/periodic requests. No provider-capacity result/status/line is created, and periodic emits generic skipped. validateSize similarly rejects explicit --size capacity before admission (Suites426–430). Carry typed capacity through admission, preserving malformed-slug/invalid-price/auth/spend errors; add configured unavailable/absent size and explicit-size public controls.","file":"hub/src/executor/droplet/droplet.ts","line":160},{"severity":"low","text":"L1 aside Bugs/S: common shard aggregation drops child notRun markers, so an all-unexecuted capacity-refused stage/close group becomes failed/red at parent. Outside requested unsharded periodic/task C1/C2 scope; reported to lead for Coordinator follow-up. Keep mixed executed/unexecuted groups distinct.","file":"hub/src/hub/suites.ts","line":834}]
finding_counts: {"high":0,"medium":1,"low":1}

Completefullsourceaudit484a0d11/treeb46e2a07 baseaafdc9a4. Blocking M1medium preadmissioncapacitygap, accepted bylead; L1low shardedparentaside separatelyreportedforfiling. NootherblockingStandards/Specfindings. Region-refusal acquiredpath/T1015durability/baselines/retry/nocover/search, taskunavailableprojection, journal/WebCLI/Nvim consumer migration anddocs/help/skillprovenance otherwisealign. AddedNvimrecordingsretained23adds/0deletes, noexistingassertionrelaxation. A-10506 narrativeworking-tree9T1/15T2/15record-replay/check0 is targetedsupport, notrawconfigured/Linux/T3proof; preserveoriginalstdout/exits/native timings/sourceattributionwithouttranscriptionreruns. A-10515: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10515-t-1144-source-review-at-484a0d11.md. C1/C2failedM1; fix,remarkdone, freshsource beforemode-freeverify. NoReviewer runtime/edits.

Criteria: C1 failed (Configured size unavailable/absent can be rejected by checkSpend before a durable periodic not-run result exists.), C2 failed (Task explicit-droplet/size admission can throw a generic capacity error before durable unavailable result/status/suite publication.).

### rev-26 · 2026-10-24T08:25:16.311Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1144-source-2
commit: 76cbf0d24da306d48cdb2b04841d017820cb5688
scope: delta
findings: [{"severity":"low","text":"L1 retained aside Bugs/S: all-unexecuted capacity-refused sharded stage/close groups lose child notRun at parent aggregation. Outside requested unsharded periodic/task C1/C2; separately reported to lead/Coordinator for follow-up, preserving mixed execution distinctions.","file":"hub/src/hub/suites.ts","line":844}]
finding_counts: {"high":0,"medium":0,"low":1}

Corrected source clear76cbf0d2/tree60fafa8d; M1resolved. validateSize/checkSpend typerealcapacity, Suites retains typedrefusal/cause through durableadmission; negativeprice/auth/spend/inputerrorsstayrefusals. Public15capacitycontrols(3states×periodic/4taskflagcombinations) plus8negativeadmissioncontrols retainfinalresult/status/verify/headline/no-search/no-fallback/no-provider-mutationassertions. Noadditionalblockingfindings; L1lowasidecarried. Eight-filecorrectionwithmatchingdocs/skillCHANGES, no devmerge; Nvimsource/fixturesunchanged. A-10517rootcheck0 real23.06s/lint133/60report0refusals; A-10518T2 35/35 native4874.351417ms real4.90s; A-10519T1 9/9 native784.010917ms real0.81s, exact-headlocalmacOSrawoutputs. OriginalNvimreceiptsremainnarrativeA-10506; currentconfiguredreplaypending. C1/C2runtimeawaitexact-headmode-freeconfiguredreceipt, noconfiguredgreen/LinuxT3T4/QAclaim. A-10521: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10521-t-1144-corrected-source-at-76cbf0d2.md. Proceedverifyunchangedhead.
