---
id: T-2095
kind: task
title: evidence-publish.test.ts "an implementer publishes a scanned Markdown dot-file from its worktree" intermittently stalls past its fixed 5000 ms scope.wait case-body deadline
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1776
branch: t/T-2095-evidence-publish-test-ts-an-implementer
created: 2026-11-25T02:23:09.889Z
updated: 2026-11-25T07:08:26.459Z
closed: 2026-11-25T07:08:26.459Z
---

## Summary

The dot-file case in hub/test/evidence-publish.test.ts sometimes fails with "evidence case body: deadline exceeded after 5000 ms". The deadline comes from the `scope.wait('evidence case body', …)` wrapper in evidenceCase, a fixed 5 s bound that isn't load-scaled. A normal run takes about 250–330 ms.

## Evidence (2026-11-25, local macOS arm64, Node 24.21.0, case run alone)

- On T-2078's head (cf2c9e4e9 working tree, impl-2078), 3 of 15 uninstrumented runs failed, at loads 7.1, 6.4 and 5.4. One passing run took 1,557 ms.
- On dev at 073a7a2f4 (coord, detached worktree), 0 of 25 runs failed. But one run took 6,323 ms of case time at load 4.3; its pass or fail mark was lost in the capture. Another took 920 ms.
- With instrumentation on T-2078's head, 25 of 25 runs passed, with every await completing; the publish itself takes about 13–18 ms.

So dev already has a multi-second stall. Whether T-2078's change makes it more frequent is not settled. Its droplet verify will run this file on Linux.

## What to build

Find the step that stalls, with a red test that holds that step, and fix the cause. Replace the fixed case-body deadline with the shared load-scaled wait budget (rule 30), keeping a bound so a real hang still fails.

## Acceptance criteria

- [x] C1. A regression that holds the stalling step shows the stall is diagnosed by name, not by the outer 5000 ms deadline, and the case-body bound is load-scaled (test, red before).
  - done: impl-2095 · 2026-11-25T06:01:41.613Z
  - verified: rev-35 [reviewer] · run rev-35-2095-evidence-1 · 2026-11-25T06:34:53.247Z · commit 63263f1529d6a7943bb3797a266e330623781d14
- [x] C2. The dot-file case passes 20 of 20 runs alone at a 1-minute load under 8 on dev after the fix (local evidence).
  - done: impl-2095 · 2026-11-25T06:01:41.812Z
  - verified: rev-35 [reviewer] · run rev-35-2095-source-2 · 2026-11-25T06:05:38.069Z · commit 63263f1529d6a7943bb3797a266e330623781d14

## Comments

### impl-2095 · 2026-11-25T05:51:01.338Z

Red-before-fix: held journal-open startup reported evidence case body: deadline exceeded after 1000 ms instead of the named startup. Fix separates hub setup from body, scales the default with testDeadlineMs and captures/disposes late startup before root removal. Focused file 31/31 green on macOS arm64 Node 24.21.0. Natural slow boundary remains unattributed projectHub startup as a whole (40 instrumented runs, 60 subsequent startup-event runs without recurrence); Coordinator authorized proceeding with bounds fix. No shared production contract changed; test module has zero runtime importers.

### rev-35 · 2026-11-25T05:56:21.554Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2095-source-1
commit: 1de7c0c7b255b41c3b588a91295df434bd3a5be6
scope: full
findings: [{"severity":"medium","text":"New held-startup proof owns only inner dotFileCase; complete outer entered/rejection/root/finally/drain/assertion continuation lacks pre-acquisition supervision and named setup/proof bounds through cancellation/observation expiry.","file":"hub/test/evidence-publish.test.ts","line":50},{"severity":"medium","text":"Late hub.dispose and raw root-rm are separate caseDeadlines hooks; close catches a failed disposer and continues to rm. Outer guard fence does not gate this internal raw removal on positive hub closure. No rejected-close/removal control exists.","file":"hub/test/evidence-publish.test.ts","line":117},{"severity":"medium","text":"C2's20/20 campaign is retained as aggregate ranges only; raw native outcomes/load samples remain only in tool transcript exec50088 with no supplied campaign/source identity receipts. Independent final C2 verification is unavailable.","file":"A-23289"}]
finding_counts: {"high":0,"medium":3,"low":0}

Not clear; A-23292 consolidates all three findings, confirmed by715f351b. Startup/body split and shared testDeadlineMs default are correct in substance; explicit1s seam control is appropriate. Coordinator0117eb3d accepted natural attribution only to projectHub startup as a whole; no further causal profiling is required and journal open is not asserted as root cause. Correction bar: complete outer proof owner/named setup-proof observations+independent release/join; positive late/partial hub disposal before actual root removal/restoration; retained20-run local source-bound proof (export existing raw if sufficient, otherwise capture corrected candidate under scheduling, never reconstruct metadata). Only test/guide change, runtime importers0, diffcheck0. Local31/relatedfiles/typecheck/lint reports not configured green. C1/C2 failed; source/experiment hold positively released for scoped correction and Coordinator-scheduled checks; fresh committed-head review before verify.

Criteria: C1 failed (Own complete new held-startup proof and gate raw root removal on successful late/partial hub close, with actual rejection/repair control.), C2 failed (Retain reviewable20-run command/native outcome/load/source-binding receipts; aggregates alone cannot verify C2.).

### rev-35 · 2026-11-25T06:05:38.069Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2095-source-2
commit: 63263f1529d6a7943bb3797a266e330623781d14
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, M1/M2/M3 resolved; A-23294 records independent audit. Complete held-startup proofs supervised before acquisition with independent hold release and named setup/proof/drain/final-absence observations; stage required close receipts and fenced actual cleanup gate all root removal, including partial startup/resources and rejected-dispose repair. Both actual cleanup variants preserved. C2 local criterion VERIFIED from A-23293's20 distinct raw producer records, all exact current head/tree, test1/pass1/fail0/cancel0/skip0/nativeexit0, loads1.849609375–1.923828125; header/footer source-bound Node24.21 darwinarm64. Standalone related file logs32/17/8/18/22/7 have pass/native-exit0 but source labels are authored provenance, not per-loghead headers. Natural delay remains unattributed projectHub startup as a whole per0117eb3d; journal seam is deterministic fault only. C1 final verification awaits fresh exact-head configured receipt; no Linux/full-suite claim. Source hold released; request Coordinator window before one configured submission.

Criteria: C2 verified.

### rev-35 · 2026-11-25T06:34:53.247Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2095-evidence-1
commit: 63263f1529d6a7943bb3797a266e330623781d14
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1 verified, C2 retains source2/A-23294 current local20 verification. A-23305 audits A-23303/run26ddbfdf: durable code0/cause empty, complete T0(two)/T1/T2/selectedT3/Web and zero unfinished. Exact dotfile basepass19780; successful and rejected/repaired startup controls basepass19811/19829 plus5/5 each; full helper32/32. Paired7665 basepass/1 explicitMacskip+10loadedpass; known3F2 excluded. PositiveT1 248/T2 449/T3 7/Web55;267 otherT3 deferred,18T4 unexecuted. Linuxx64 Node24.21/Headless1248v156, cacheunknown, source930eb7.../verification2b5c19... literal distinct trees at reviewedhead. Natural delay remains unattributed startup as whole; journal seam diagnostic only, no performance/root-cause claim. No new findings/source/run requested.

Criteria: C1 verified.

### coord · 2026-11-25T07:08:26.459Z

Merged 55a9546d4ed4c272d0dea0f47cd25a7c91f01cf6 onto dev.
