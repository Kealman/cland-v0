---
id: T-1799
kind: task
title: Stage-1 login test files leave their scratch roots after exit
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
regression_of: T-1774
topic: topic-1457
branch: t/T-1799-stage-1-login-test-files-leave-their
created: 2026-11-09T22:31:41.994Z
updated: 2026-11-10T00:27:28.484Z
closed: 2026-11-10T00:27:28.484Z
---

## Summary

Two of E-1535 stage 1's test files leave their scratch roots on disk after they exit, which stage QA row E1534S1-79 rejects (A-18182). `hub/test/fake-harness-login.test.ts` leaves 21 `fake-login-*` roots: it creates them at line 17 and registers only `stopLoginHolder` at line 23, with no root removal. `hub/test/host-login-disk.test.ts` leaves 12 roots (`ld`, `ldc`, `ldi`, `lds`, `ldt`, `ldv`; allocated at lines 18–26, 190, 244, 264, 283 and 306) plus one root from the standalone held-close case.

## What to build

Every fixture root allocation in those two files registers its disposal as soon as it is allocated, ordered after the process teardown that already exists. Disposal uses literal or owned paths, never globs. Processes stay joined before their roots are removed, so a removal never races a live writer.

## Acceptance criteria

- [x] C1. Running `fake-harness-login.test.ts` alone leaves no `fake-login-*` root in its TMPDIR, checked against a before/after inventory in the test or its fixture (test).
  - done: impl-1799 · 2026-11-09T22:45:59.609Z
  - verified: rev-35 [reviewer] · run rev-35-1799-final-1 · 2026-11-09T23:07:46.837Z · commit 6218d3a76dc92e004c8c51df34ead888d87f2bf1
- [x] C2. Running `host-login-disk.test.ts` alone, including the held-close case alone, leaves no root it allocated (test).
  - done: impl-1799 · 2026-11-09T22:46:00.034Z
  - verified: rev-35 [reviewer] · run rev-35-1799-final-1 · 2026-11-09T23:07:46.837Z · commit 6218d3a76dc92e004c8c51df34ead888d87f2bf1
- [x] C3. A root is removed only after the processes, holders and agents that used it have been joined; a planted failure in teardown still removes the root and reports the failure (test).
  - done: impl-1799 · 2026-11-09T22:46:00.304Z
  - verified: rev-35 [reviewer] · run rev-35-1799-final-1 · 2026-11-09T23:07:46.837Z · commit 6218d3a76dc92e004c8c51df34ead888d87f2bf1
- [x] C4. The existing cases of both files pass unchanged (test).
  - done: impl-1799 · 2026-11-09T22:46:00.708Z
  - verified: rev-35 [reviewer] · run rev-35-1799-final-1 · 2026-11-09T23:07:46.837Z · commit 6218d3a76dc92e004c8c51df34ead888d87f2bf1

## Notes

- Hot files: `hub/test/fake-harness-login.test.ts`, `hub/test/host-login-disk.test.ts`, plus their shared fixture helpers if the disposal belongs there.
- Both files are T3; run them under the preservation lock.
- Found by stage-1 QA, run qa-e1535s1-2026-11-09-qa678-1, at 700f88ce.

## Comments

### impl-1799 · 2026-11-09T22:34:01.695Z

Baseline native runs on macOS arm64 Node 24.21.0: fake 21/21, disk 12/12, held-close 1/1 exit 0, but before/after TMPDIR inventory fails with 21, 12 and 1 remaining roots respectively. Fix registers root disposal immediately and preserves LIFO joins; existing planted failure now asserts the root survives server close and is absent after rejected disposal. Source review precedes native fixed-head reruns per brief.

### rev-35 · 2026-11-09T22:37:45.994Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1799-source-1
commit: fe2fb1fcac6f53fa01079f78f865d2b5848ee879
scope: full
findings: [{"severity":"high","text":"Root removal is unconditional after attempted stack disposals in both fixtures. A real native/holder/server join can reject while ownership is incomplete, yet rm destroys its root and cleanup metadata. Retain roots until positive closure; distinguish a completed join followed by a diagnostic error from an unresolved native join. The planted throw only covers the former.","file":"hub/test/host-login-disk.test.ts","line":27},{"severity":"medium","text":"Generic run children have no prearmed stack cleanup owner. Their public promise rejects on error before native close, and cancellation can reach root disposal while a command remains admitted. Capture native ownership immediately and order stop/close joins before holder/root disposal, independently of public request rejection.","file":"hub/test/fake-harness-login.test.ts","line":31},{"severity":"medium","text":"Plain rm(root) deletes .fixture-sockets/alias without removing its owned outside /tmp/ct-* alias allocated through hostDirectory. No earlier alias owner exists. Use the shared owned-directory/socket cleanup while reciprocal ownership evidence is intact, after positive native closure.","file":"hub/test/host-login-disk.test.ts","line":27},{"severity":"low","text":"The current guide still says disposable roots are retained, contradicting the new normal cleanup behavior. Obtain the lead's test-guide scope disposition and document safe removal versus retained incomplete cleanup in the same correction.","file":"docs/agents/tests/hub-test-host-login-disk.test.ts.md","line":6}]
finding_counts: {"high":1,"medium":2,"low":1}

A-18186: full source pass has4Standards findings (1high/2medium/1low),no duplicate Spec count. All ownership gaps confirmed by author. Require positive-closure removal guard, generic child/request ownership, shared socket-alias cleanup and lead-dispositioned guide correction. C3failed; runtimeC1–C4unverified. Baseline21/12/1root inventory red is narrative pending original export; fixed native/held-close runs only after fresh source clearance per brief, then mode-free verify. No reviewer runtime work.

Criteria: C3 failed (Root removal follows attempted joins without a positive closure fence; generic native runs and socket aliases also lack ordered release ownership.).

### rev-35 · 2026-11-09T22:42:09.275Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1799-source-2
commit: 236a50c9e3c468c1cb06945ea9d03fd8bc6c23b8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18187: source1 ownership/alias/guide findings fixed. Private helper fences removal until resource joins succeed, separates diagnostics/public rejection, captures native children and uses unchanged ownDirectory/socket guards. Existing generated cases retained; approved guides updated. Standards0/Spec0. Proceed prescribed exact-head two native files+held-close-alone with inventories, then mode-free verify. C1–C4 runtime-unverified/done marks pending receipts; after-stageQA separate. BaselineA-18185 raw/native-vs-inventory and reconstructed linkage limits retained; no reviewer runtime work.

### rev-35 · 2026-11-09T22:44:24.782Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1799-evidence-1
commit: 236a50c9e3c468c1cb06945ea9d03fd8bc6c23b8
scope: evidence
findings: [{"severity":"medium","text":"At source2 head236a50c9e, the existing held-spawn failure control fails its positive native-exit assertion after root disposal. observeProcesses requires the removed fake boot-id file and returns unknown/ended:false without it. Root inventories0→0 do not make the12-case file green; preserve a positive receipt before removing its observation dependency and retain the final assertion.","file":"hub/test/host-login-disk.test.ts","line":147}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18189: A-18188 native partial,all3inventories0→0;fake21/held1green,disk11/12exit1. Actual missing-observation dependency confirmed in source; not live-child or flake proof. C4failed/allruntimeunverified. Corrected source3head6218d3a76 has a pending fresh request; it is reviewed separately before reruns. No configured suite yet.

Criteria: C4 failed (Existing held-spawn case fails native-exit observation after its boot-id root was removed; disk file11/12exit1 despite empty inventory.).

### rev-35 · 2026-11-09T22:44:52.870Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1799-source-3
commit: 6218d3a76dc92e004c8c51df34ead888d87f2bf1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18190: positive native exit receipt captured after join while boot-id dependency exists; final post-disposal assertion retained. One test-file delta,no production/helper/merge change;Standards0/Spec0. Prior source2 native partial remains A-18188/A-18189notclear. Proceed exact-head full2nativefiles+held-close-alone with inventories then mode-free verify. RuntimeC1–C4/done marks await receipts;after-stageQA separate.

### rev-35 · 2026-11-09T23:07:46.837Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1799-final-1
commit: 6218d3a76dc92e004c8c51df34ead888d87f2bf1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18193: final same-head evidence clear; C1–C4 verified. A-18192 configured44808934 passed5802/5802, no fail/cancel/skip/todo; independently checked all33 fixture case records and both file finishes, exact clean HEAD/export-tree provenance. A-18191 original native21/12/1 logs each exit0/signalnull and inventories0→0; generated names equal baseline. Source3 positive-exit receipt and ordered incomplete-root fence retained. Standards0/Spec0. Prior baseline and source2 failure remain qualified history. Linux T0/T1/allT2/changedT3/Web complete, local Mac native separate; report-only budgets/lint, remainingT3 batch/T4/after-stageQA separate. No reviewer runtime work.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-10T00:27:28.484Z

Merged e7794e9cc944879a3c98fad1b04a6a404425a62d onto dev.
