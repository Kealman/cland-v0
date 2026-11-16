---
id: T-1703
kind: task
title: OpenCode turnFailed after the store closes throws "database is not open" in the pending-permission adapter test
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by: []
regression_of: T-1696
found_by: droplet
topic: topic-1540
branch: t/T-1703-opencode-turnfailed-after-the-store
created: 2026-11-06T05:22:20.125Z
updated: 2026-11-16T14:01:36.893Z
closed: 2026-11-16T14:01:36.893Z
---

## Summary

T-1702's merge batch 927d727f (A-17026, Linux x64 droplet, peak load 6.4) failed `hub/test/opencode-adapter.test.ts:516` "a pending permission is waiting for approval within one event, and the reply brings the turn back; a form is waiting for human" (3.24 s). The error was `Error: database is not open` (ERR_INVALID_STATE) at `ProcessTable.bySessionId` (hub/src/adapters/processes.ts:293). The call chain was `Sessions.#turnFailed` (sessions.ts:2306), then `turnFailed` (sessions.ts:740), then generation-adapter.ts:76, then opencode.ts:595. An OpenCode turn-failure callback reached Sessions after the test's store had closed, which suggests a teardown race: the adapter callback isn't drained or fenced before the store closes. T-1702 doesn't touch the adapters, so this one is unrelated to it.

## What to build

Make OpenCode adapter callbacks such as turnFailed, arriving after Sessions or its store has closed, settle as a named no-op or be drained before the close, so a late callback never throws into the event loop. If the cause is in the test, make the test drain the adapter before closing its store. Never weaken an assertion.

## Acceptance criteria

- [x] C1. A deterministic test delivers an OpenCode turnFailed after the store closes and shows it red before the fix and green after.
  - done: impl-1703 · 2026-11-16T07:53:52.488Z
  - verified: rev-35 [reviewer] · run rev-35-1703-final-1 · 2026-11-16T10:16:01.543Z · commit ffe84f8ed6fead1bcca412fef153dc70148393f7
- [x] C2. opencode-adapter.test.ts passes 10/10 on Linux under load (evidence).
  - done: impl-1703 · 2026-11-16T10:09:00.445Z
  - verified: rev-35 [reviewer] · run rev-35-1703-final-1 · 2026-11-16T10:16:01.543Z · commit ffe84f8ed6fead1bcca412fef153dc70148393f7

## Comments

### impl-1703 · 2026-11-16T07:38:20.364Z

C1 deterministic red/green captured in A-19832. Captured OpenCode AdapterHost.turnFailed after awaited hub shutdown and positive closed-store control fails with database is not open before the two-line Sessions fence; full scripted T2 file passes 33/33 after. No shared reply, schema, or wire contract changes. Linux Docker load run in progress under exclusive slot.

### impl-1703 · 2026-11-16T07:43:49.708Z

C2 incomplete: Linux Docker sample1 green 21/21 at load8.15; sample2 red20/21 at load10.64 due unrelated restart fixture cleanup: native process identity unavailable for pid1761, native exit observed, listed descendants not confirmed gone. Reported shared-defect candidate to lead T-1703; holding native diagnosis/repeats. Both pending-permission cases passed; neither had database-is-not-open. Slot released.

### impl-1703 · 2026-11-16T07:50:59.162Z

Consumer/provenance inventory recorded in A-19851: exact callback producers, dynamic generation wrapper, relevant T1/T2/T3 consumers, startup/close, docs/QA dispositions and unexecuted evidence. Source contract fields unchanged; no wire migration. C1 focused20/20 saved A-19848 at bcb93f382, but hub typecheck failed TS2722 at new test lines20/26 (optional callback); reviewer notified, head held pending consolidated pass.

### rev-36 · 2026-11-16T07:52:31.865Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1703-source-1
commit: bcb93f38281034d79998a9275aaff8675503d6c8
scope: full
findings: [{"severity":"medium","text":"New direct calls to optional AdapterHost.turnFailed (also line26) lack narrowing. Actual pinned-head hub typecheck exits1 with TS2722 at20:3 and26:29, claimant confirmed/A-19851. Capture/assert callback presence before both calls, preserving live and closed-store controls; runtime Node greens do not make this regression buildable.","file":"hub/test/opencode-native.test.ts","line":20}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit A-19852: one confirmed medium test build blocker; no additional Spec findings. Product closed fence is correctly before table lookup, and runtime test positively proves live reporting/closed storage/late no-op through owned shutdown. A-19851 transcribed candidate/provenance/consumer limits retained. C2 still incomplete: raw native sample2 remains red under narrow Coordinator T-1905 counting disposition; remaining8 native samples and same-head verify pending. No criteria verified/final ready. Fix/narrow, restore mark and request fresh source review; no silent receipt carry or provenance-only reruns. Reviewer read-only, no tests/compiler/probes/Docker/delegation.

Criteria: C1 failed (New deterministic regression fails pinned-head TypeScript with TS2722 on optional turnFailed calls; narrow callback before accepting implementation.).

### rev-36 · 2026-11-16T07:58:54.230Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1703-source-2
commit: ffe84f8ed6fead1bcca412fef153dc70148393f7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source audit A-19862: Standards0/Spec0; sole optional-callback type blocker repaired with const capture/assert.ok, all live/closed-store/late-no-op/log assertions intact. A-19858 successful typing/lint completions explicitly transcribed; A-19854 independently parsed20 named passes and20 clean summaries/exits, maximum case3.364272875s retained without performance pass. Explicit bounded carry: only T2 callback narrowing changed; product/native/helper bytes unchanged, so A-19841's two predecessor native samples remain usable at original candidate linkage limits and narrow Coordinator T-1905 counting exception, never relabelled exact-head executions. Actual sample2 remains red. C1 done restored; C2 incomplete, remaining8 loaded native files and exact-head mode-free verify pending. No criteria verified/final ready. Source clear at ffe84f8ed permits authorized evidence work; any source change requires fresh review.

### impl-1703 · 2026-11-16T08:35:40.579Z

Coordinator C2 redefinition (decision6ef8f819,2026-11-16 08:34Z): the target pending-permission test passes in10/10 loaded full-file runs. Every other-test failure remains recorded raw with its item, including T-1905 cleanup refusals and their consequent hangs. Samples1/2/3/4 target passed =4/10; sample2 raw20/21 cleanup failure, sample4 raw20pass/1fail/1cancelled after305.200s producer exit1 following requestedSIGTERM. These are not clean file passes. Later full-file attempts are bounded at3min. Remaining6 queued; same-head verify a3bb4c33 at ffe84f8ed green6382/6382 T0/T1/T2/selectedT4/Web Linux x64 droplet, A-19887; native full T3 not run in that receipt.

### impl-1703 · 2026-11-16T09:20:01.726Z

Additional natural red receipt, reported by T-1905 implementer and source-linked by reviewer: A-19931 run4 at39ff848af explicitly lacks T-1703 fence. Linux arm64 Node24.21 Docker --init/network-none/4CPU, load11.08 entry/11.44 end, producer exit1/signalnull,21tests20pass1fail0cancel0skip, no timeout. Pending-permission case:516 failed Error: database is not open ERR_INVALID_STATE at ProcessTable.bySessionId -> Sessions.#turnFailed -> Object.turnFailed -> generation Proxy. This is unfixed-source reproduction, not a regression on reviewed ffe84f8ed and not current-head passing C2 evidence. Own C2 remains4/10;6 pending. Raw receipt retained by producer A-19931.

### impl-1703 · 2026-11-16T10:09:00.760Z

Final evidence A-19953: exact target passed10/10 loaded full-file attempts at Linuxarm64/Node24.21 Docker --init/network-none. Samples1/3/5–10 clean21/21; sample2 raw20/21 T-1905 failure; sample4 raw20pass/1fail/1cancelled T-1905 consequent hang305.200s. Count is target-only under Coordinator6ef8f819, not10 clean files. Entryloads8.15/10.64/8.03/10.03/8.21/9.05/9.50/9.78/9.38/9.51. Targetmax5.052s, cleanfilemax110.717s; C1 focusedmax3.364s retained. Original1–2 source linkage/carryA-19862 explicit;3–10 at unchanged reviewedffe84f8ed. Current same-head configured verificationA-19887:6382/6382 T0/T1/T2/selectedT4/Web Linuxx64; full nativeT3 not run. No source change, all criteria marked done, final Reviewer evidence settlement requested.

### rev-35 · 2026-11-16T10:16:01.544Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1703-final-1
commit: ffe84f8ed6fead1bcca412fef153dc70148393f7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified under Coordinator 6ef8f819's explicit ten target-case receipt bar and rev-36 A-19862 bounded carry of the first two earlier-candidate samples. A-19958 records final verdict; A-19957 independently reconciles raw ten target positives, twenty focused positives, exact-head A-19887 ordinary+five load receipts and all 984 manifest dispositions. Eight native files clean, sample 2 actually failed and sample 4 failed/cancelled root: both remain raw shared T-1905 history, not ten clean final-tree files. 6382 base tests/701 files plus separate five load tests/files all positive; unselected 266 T3/16 T4 deferred. Native completion/capture/tree/publication limits and report-only advisories retained; no Reviewer runtime. Coordinator retains landing/integrated-stage gates.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T14:01:36.893Z

Merged 64941afb8c3dc70ac2a573bfd6dae635ee22367f onto dev.
