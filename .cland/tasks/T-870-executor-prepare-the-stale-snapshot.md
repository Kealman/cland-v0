---
id: T-870
kind: task
title: "executor-prepare: the stale-snapshot reason is asserted before the deferred inspection finishes (load flake)"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-592
branch: t/T-870-executor-prepare-the-stale-snapshot
created: 2026-10-19T11:53:07.338Z
updated: 2026-10-19T14:39:22.749Z
closed: 2026-10-19T14:38:56.466Z
---

## Summary

`hub/test/executor-prepare.test.ts` "prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes" (line ~223) failed once under load at T-666's combined head d188f60c. It expected /stale: base|lock/ and got "unknown (inspection deferred)", so the stale-snapshot inspection had not finished before the assertion. The same head passed the file alone 5/5 (A-6001), and clean dev 702ddf50 passed it 3/3. Evidence: A-5993.

## Acceptance criteria

- [x] C1. The case waits on an observed boundary: the inspection is completed or its receipt is recorded before asserting the stale reason. Every assertion stays, and a red-to-green proof delays the inspection.
  - verified: rev-31 [reviewer] · run rev-20261019-870-source · 2026-10-19T13:40:24.126Z · commit 33a633e3cad9615b2b67a3b46176fdfeedbfe381
  - verified: rev-31 [reviewer] · run rev-20261019-870-final · 2026-10-19T13:46:42.945Z · commit 33a633e3cad9615b2b67a3b46176fdfeedbfe381
  - done: impl-870 · 2026-10-19T13:47:15.864Z
- [x] C2. executor-prepare.test.ts passes 20/20 serially on the Mac, whole file and alone, and the mode-free task verify passes at the reviewed head; the T3 Linux run comes from the merge batch that lands this item and is recorded by the Coordinator as landing evidence, not as a gate.
  - verified: rev-31 [reviewer] · run rev-20261019-870-final · 2026-10-19T13:46:42.945Z · commit 33a633e3cad9615b2b67a3b46176fdfeedbfe381
  - done: impl-870 · 2026-10-19T13:47:16.510Z

## Comments

### impl-870 · 2026-10-19T13:35:01.980Z

Implementation: both pin/lock stale-reason assertions now wait for a completed (non-deferred) executor.status inspection, then retain original assertions independently of readiness. All 66 assertion-bearing lines in the full file are retained verbatim and in order. Controlled prepareKey barrier reproduced exact stale lock assertion failure before fix and passed after fix. Evidence A-6059 (method), A-6060 (temporary probe patch), A-6061 (red log), A-6062 (green log). Temporary probe removed. Root typecheck passed; full-file 20 serial Darwin repetitions in progress.

### impl-870 · 2026-10-19T13:39:13.188Z

Committed/pushed 33a633e3cad9615b2b67a3b46176fdfeedbfe381; fetched and merged origin/dev before first source review (already up to date). 20/20 full-file serial runs on Darwin / Node v24.21.0 passed with 5/5 tests each. Full-file wall range 9.757–13.397s; changed case 4.297–6.046s. Durable complete logs/summary: A-6065, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6065-t-870-mac-20-serial-full-file-passing-receipts. Root typecheck and test:lint passed. Source review requested via reviewer role. After clear source verdict, will submit mode-free verify at exact reviewed head. Coordinator clarified C2's T3 Linux evidence belongs to the landing batch, not a task gate.

### rev-31 · 2026-10-19T13:40:24.126Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-870-source
commit: 33a633e3cad9615b2b67a3b46176fdfeedbfe381
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 findings, Spec 0 findings. A-6066 records fixed-base source/evidence audit. Bounded status polling waits only for the explicit deferred marker to clear, then preserves independent pin equality and lock stale-reason assertions. All 66 assertion-bearing lines remain byte-identical/in order; one file +8/-2, no production, titles, processes or clocks added. A-6060–A-6062 retain the held-key red original assertion and green same-probe fix. Independently parsed A-6065's 20 complete Mac logs: 100/100 test passes, zero failures/cancellations/skips; file Node wall 9.7567–13.3966s, changed-case max6.046255791s below retained6.238614s allowance. C1 verified. C2 remains pending post-source same-head mode-free task verify, as amended by independently read Coordinator516dcf30; native T3 Linux is Coordinator-owned landing-batch evidence, not claimed by task gate.

Criteria: C1 verified.

### impl-870 · 2026-10-19T13:46:08.982Z

Same-head mode-free configured verify 3b031506-7e9b-47ce-82c1-e80561482ce7 passed at 33a633e3cad9615b2b67a3b46176fdfeedbfe381: 418 tests, 418 passes, no fail/cancel/skip/todo. Receipt/log A-6068. Linux x64 droplet c-8 lon1, lifetime 288s, cost $0.0200. T3 deferred to Coordinator-owned landing batch as agreed. No head changes after source review. Awaiting source Reviewer’s C2/final evidence settlement.

### rev-31 · 2026-10-19T13:46:42.945Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-870-final
commit: 33a633e3cad9615b2b67a3b46176fdfeedbfe381
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6069 records same-head evidence audit. A-6068 / 3b031506 is exit0 at the exact source-cleared head: 418 ordinary pass outcomes, zero fail/cancel/skip, all190 admitted load gates5/5, zero runtime tier trips. A-6065 independently parsed20 full-file Mac logs with5/5 tests each:100 passes, no failures/cancellations/skips/TODO; changed-case max6.046255791s below retained6.238614s allowance. C1 established by A-6066 source/assertion audit plus held-key red/green control; C2 established by Mac20/20 and exact-head mode-free gate under Coordinator516dcf30/current criterion. Native T3 file did not execute in task gate; Linux landing-batch evidence remains Coordinator-owned. One unrelated roles-editor T-872 report-only0.599046397s>T1.5s budget identity disclosed and reported Bugs/S to lead for filing/deduplication; no task-owned budget failure or further task run. Droplet lifetime288s/cost$0.0200.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T14:38:56.466Z

Merged 0f6b6ee9ad5617f8af6a7f5e19b6182389961204 onto dev.

### coord · 2026-10-19T14:39:22.749Z

Landing evidence (C2, Coordinator-owned, not a gate): merge batch with T-870, T-871 and T-856, run 3c90c8ec, Linux x64 c-8 lon1 (A-6088). Native executor-prepare.test.ts passed whole-file (6 pass, 0 fail), including the stale-snapshot case. Landed at 0f6b6ee9.
