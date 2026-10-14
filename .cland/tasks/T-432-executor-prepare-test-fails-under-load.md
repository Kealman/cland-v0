---
id: T-432
kind: task
title: "executor-prepare test fails under load: expected 422, got 0 at line 137"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - qa-found
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
regression_of: T-344
topic: topic-259
branch: t/T-432-executor-prepare-test-fails-under-load
created: 2026-10-14T17:38:31.303Z
updated: 2026-10-14T23:36:18.032Z
---

## Summary

`hub/test/executor-prepare.test.ts:137` ("prepare keeps its snapshot when builder deletion is unconfirmed, then the hub confirms release and cost") failed once in E-271 QA run qa-2026-10-14-27-9 at a7e07635, with expected 422 and actual 0. A full local verify held the machine at the time. Run once more alone under a similar load, the file passed 17/17. It is a load-sensitive test: a timing or ordering assumption about the confirmation of the builder's release.

## Evidence

The QA evidence for run qa-2026-10-14-27-9 holds `M3-executor-prepare.log` (the failure) and `M3-rerun-executor-prepare.log` (the pass). The command was `node --test hub/test/executor-prepare.test.ts`.

## Acceptance criteria

- [x] C1. The cause of the 0 where 422 was expected is named, and the test waits on the state it asserts rather than on time.
  - done: impl-432 · 2026-10-14T18:11:21.987Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-432-1 · 2026-10-14T18:12:47.463Z · commit 4b5846b824cd48fdd5f14a355f0465cb789dfe97
  - verified: rev-23 [reviewer] · run rev-2026-10-14-432-3 · 2026-10-14T22:48:23.236Z · commit c744a2aa7ef77d05337efae19a06c19f8e659caa
  - verified: rev-23 [reviewer] · run rev-2026-10-14-432-4 · 2026-10-14T23:36:16.931Z · commit c744a2aa7ef77d05337efae19a06c19f8e659caa
- [x] C2. The file passes 5/5 whole-file runs while a full suite runs beside it.
  - done: impl-432 · 2026-10-14T18:11:24.420Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-432-4 · 2026-10-14T23:36:16.931Z · commit c744a2aa7ef77d05337efae19a06c19f8e659caa

## Comments

### impl-432 · 2026-10-14T17:59:32.664Z

C1 diagnosis: reproduced 0 !== 422 at line 137 using node --test --test-name-pattern='prepare keeps its snapshot' hub/test/executor-prepare.test.ts. Serial whole-file instrumentation shows repeated 422/delete_failed retries followed by 0/deadline and executor-release-unconfirmed carrying that last deadline cause. No race in assigning fake deleteError; the test wrongly assumes the final bounded attempt must receive the fake's 422. Changed it to eventually wait for a 422 retry and unconfirmed release for the same builder lease, plus at least two delete attempts, retaining the provider-cause assertions and restart/release/cost checks.

### impl-432 · 2026-10-14T18:11:25.927Z

C2 complete: five serial node --test hub/test/executor-prepare.test.ts runs each passed 17/17 beside local full verification 0e68bdde (impl-385). Queue snapshots before and after every run confirm the same full holder from 18:00:43Z to 18:10:32Z. Durations: 115.7s, 114.9s, 135.6s, 113.5s, 105.5s. Durable evidence A-2485 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2485-t-432-diagnosis-and-five-serial-whole-file-passes-under-full-suite-load. One commit 4b5846b8 pushed to origin task branch after fetching/merging origin/dev (already up to date); diff check clean. QA policy scope none and no QA criteria, so review only.

### rev-23 · 2026-10-14T18:12:47.464Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-432-1
commit: 4b5846b824cd48fdd5f14a355f0465cb789dfe97
scope: full

No high or medium Standards/Spec findings. Same-builder ID/lease-scoped bounded journal readiness replaces invalid final-cause422 assumption; provider422/delete_failed/message and >=2 actual DELETE checks retained, alongside snapshot/restart/resource/lifetime/cost assertions and unchanged deadlines. A-2485 diagnosis reproduces422 retries then final0/deadline unconfirmed state; C1 verified. All five serial loaded whole-file logs read:17/17 each,85 total,zero failures/skips; ten before/after queue snapshots confirm full local0e68bdde throughout. C2 evidence is established, to be marked in final review after normal same-head no-mode local suite result. A-2488: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2488-t-432-source-review-same-builder-retry-evidence-and-loaded-passes.md.

Criteria: C1 verified.

### rev-23 · 2026-10-14T22:47:32.390Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-432-2
commit: 4b5846b824cd48fdd5f14a355f0465cb789dfe97
scope: evidence

Medium gate finding — untouched nvim/test/explorer-card.test.ts:243 fails exact card T-11/no-row readiness symptom, known T-439. Local full 71f43e3c/A-2588 exits 1, 2039/2040 pass, zero cancellations/skips/todo; all hub cases green. No T-432 causal failure inferred; source A-2488/C1 and five loaded-file passes A-2485 retained. C2/final readiness remains pending accepted gate. T-439 shared patch is landed a2f60f7a (final A-2536); lead disposition required for adoption or qualified retry, no unconditional rerun cleared. Changed head needs delta review. A-2589: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2589-t-432-gate-blocked-by-known-t-439-explorer-readiness.md.

### impl-432 · 2026-10-14T22:47:51.894Z

Local full verify 71f43e3c/A-2588 passed every hub case and failed solely on known T-439 explorer-card.test.ts:243 readiness (2039/2040). Per Coordinator instruction 84bf6b4a (19:39Z), adopted a2f60f7a alone as cherry-pick c744a2aa7ef77d05337efae19a06c19f8e659caa. No broad dev merge or other patch. executor-prepare change remains the original one commit 4b5846b8. Targeted node --test nvim/test/explorer-card.test.ts passed 15/15, A-2590; clean diff/worktree. Pushed origin head c744a2aa and requesting delta review before new local no-mode verification.

### rev-23 · 2026-10-14T22:48:23.236Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-432-3
commit: c744a2aa7ef77d05337efae19a06c19f8e659caa
scope: delta

No high/medium Standards/Spec findings. Complete one-file cherry-pick diff exactly matches reviewed f648da42 and landed T-439 a2f60f7a. Observable navigation barriers preserve original assertions/five-second bounds. A-2590 affected whole file passes 15/15, zero failures/cancellations/skips/todo. Executor-prepare fix byte-unchanged; C1/source A-2488 refreshed and five loaded whole-file/85-case evidence A-2485 remains applicable. Clean pushed tip/diff confirmed. C2/readiness awaits complete same-head no-mode local verification; 71f43e3c/A-2588 remains prior red on corrected T-439. A-2591: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2591-t-432-delta-source-review-exact-t-439-adoption.md.

Criteria: C1 verified.

### rev-23 · 2026-10-14T23:36:16.931Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-432-4
commit: c744a2aa7ef77d05337efae19a06c19f8e659caa
scope: evidence

Final clear; C1/C2 claimant done marks confirmed at unchanged clean head. Local no-mode full 7123a262/A-2598 passes root typecheck and 2040/2040 (37 free, 1616 hub machine, 387 Neovim), zero failures/cancellations/skips/todo. Release test and corrected gi case pass. C1/source A-2488 retains matching-lease unconfirmed wait, actual 422 retry/repeated DELETE proof and snapshot/accounting/restart assertions. C2 A-2485 five serial whole-file passes 85/85 with same full-holder overlap retained; executor-prepare source unchanged by shared adoption. Earlier71f43e3c/A-2588 red solely on T-439; exact landed fix reviewed A-2591 and affected case now green. No high/medium findings. A-2599: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2599-t-432-final-exact-head-gate-and-loaded-release-test-proof.md.

Criteria: C1 verified, C2 verified.
