---
id: T-1999
kind: task
title: item-summary-scale's 'reply during the first freshness batch' assertion races the first read and fails on fast droplets
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1952
topic: topic-1651
branch: t/T-1999-item-summary-scale-s-reply-during-the
created: 2026-11-19T06:38:03.931Z
updated: 2026-11-19T07:59:54.656Z
closed: 2026-11-19T07:59:54.656Z
---

## Summary

T-1952's new case in `hub/test/item-summary-scale.test.ts`, "a thousand-item planned hub serves within two seconds of listening before maintenance", asserts `answered.duringFirstRead === true`: that the status reply arrives while the first freshness read is still running. That holds only if the request happens to land before the first read finishes. On T-1957's droplet verify b8f29d1a (A-21615, head 9c7cabf2b, which includes dev db53a0cb9) it failed with "the status reply arrives while the first freshness batch is still running", false !== true, at item-summary-scale.test.ts:140, while T-1952's own verify passed. The hub flagged it as a shared-defect candidate. Batches run T1 and T3 only, so this T2 race is now on dev and can fail any item verify that selects the file.

## What to build

Make the overlap deterministic. Hold the first freshness read open at a gate (the fixture's `scheduleTips` read) until the status reply has been received, then release it, so the "reply during the first batch" property is enforced rather than raced. Keep every other assertion and bound unchanged: listening to serving under 2 s, each ancestor refreshed once, and the reply under 2 s.

## Acceptance criteria

- [x] C1. The case holds the first freshness read until the status reply arrives and asserts the overlap deterministically. A control that releases the read before the request fails the overlap assertion, and the fixed case passes 10/10 alone locally (test).
  - done: impl-1999 · 2026-11-19T06:51:42.798Z
  - verified: rev-35 [reviewer] · run rev-35-1999-evidence-1 · 2026-11-19T07:12:41.191Z · commit 8730aa5bee8508df3347914094f62a2c8dd6f726
- [x] C2. All other assertions in the case are unchanged (diff review).
  - done: impl-1999 · 2026-11-19T06:43:58.103Z
  - verified: rev-35 [reviewer] · run rev-35-1999-source-2 · 2026-11-19T06:53:36.116Z · commit 8730aa5bee8508df3347914094f62a2c8dd6f726
  - verified: rev-35 [reviewer] · run rev-35-1999-evidence-1 · 2026-11-19T07:12:41.191Z · commit 8730aa5bee8508df3347914094f62a2c8dd6f726

## Comments

### coord · 2026-11-19T06:39:27.194Z

Disposition, 2026-11-19 06:39Z: the unchanged case passed 5/5 alone on darwin at 808a00be1 (impl-1999). Under the flaky-rerun rule, T-1957 gets one same-head resubmission at 9c7cabf2b; its failed run b8f29d1a stays on record.

### impl-1999 · 2026-11-19T06:42:16.005Z

Base named T2 case passed 5/5; gated fixed case passed 10/10; early-release control failed overlap assertion false !== true. Evidence A-21621 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21621-t-1999-red-control-and-ten-fixed-passes.md. All original assertions and bounds preserved. Full lint/typecheck pending.

### impl-1999 · 2026-11-19T06:44:08.305Z

Pushed bbdf607547161e0da112ef9a2e9d8d7a13b11737 for review. Full npm run test:lint exit 0 (0 refusals), whole-project npm run typecheck exit 0, whole T2 item-summary-scale.test.ts 4/4 passed on darwin/arm64 local Node v24.21.0; no browser. Criteria done. Source review requested; verification pending clear verdict and Coordinator window.

### rev-35 · 2026-11-19T06:48:05.861Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1999-source-1
commit: bbdf607547161e0da112ef9a2e9d8d7a13b11737
scope: full
findings: [{"severity":"medium","text":"Standards: client secret/connect rejection occurs before the new response try/finally, so releaseFirstRead remains pending while main awaits firstRead before response. The later freshness timeout replaces the already available client failure; cleanup eventually releases the gate but does not preserve selected cause. Cover full client/request response path with release, retain owner fallback, and control client rejection without weakening original assertions.","file":"hub/test/item-summary-scale.test.ts","line":116}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source NOT CLEAR at cleanbbdf607547161e0da112ef9a2e9d8d7a13b11737/tree72a71801, fixed base808a00be1 after pre-first-review dev merge. A-21626 records one medium Standards finding; lead1d8b01b0 confirms no earlier release/error owner or exemption. Nominal scheduleTips gate/captured reply overlap and existing stageCase/cleanup release are appropriate, but client await sits outside finally. All original assertions/bounds unchanged(C2source assessment), no production/public/tier/T1/helper edit. A-21621 base5/5, deliberate early-release false!==true red and nominal10/10 timing/ancestor receipts, plus request's fullfile4/4/lint/typecheck0 remain selected localDarwin/Node24.21 evidence, not configured/raw native/tree receipts. C1failed,C2doneunverified,nothing verified. Hold released for bounded full-response release/original-error control; preserve assertions and historical scopes, fresh immutable source review before configured window. Reviewer no runtime/probe/source edit.

Criteria: C1 failed (New first-read gate is not released by response finally when client acquisition rejects; main reports freshness deadline instead of original client failure.).

### impl-1999 · 2026-11-19T06:51:57.745Z

M1 fixed at pushed clean 8730aa5bee8508df3347914094f62a2c8dd6f726: await client inside response finally scope. A-21627 records before/after selected-error/drain controls. Corrected source full lint exit0/refusals0, whole-project typecheck exit0, changed T2 file4/4 exit0 (darwin/arm64 local Nodev24.21.0). Fresh source review requested; earlier evidence retains original scope.

### rev-35 · 2026-11-19T06:53:36.116Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1999-source-2
commit: 8730aa5bee8508df3347914094f62a2c8dd6f726
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source CLEAR at clean8730aa5bee8508df3347914094f62a2c8dd6f726/treec39f65c0, parentbbdf/no dev merge. Standards and Spec source clear;findings[]. A-21628 closes M1: client acquisition now inside response finally releases gate on client/request failure, preserves original response error, and captures normal overlap before release. Existing owner cleanup fallback/resources/guard and every original assertion/bound remain unchanged. C2verified from full base diff. A-21627 before/after controlled client failure retains expectedexit1, exact selected original Error after fix plus owner-close/read-drain and ancestor receipts; not a nominal pass. Corrected fullT2file4/4/lint/typecheck0 localDarwin/Node24.21 are scoped implementer evidence, not configured/raw native proof. A-21621 earlier10nominal/base5/overlap-red retain prior source scope, no renamed873 repetitions. C1unverified pending same-head configured facts. Hold released; request Coordinator mode-free verify window at873, with no extra standalone/provenance run requested. Reviewer no runtime/probe/source edit.

Criteria: C2 verified.

### coord · 2026-11-19T06:59:26.590Z

Posted as a shared fix to T-1957 (2026-11-19 06:59Z). T-1957 failed this case on both droplet runs, b8f29d1a and b01cb21b, at 9c7cabf2b, so on droplets it fails consistently even though it passes 5/5 locally. impl-1957 is cherry-picking bbdf60754 and 8730aa5be.

### coord · 2026-11-19T07:04:51.365Z

Third affected item: T-1932's verify c3236889 at d475f87af failed on the same case on a droplet. The fix is posted to impl-1932 as a shared fix as well (cherry-pick bbdf60754 and 8730aa5be).

### rev-35 · 2026-11-19T07:12:41.191Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1999-evidence-1
commit: 8730aa5bee8508df3347914094f62a2c8dd6f726
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head CLEAR at clean8730aa5bee8508df3347914094f62a2c8dd6f726/Git treec39f65c0; source2 A-21628 remains current. A-21645 audits runa2b66dca/A-21636 beyond exit0: target positive ordinary receipt2.935968904s; exact ancestors E-2:1/R-1:1; listening→serving66.508ms and serving→reply26.431ms each<2000; unchanged overlap/planned-write/final-state assertions pass. Held wrapper/read gate is deterministic; no CPU-work overlap claim. Complete ordinary index1931passed/233file envelopes,0nonpass/unfinished; separate210load tests+210file envelopes cover42site cases, not target repetitions. T0/allT1/selectedT2only item-summary-scale4cases/Websmoke1file complete; otherT2/Web,Neovim,T4 unexecuted;T3batchdeferred. Uncached Linuxx64/Node24.21,c8ams3,303s/$0.0210, actual HeadlessShell1248/ChromeTesting156; verification snapshotd029da13 differs from Git tree. Advisories report-only. A-21621 earlier-source local overlap-red/10nominal passes plus A-21627 expected-red client-cause/drain proof remain separate epochs, not current-head10/10 or green controls; source1NC retained. Source2 only moves clientawait into gate-release finally. C1verified from retained local controls+current configured facts; C2verified from unchanged assertion/bound diff. findings[]. Hold released, no further runtime/source work requested. Reviewer static inspection only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T07:20:24.265Z

Fourth affected item: T-1575's verify 0c7a3e63 at 6efcce8a7 failed on the same case on a droplet. The shared fix is posted to impl-1575 as well. T-1676 also cherry-picked it, at e6f7d7abb.

### coord · 2026-11-19T07:59:54.656Z

Merged 90650a6b6bb10d79d48e780607a68056b3238621 onto dev.
