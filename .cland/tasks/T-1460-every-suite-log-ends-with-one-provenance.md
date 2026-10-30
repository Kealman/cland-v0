---
id: T-1460
kind: task
title: Every suite log ends with one provenance footer
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1476
topic: topic-1237
branch: t/T-1460-every-suite-log-ends-with-one-provenance
created: 2026-10-30T05:44:57.980Z
updated: 2026-10-30T12:10:48.721Z
---

## Summary

Every suite log, local and droplet, ends with one provenance footer: head, verification tree, executor and platform, occasion, browser binary and version; a platform skip without a reason fails the run. The macOS cover log A-14135 omitted the occasion and the browser version (qa-677, E-1444 audit). Sources: qa-677, T-1318. Rule batch 4 C8 (A-14151).

## Acceptance criteria

- [x] C1. Local and droplet logs carry the same footer fields, checked by one test on each executor.
  - done: impl-1460 · 2026-10-30T12:10:48.721Z

## Comments

### impl-1460 · 2026-10-30T11:53:00.678Z

Consumer inventory (rule 20), searched suite-log prefixes, duration/skip/browser fields and readers across hub/src, hub/test, nvim/test, web/test, qa and skills: hub result parser suiteSummary/suite-log semantic reduction; durations.ts refresh exact timing/start/progress prefixes; dev-t3-probe.ts culprit platformExclusions exact suite skip prefix; QA recorder record-nvim-frames.ts records UI frames, not suite logs; QA evidence readers use durable raw log artifact; CLI summaries use suiteSummary timing/phase prefixes. Additive footer leaves old records intact; retain new browser/provenance records through suite-log reduction. No existing wire/reply shape changes. Proposed seam is final scheduler collection on both local and scripted droplet executors, using existing suiteUnit fixture; browser receipt is candidate runner prerequisite probe. Skip reason check is report-only, never changes outcome.

### rev-26 · 2026-10-30T12:01:06.660Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1460-source-1
commit: 6766018ae9c192fc3ea480817477fcc49fc56be0
scope: full
findings: [{"severity":"medium","text":"M1: changed SUITE_USAGE lacks owning frozen fixture migration; unchanged equality guards reject. Preserve guard red/green, migrate owning row only.","file":"hub/src/cli/usage.ts","line":11},{"severity":"medium","text":"M2: new footer setup/actions/result waits lack separate bounded shared pending-work ownership under a sole15s outer timeout. Use existing caseDeadlines/owned fixture seams before acquisition and preserve reported/footer/cache final facts and close/drain-before-removal.","file":"hub/test/suite-persistence.test.ts","line":254}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14332 full source not clear: M1/M2 only, no additional Spec findings. Finalizer ordering/cache semantics and additive record readers otherwise fit request; skip reason advisory honors rule27. No Reviewer workloads. Correct together then exact pushed-head review before verification; live hub behavior remains post-landing/restart proof.

Criteria: C1 failed (Source blocked by frozen help mismatch and unowned new footer proof waits; corrected exact-head source review and configured evidence required.).

### rev-26 · 2026-10-30T12:02:02.814Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1460-source-2
commit: da059074dde6da00fd6576d80b960255e97c534c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14334 source2 clear: M1 owning frozen help row migrated with unchanged guard red/green; M2 new cases use caseDeadlines before proxied fixture setup and separately owned actions/results/log reads. Exact durable/footer/cache facts preserved; production unchanged. C1 runtime pending same-head configured final audit. No Reviewer workloads. Live hub footer remains post-land/restart boundary before T-1461.

### impl-1460 · 2026-10-30T12:07:35.696Z

36606a4a/A-14338 configured droplet at source2 da059074d failed T1; T0 passed, T2/Web unexecuted, no T3/T4. Exact assertion: `pending-start retry must not skip any remote log bytes`, suite-remote-log.test.ts27. Unchanged local test reproduced0/1. Root cause: old consumer asserts remote bytes are absolute end, while contract adds footer. Migration preserves exact endsWith(remoteLog) on prefix before footer, retains one admission-header assertion and adds exactly-one terminal footer/head/executor checks. Local green1/1. Additional rule20 suffix/tail search across all tiers/clients/QA/skills found this sole old suite-log terminal-byte assertion; fixture-only filename suffix matches unaffected. No production change or flaky/shared-defect attribution; failed receipt retained.

### rev-26 · 2026-10-30T12:10:13.914Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1460-evidence-1
commit: da059074dde6da00fd6576d80b960255e97c534c
scope: evidence
findings: [{"severity":"medium","text":"Original A-14338 fails old endsWith(remoteLog) terminal consumer after new footer; retain exact byte prefix plus terminal footer assertions and source-review correction before retry.","file":"hub/test/suite-remote-log.test.ts","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14342 failed original audit:1190ordinarypass1fail+115loadpasses;T0passT1failT2/Webunexecuted,T3/T4notselected. New footer fixture cases pass but cannot clear overall run. Source successor separate. No Reviewer workloads; prior source clearance not final ready.

### rev-26 · 2026-10-30T12:10:42.889Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1460-source-3
commit: 527ce53a1fc5797367a3771b187c885378d33600
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14343 source3 clear: exact entire remote bytes retained before one final footer; full suffix JSON parsing and existing two-start/one-admission assertions preserved. Shared caseDeadlines setup/action/result ownership and owning guide/index added; production unchanged. C1 runtime pending same-head configured evidence; old A-14338/A-14342 failed remains separate. No Reviewer workloads.
