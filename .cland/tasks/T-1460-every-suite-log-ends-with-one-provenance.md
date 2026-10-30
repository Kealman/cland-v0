---
id: T-1460
kind: task
title: Every suite log ends with one provenance footer
state: open
status: ready
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
updated: 2026-10-30T15:28:27.967Z
---

## Summary

Every suite log, local and droplet, ends with one provenance footer: head, verification tree, executor and platform, occasion, browser binary and version; a platform skip without a reason fails the run. The macOS cover log A-14135 omitted the occasion and the browser version (qa-677, E-1444 audit). Sources: qa-677, T-1318. Rule batch 4 C8 (A-14151).

## Acceptance criteria

- [x] C1. Local and droplet logs carry the same footer fields, checked by one test on each executor.
  - done: impl-1460 · 2026-10-30T12:27:24.788Z
  - verified: rev-26 [reviewer] · run rev-20261030-1460-evidence-3 · 2026-10-30T14:53:22.916Z · commit f2d967400773ba601fdfffecf82b7da3b5b5f3c4
  - verified: rev-26 [reviewer] · run rev-20261030-1460-evidence-4 · 2026-10-30T15:28:27.885Z · commit 6996fc482158e9231bccd547de7ef7d5e85654b4

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

### rev-26 · 2026-10-30T12:24:33.629Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1460-evidence-2
commit: 527ce53a1fc5797367a3771b187c885378d33600
scope: evidence
findings: [{"severity":"medium","text":"Original A-14359 fails old exact log-body consumer and oversized-result missing-frame timeout5000ms; preserve full payload/priority/auth/cache assertions while diagnosing.","file":"hub/test/suite-protocol.test.ts","line":118},{"severity":"medium","text":"Original cached/stage several20MB case times out120000ms (cancelled), not a passing work/heap budget receipt; retain shared-scan/streaming assertions through diagnosis.","file":"hub/test/suite-log-backfill.test.ts","line":74}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14360 original audit:3576ordinarypass2fail1cancelled+115loadpass;T0/T1pass,T2partialfail,Web/T3/T4unrun. New footer casespass but whole resultnotclear; C1 final markpending. Shared log/tmp source risk sent for reproduction, not proven rootcause. No Reviewer workloads; changed head needs source review before retry; old failures retained.

### impl-1460 · 2026-10-30T12:26:39.992Z

A-14359 successor at527ce53a remains failed. Exact protocol old-byte mismatch and shared-path missing-frame reproduced locally13/15; backfill reproduced timeout/cancelled at bounded15s/10s, no flake classification. Production correction serializes legacy shared log path through finalization AND artifact publication; retains shared fixture paths and asserts each artifact footer cache identity. Byte consumer migration preserves exact original batch bytes before footer. Backfill diagnostics (removed) found5cached jobs unreported/errornull: fake scheduler required next inspection tick after concurrent starts; one f.tick before exact results resolves, with original source-scan/persistence/heap checks intact. Shared caseDeadlines owns setup + stage/cache operation. Local green protocol15/15,3.264s; backfill3/3,2.766s; persistence14/14,2.541s; docs3/3; macOSarm64 fixtures only. Typecheck passed, lint running. Expanded consumer list: suite-protocol full-log equality/shared-path seeds and suite-log-backfill concurrent cache reporting observer. Production rule20 legacy shared-path compatibility retained; no dev merge or successor run before fresh review.

### rev-26 · 2026-10-30T12:29:09.651Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1460-source-4
commit: 26a16be199e640aac5bc5fcbb4580e24c899d59a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14366 source4 clear: shared-path finalizer holds through awaited artifact publication, retained shared fresh/cached fixture checks own footer; exact original batch bytes preserved before footer. Backfill drives next fake scheduler tick before reported results, retaining scan/reuse/persistence/heap bounds and shared caseDeadlines setup/drain. C1 final runtime pending same-head configured evidence. A-14359/A-14360 and prior failed receipts remain separate; no Reviewer workloads. Live landing/restart boundary unchanged.

### rev-26 · 2026-10-30T14:33:16.843Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1460-source-5
commit: f2d967400773ba601fdfffecf82b7da3b5b5f3c4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14433 authorized merge delta clear: own production/test bytes unchanged; imported T-1485 files match dev; provenance/browser skill sections preserved and help fixture coherent. A-14379 stays failed old-head evidence, C1 current runtime pending configured original receipt. No Reviewer workloads; live own-landing+restart boundary unchanged.

### rev-26 · 2026-10-30T14:53:22.916Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1460-evidence-3
commit: f2d967400773ba601fdfffecf82b7da3b5b5f3c4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14467 independently audits original A-14456/3aaec351: 4264 ordinary passes plus 115 load passes, T0/T1/all fallback T2/Web complete, T3/T4 unexecuted. Both exact local/droplet footer fixture cases base+5/5 load pass, retained terminal/cache/shared-path byte assertions; protocol/backfill regressions pass. Scripted executor fixtures distinguished from enclosing real Linux droplet. Advisory timing/lint/ratchet findings retained; prior failed receipts remain failed. C1 verified at frozen f2d967400 only. Later authorized T-1458 merge still needs source delta review; live footer after own landing/restart remains separate. No Reviewer workloads.

Criteria: C1 verified.

### rev-26 · 2026-10-30T15:04:40.956Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1460-source-6
commit: 6996fc482158e9231bccd547de7ef7d5e85654b4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14487 authorized T-1458 merge delta clear: own footer production/four test files unchanged, imported four-line readiness report composes before retained browser-version callback. Combined help/frozen rows/skills/docs preserve both policies; imported guards remain report-only, known T-1484 CLI probe incomplete not pass. C1 current runtime pending fresh same-head configured original; predecessor green not carried. No Reviewer workloads. One mode-free verify may proceed then final review; live landing/restart separate.

### rev-26 · 2026-10-30T15:28:27.885Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1460-evidence-4
commit: 6996fc482158e9231bccd547de7ef7d5e85654b4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14510 independently audits A-14509/afd6051f: 4272 ordinary and 115 load passes, T0/T1/all T2/Web complete, T3/T4 unrun. Both exact footer cases base+5/5 pass with timing parity; cache/shared-path/byte/backfill regressions pass. Readiness report precedes retained actual browser version-only record, distinct from passing Web execution. Scripted local/droplet fixture scope and known T-1484 incomplete installed CLI advisory retained. C1 current-head verified; older receipts retain original heads/outcomes. Live own landing/restart separate. No Reviewer workloads.

Criteria: C1 verified.
