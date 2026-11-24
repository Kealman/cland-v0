---
id: T-1996
kind: task
title: suite-soak-component's periodic cover ancestry case still runs native Git in T2
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1753
branch: t/T-1996-suite-soak-component-s-periodic-cover
created: 2026-11-19T03:24:57.656Z
updated: 2026-11-24T17:56:33.362Z
closed: 2026-11-24T17:56:33.362Z
---

## Summary

`hub/test/suite-soak-component.test.ts` still contains the T2 case "periodic cover ancestry requires a positive native Git descendant receipt", which runs native Git. Native Git belongs in T3, as T-1652's review found for the bundle cases it moved (2026-11-19, impl-1652).

## What to build

Move this case to a T3 file with whole-caller ownership and native close joins, as T-1652 did for the bundle cases, or replace its native Git with a fake at the boundary and keep it in T2. Either way, the T2 file reaches no native Git.

## Acceptance criteria

- [x] C1. No case in suite-soak-component.test.ts runs native Git; the ancestry case runs in T3, or fake-only in T2 with a positively controlled launch guard (test).
  - done: impl-1996 · 2026-11-24T15:48:21.075Z
  - verified: rev-35 [reviewer] · run rev-35-1996-evidence-1 · 2026-11-24T16:25:52.180Z · commit 46f30bb255058aeca5597f862d1c9ee73ad3e413
- [x] C2. The case's assertions are unchanged, and its tier history is recorded so no T2 proof is reused for T3 (rule 41).
  - done: impl-1996 · 2026-11-24T15:40:11.471Z
  - verified: rev-35 [reviewer] · run rev-35-1996-source-1 · 2026-11-24T15:44:08.745Z · commit f8b5a69eb75824dbdebcd80f41055ba0b5405564
  - verified: rev-35 [reviewer] · run rev-35-1996-source-2 · 2026-11-24T15:48:12.828Z · commit d41ea35197e801aaa2d47cf072c7cfd8c3b051d3
  - verified: rev-35 [reviewer] · run rev-35-1996-delta-1 · 2026-11-24T15:49:37.790Z · commit 46f30bb255058aeca5597f862d1c9ee73ad3e413
  - verified: rev-35 [reviewer] · run rev-35-1996-evidence-1 · 2026-11-24T16:25:52.180Z · commit 46f30bb255058aeca5597f862d1c9ee73ad3e413

## Comments

### impl-1996 · 2026-11-24T15:37:20.315Z

Red: installing fixtureNativeGuard on the original ancestry case failed at owned native Git receipt: native launch forbidden: execFile. Green: scripted execFile custom promisifier preserves positive/reverse/missing production ancestry assertions, plus ordered boundary calls. Full changed T2 file 41/41 local macOS arm64 Node 24.21.0. Tier stays T2; prior native-labelled-T2 receipt is not fake-only proof. No production contract changes or T1 importers reached. Consumer search: case title and file references across hub/test, nvim/test and docs; updated both soak guidance pages; historical duration identity retained as history.

### rev-35 · 2026-11-24T15:44:08.503Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1996-source-1
commit: f8b5a69eb75824dbdebcd80f41055ba0b5405564
scope: full
findings: [{"severity":"medium","text":"Changed callback has no pre-acquisition whole-case owner or positive-close-gated fake/native-guard restoration; individual waits do not join the setup/body continuation through cancellation or rejected cleanup.","file":"hub/test/suite-soak-component.test.ts","line":44}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23053: Standards1medium/Spec0additional. Scripted custom promisifier, callback guard and exact Git argument assertions are correct; preserve them. M1 requires whole-callback ownership before guard/root acquisition and success-only fake/guard restoration, confirmed by ce799228. C2 source establishes unchanged positive/reverse/missing assertions, T2 history and exact old-duration-key removal without timing transfer. A-23051's superseded retained-history wording is not final manifest behavior. Hold released for correction/fresh committed source review; no configured submission at this not-clear head.

Criteria: C1 failed (Fake/native-guard lifetime is not fenced by positive whole-callback/resource cleanup on cancellation or rejected cleanup; lead confirms no owner/control/exclusion.).

### rev-35 · 2026-11-24T15:48:12.828Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1996-source-2
commit: d41ea35197e801aaa2d47cf072c7cfd8c3b051d3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23055: M1 resolved. Whole callback enrolled through suiteCase before guard/root acquisition, bounded setup adopts root, ancestry steps fenced. Explicit fixtureNativeGuard fenced=true owns denial; native=true suppresses duplicate suiteCase guard. Cleanup releases restore scripted execFile then outer guard only after successful original-work/resource/directory cleanup; failed cleanup retains patches. Positive/reverse/missing and exact-vector assertions retained. C2 source reverified at current head; duration/tier blobs unchanged from source1, stale native timing removed without transfer. C1 runtime remains pending and claimant done mark is still reset. Hold released; same-head configured result follows Coordinator window.

Criteria: C2 verified.

### rev-35 · 2026-11-24T15:49:37.790Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1996-delta-1
commit: 46f30bb255058aeca5597f862d1c9ee73ad3e413
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23056: exact clean431c9663c T-2091 diff, four prerequisite guard/docs paths only, source-reviewed inA-23050. Exact-file exception and adjacent/hub-package negative controls retained; no widened directory. Own ancestry/test guides/duration/tier blobs identical to source-cleared d41ea3519; C2 source reverified at new head. Coordinator217c255c grants one mode-free verify after delta clear;1bc5f47a explicitly reuses separate check receipts, no new-head check claimed. C1 runtime pending, and carried prerequisite regression must produce actual same-head pass. Hold released.

Criteria: C2 verified.

### rev-35 · 2026-11-24T16:25:52.180Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1996-evidence-1
commit: 46f30bb255058aeca5597f862d1c9ee73ad3e413
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23060: final A-23059/eec2f358 same-head clear. Fake-only ancestry paired pass at33748 plus5 distinct loaded passes; all41 component base cases pass. Source-cleared guard/whole-callback restoration and actual Git-vector assertions retained. C2 current source/history/duration proof preserved and all246T1 files pass. Carried T-2091 named boundary control passes at29418, all8 prerequisite guards pass, T0 report7 entries clear. Code0, complete exit0 T0/T1/T2/7selectedT3/Web, no unfinished records. C1/C2 verified. Remaining266T3 defer,18T4 unexecuted; report-only advisories, unknown cache and known F2 finish-only exclusion retained.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T17:56:33.362Z

Merged 9af601700e0c35969467ffbca5b05e8ac37a1499 onto dev.
