---
id: T-1961
kind: task
title: createHub close retried after an adapter-close error closes the already closed ProcessTable and Store again and fails with "database is not open"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1742
branch: t/T-1961-createhub-close-retried-after-an-adapter
created: 2026-11-18T07:18:35.705Z
updated: 2026-11-24T15:01:14.225Z
closed: 2026-11-24T15:01:14.225Z
---

## Summary

Found by impl-1960 while fixing T-1960 (2026-11-18, local darwin arm64, Node 24). When one adapter's close fails during `createHub`'s close, the ProcessTable and the base Store are still closed. A retried close then closes them again. It fails with `Error: database is not open`, at `ProcessTable.close` (hub/src/adapters/processes.ts:202, via the adapter finish at hub/src/adapters/index.ts:60 and createHub close at hub/src/hub/server.ts:324), and at `Store.close` (hub/src/hub/store.ts:618, via the base close at server.ts:182 and createHub close at server.ts:325). So a hub close after a partial failure can't be retried to completion, and the second error hides the first. T-1960 kept production code unchanged and moved its test onto the direct createHub seam instead.

## What to build

Each close owner records its own successful native close and makes a retried close a no-op for parts already closed, while a failed part stays retryable. The first error stays the reported outcome (rule 39).

## Acceptance criteria

- [x] C1. After a controlled adapter-close failure, a retried createHub close finishes the remaining parts without closing the ProcessTable or Store twice, and reports the original failure (test).
  - done: impl-1961 · 2026-11-24T12:24:50.296Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1961-final · 2026-11-24T13:48:46.884Z · commit 1b4bcde226e7cb217124c742a175c67fd0cf01c3
- [x] C2. Every caller that retries hub close (harness startHub, daemon stop, CLI hub stop) is listed with its disposition (rule 20 and rule 41).
  - done: impl-1961 · 2026-11-24T11:41:39.197Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1961-source1 · 2026-11-24T11:44:08.473Z · commit 793e9be241aa14e38f05f1322bddd375fd138e44
  - verified: rev-40 [reviewer] · run rev-40-20261124-1961-source2 · 2026-11-24T11:54:40.578Z · commit 7d2f828d1e760eb0d2ae920743c051f9fffe546a
  - verified: rev-40 [reviewer] · run rev-40-20261124-1961-source3 · 2026-11-24T12:25:42.044Z · commit 1b4bcde226e7cb217124c742a175c67fd0cf01c3

## Comments

### impl-1961 · 2026-11-24T10:58:42.588Z

C2 consumer inventory: docs/evidence/T-1961-consumers.md lists startHub (retry owner), daemon stop (base/sessions independently retried), CLI hub stop/serve (routes to daemon), createHub, projectSessions rollback, Sessions, Store/ProcessTable readers, tests in all tiers and shipped docs/skills/QA/client dispositions. Signatures and stored/wire bytes unchanged. Red: second close raised Error: database is not open at Store.close; focused fake-harness T2 file then passed 12/12 locally on darwin arm64, Node 24.21.0.

### rev-40 · 2026-11-24T11:44:08.246Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-1961-source1
commit: 793e9be241aa14e38f05f1322bddd375fd138e44
scope: full
findings: [{"severity":"medium","text":"M1: both new callbacks acquire guard/root/hub before an encompassing bounded/fenced owner and install disposer only after createHub resolves. Enroll shared whole-case ownership before setup, capture late acquisitions, register disposal first, use named setup/action bounds, and retain root/seams on incomplete cleanup while preserving native-close/error/concurrency assertions.","file":"hub/test/fake-harness.test.ts","line":258}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at793e9be24. One medium M1 fake-harness.test.ts:258: both new callbacks lack pre-acquisition whole-case owner, named setup/action bounds and fenced late-acquisition/cleanup seam retention; implementer0242b22d confirmed no hidden protection. Production successful native/adapter close receipts, shared hub close flight and failed-part retries otherwise match request; preserve new exact DB/error/concurrency assertions while fixing ownership. C1 failed. C2 inventory/source search established required harness/daemon/CLI routes; recorded separately under this run. A-22893 records both axes and local-evidence limits. Inherited producer cached-rejection limitation separately reported S/Tech debt, not scope expansion. Fresh source review before configured verify; no reviewer runs/edits.

Criteria: C1 failed (New retry regressions lack pre-acquisition bounded/fenced ownership and late-hub cleanup protection.).

### rev-40 · 2026-11-24T11:54:40.059Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-1961-source2
commit: 7d2f828d1e760eb0d2ae920743c051f9fffe546a
scope: full
findings: [{"severity":"medium","text":"M1-R: parent tempProject registers proxy directory drainage before the later hub disposer hook; adopted parent has only join guard, while hub guard covers child only. Parent recursive removal can delete a live hub root before disposal on setup/body failure, bypassing child guard. Install disposer before acquisition, guard every ancestor root with positive hub/resource closure, and prove rejected parent removal/repair through actual cleanup.","file":"hub/test/fake-harness.test.ts","line":269}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear at7d2f828d, one residual medium M1-R fake-harness.test.ts:269 (both cases). Named bounds/late acquisition/native seam fencing now exist, but earlier proxy parent drainage can precede later hub disposer and bypass child guard; implementer e50292d2 confirms no parent fence. Guard parent/provider before acquisition and exercise same-owner parent failure/repair. Production/C2 inventory unchanged; C2 refresh recorded separately. C1 failed; A-22908 records both axes/exact path/evidence limits. No reviewer runs/edits; fresh source review before configured verify.

Criteria: C1 failed (Residual M1: enclosing parent teardown can recursively remove the live hub root before its disposer; child-only removal proof misses that path.).

### rev-40 · 2026-11-24T12:25:42.044Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1961-source3
commit: 1b4bcde226e7cb217124c742a175c67fd0cf01c3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at1b4bcde22; M1/M1-R resolved. Disposers register before root/proxy cleanup acquisition; every removable ancestor and child requires positive hub/resource disposal. Producer captures late hub/resources, named setup/action owners and fenced native seam releases retained. Actual nested-parent removal now proves original-error rejection plus independent parent/child/seam retention, then same-owner repair/removal; native-close counts/error ordering/concurrent-flight/timer assertions retained. Production/caller inventory unchanged, C2 refreshed source-verified; inherited producer cached-rejection aside remains separate. C1 awaits exact-head configured receipts. A-22930 records both axes/local-evidence limits; local13T2/static0 reported, fullT1/T2/T3 configured pending. No findings/reviewer runs/edits.

Criteria: C2 verified.

### rev-40 · 2026-11-24T13:48:46.884Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1961-final
commit: 1b4bcde226e7cb217124c742a175c67fd0cf01c3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged1b4bcde22. Exact-heada65cc7b7/A-22982 finished/passed; canonical1b1fedef executable match. Both named retry/native-failure cases structured basepass19876/19880 with distinct5/5load20337/20330. Full13fake-harness/32Store basespass; source-established actual DB close counts, error/concurrent ownership and rejected-parent/root/seam repair proof retained. C1 verified; C2 source inventory retained. T0/T1/fallbackT2/252selectedT3files/Webexit0, plus mappedT4 inbox-verifier-load onepositive base51696 (not full/repeatedT4). T3 2021positive identities once; prerequisite/platform skips/nonselected scope retained. Noncached Linuxx64c8sfo2 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4; budgets advisory. Inherited native producer cached-rejection aside remains separate. A-22988 records both axes/limits. No findings/reviewer runs/edits.

Criteria: C1 verified.

### coord · 2026-11-24T15:01:14.225Z

Merged e7c9859cebfdf9490ef30d2cb17f66e26753f2ff onto dev.
