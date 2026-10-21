---
id: T-1065
kind: task
title: The fake Claude cleanup test removes the home before the poll exits under load
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1035
topic: topic-813
branch: t/T-1065-the-fake-claude-cleanup-test-removes-the
created: 2026-10-21T15:28:00.671Z
updated: 2026-10-21T17:11:05.336Z
closed: 2026-10-21T16:35:04.213Z
---

## Summary

T-1035's new test `hub/test/fake-claude-cleanup.test.ts` "fake Claude cleanup waits for a poll that writes after hub shutdown" fails under load. In the E-415 stage 3 Linux cover 21dee14f at dev 296a5457, the base run passed, but the load gate passed only 1 of 5 repetitions. Each failure reads `directory removal starts only after the poll exits` (A-8519, lines 13892, 13909, 13959 and 13971). Under load, cleanup starts removing the fake home before the poll has exited: either the drain bound is shorter than a loaded poll, or the drain does not wait for that poll at all.

## Acceptance criteria

- [x] C1. Cleanup never starts removing a fake Claude home while a registered writer is alive, however long it takes. Any bound applies only to reporting a stuck writer, and the test proves the ordering under artificial delay.
  - done: impl-1065 · 2026-10-21T15:37:33.200Z
  - verified: rev-23 [reviewer] · run rev-20261021-1065-evidence-1 · 2026-10-21T15:51:47.160Z · commit 9f32de6cc1528fd37b2ebb422b2df62486ff0bb4
  - verified: rev-23 [reviewer] · run rev-20261021-1065-final · 2026-10-21T16:30:22.682Z · commit 9f32de6cc1528fd37b2ebb422b2df62486ff0bb4
- [x] C2. The test passes 20 sequential repetitions under the load gate (workers 2) in a scratch clone at the task head, and the Coordinator's full `cland verify all` at the reviewed head is green; the next E-415 stage cover's load-gate repetitions of this identity are landing evidence.
  - done: impl-1065 · 2026-10-21T16:29:18.947Z
  - verified: rev-23 [reviewer] · run rev-20261021-1065-final · 2026-10-21T16:30:22.682Z · commit 9f32de6cc1528fd37b2ebb422b2df62486ff0bb4

## Comments

### impl-1065 · 2026-10-21T15:29:29.078Z

Read original T-1035/topic-803 and Linux stage run21dee14f/A-8519 at296a5457. Exact failure: `directory removal starts only after the poll exits` (repetitions1,2,4,5); failed runs take~0.4s, not the5s drain deadline. Initial hypotheses: OS disappearance precedes execFile callback; missed registry identity; deadline reaps delayed polls. Cover-quiet blocks runtime feedback; preparing test-first changes without executing locally.

### impl-1065 · 2026-10-21T15:38:52.983Z

Development evidence A-8535: corrected pre-fix held-writer test red at treeba00ed40 (Missing expected rejection); fixed full lifecycle file8/8 green at tree7c669a9c, identical to pushed head9f32de6c. macOS arm64/local, Nodev24.21.0, sealed scratch clone; raw targeted Node runs (no tier/duration gates), not suite/C2 proof. Corrected-head hub typecheck exit0. Deliberately delayed callback test proves OS writer absence before cleanup returns while callback delivery is held. Deadline case proves live delayed writer/home retained with zero removal until explicit release. Initial green failure from a worker-wide usage-release marker was fixed by home-local config plus ENOENT-safe idempotent release. Fresh source review requested at9f32de6c; no verification submitted yet.

### rev-23 · 2026-10-21T15:39:04.085Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1065-source
commit: 9f32de6cc1528fd37b2ebb422b2df62486ff0bb4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear; four-file diff versus fixed296a5457 at origin9f32de6c/tree7c669a9c, no new dev merge. Deadline now diagnoses PID/start identities and retains home/ownership by throwing before rm; slow non-session writers are not killed. Session groups retain existing owned-process reaping; registry/admission fencing unchanged. Complete writerClock drives deadline and polling. Existing poll test distinguishes actual OS identity absence at rm from deliberately deferred callback, then separately awaits callback success. New real held-poll clock regression requires named deadline, live PID, retained home/zero rm, then release/exit/retry removal. Corrected home-local config removes shared usage-release contamination; ENOENT-only fallback release is safe after successful removal and preserves setup-error cleanup. README/testing docs match; no clause growth. Earlier Reviewer progress ENOENT prediction was qualified/corrected after finding old config worker-wide; current isolation+idempotence resolves both paths, no remaining findings. C1/C2 runtime marks remain pending original targeted red/green receipts,20 workers2 scratch repeats, mode-free and Coordinator d9562fcf-required full same-head lifecycle5/5. No Reviewer execution/delegation; QA none.

### impl-1065 · 2026-10-21T15:41:01.244Z

Scratch portion of C2 complete at unchanged reviewed9f32de6cc1528fd37b2ebb422b2df62486ff0bb4/tree7c669a9c378c965dbefbb6c0d48584053ecf23b4. A-8541 holds exact controller,receipt and20 original logs: macOS arm64/local,Nodev24.21.0,20 sequential fresh package-runner invocations of the full lifecycle file, workers2,160 ordinary test passes,zero failures/cancellations/skips, all20 exits0. Start-load gate enforced<15 on every run (3.24414–4.45898); shared runner locks;15:39:17–15:40:17Z. Sealed scratch HOME/XDG/Git/provider/account environment after overlay; system TMPDIR=/tmp. T3 targeted repetitions only, resource/duration budgets report-only with missing-file baseline labelled; no integrated/Linux5/5 pass claimed. Mode-free verification admitted as527cce72-8c14-45b9-bde7-b396507c217c despite CLI reply timeout(exit75); no resubmit. Coordinator's fullLinux run waits behind T-1062 per e973b52c. C2 done mark/final review await that5/5 receipt and same-head mode-free result; claim/head retained.

### impl-1065 · 2026-10-21T15:47:37.209Z

Same-head mode-free verify527cce72-8c14-45b9-bde7-b396507c217c passed at9f32de6cc1528fd37b2ebb422b2df62486ff0bb4:2,322/2,322 ordinary tests,zero failures/cancellations/skips. Linux x64 droplet c-8/lon1,Nodev24.21.0,workers2(Web4),lifetime409s/cost$0.0284; A-8549 is the durable raw log. Executed allT1, fallback allT2 across both packages, and actualWeb5 files; T3 excluded. Host typecheck gate at6f28b3a2 reused/not repeated, with separate exact-task-tree hub typecheck0 in A-8535. Lint,duration andT3 ratchet gates report-only; reported overages/missing baselines are not timing passes. Scratch20/20 remains A-8541. C2/final evidence review still await Coordinator full same-head T3 lifecycle5/5; head/claim unchanged.

### rev-23 · 2026-10-21T15:51:47.160Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1065-evidence-1
commit: 9f32de6cc1528fd37b2ebb422b2df62486ff0bb4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial evidence clear, C1 verified only; A-8551. Original A-8535 pre-fix red Missing expected rejection / current-tree full file8/8 green; deadline retains live writer/home and succeeds after release. A-8541 controller +20 raw package-runner files: exact scratch head/tree, Darwinarm64 workers2,20 sequential fresh processes/160pass, starts3.244–4.459<15, nofail/skip. A-8549 mode-free527cce72 samehead Linuxx64 c8lon1 exit0:2322 ordinary test passes, allT1/fallbackallT2hub+nvim/actualWeb5files, host6f28b3a2 reusednotremote; lint/duration/ratchet reportonly. Lifecycle fileT3 was not run; no per-identity load proof from this task receipt. C2 remains unverified pending Coordinator full Linux same-head actual5/5, per d9562fcf. Not a final/ready verdict; no T3/T4/integrated/QA claim. No Reviewer runtime.

Criteria: C1 verified.

### impl-1065 · 2026-10-21T16:29:18.997Z

C2 done under Coordinator amendment e01e07ee: scratch 20/20 at the exact reviewed head (A-8541), plus full Linux run cdaa3787/A-8561 at 9f32de6c, T1/T2/T3/Web all exit 0, 3,552 passed / 8 skipped / 0 failed of 3,560 tests. All eight cleanup lifecycle assertions and the file receipt pass, including poll ordering and held writer beyond the drain deadline. Linux x64 droplet c-8/lon1, Node v24.21.0, workers 2 (Web 4), lifetime 1,422 s / cost $0.0987. There are zero actual lifecycle 5/5 load receipts in this full run; next E-415 stage repetitions are landing evidence under the amended criterion. Host typecheck gate reused; lint/duration/ratchet report-only, no timing pass or T4 claim. Both criteria done; final evidence review requested. Source/head/claim unchanged; no merge.

### rev-23 · 2026-10-21T16:30:22.682Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1065-final
commit: 9f32de6cc1528fd37b2ebb422b2df62486ff0bb4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-8563. C1 and amended C2 verified at unchanged origin 9f32de6c / tree7c669a9c. Independently read Coordinator e01e07ee and matching tracker criterion: audited scratch20/20 workers2 (A-8541,160passes, enforced starts<15) plus green full Linux A-8561/cdaa3787 are pre-merge evidence; next E-415 stage repetitions are landing evidence. Actual full T1/T2/T3/Web exit0, parsed3552test/534filepasses,8environment skips,0fails/cancellations. All8 lifecycle assertions and file pass (14226–14254), including writer-exit ordering and retained live-writer home at deadline. No lifecycle5/5/load receipt present or claimed. Actual Linuxx64 c8lon1 Node24.21/Nvim0.12.5, T2/T3workers2/Web4,life1422s/$0.0987estimated; host6f28b3a2 reusednotremote. Lint132/59,5missingbaselines,duration/ratchet report-only: T3 wall1017.76>900, ratchet2135.925>2135.601, Web/compiler overages retained; no duration-budget pass claim. A-8551 C1/artificial-delay proof and same-head mode-free A-8549 retained. NoT4/postlanding stage/QA claim; QA none, Coordinator owns enqueue/landing evidence. Standards0/Spec0; no Reviewer runtime.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-21T16:35:04.213Z

Merged 142f4c4bcf71029e9e0ecf88f5aa0df92a55e7b8 onto dev.

### coord · 2026-10-21T17:11:05.336Z

Landing evidence: the E-415 stage 3 Linux cover 5551daab at dev dbb1604f (A-8570) is green. The load gate passed this item's new identity 5/5: fake-claude-cleanup "retains a delayed writer and its home at the drain deadline" (line 17943). The original identity "waits for a poll that writes after hub shutdown" passed in the base phase.
