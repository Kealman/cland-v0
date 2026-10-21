---
id: T-1065
kind: task
title: The fake Claude cleanup test removes the home before the poll exits under load
state: open
status: review
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
updated: 2026-10-21T15:41:01.244Z
---

## Summary

T-1035's new test `hub/test/fake-claude-cleanup.test.ts` "fake Claude cleanup waits for a poll that writes after hub shutdown" fails under load. In the E-415 stage 3 Linux cover 21dee14f at dev 296a5457, the base run passed, but the load gate passed only 1 of 5 repetitions. Each failure reads `directory removal starts only after the poll exits` (A-8519, lines 13892, 13909, 13959 and 13971). Under load, cleanup starts removing the fake home before the poll has exited: either the drain bound is shorter than a loaded poll, or the drain does not wait for that poll at all.

## Acceptance criteria

- [x] C1. Cleanup never starts removing a fake Claude home while a registered writer is alive, however long it takes. Any bound applies only to reporting a stuck writer, and the test proves the ordering under artificial delay.
  - done: impl-1065 · 2026-10-21T15:37:33.200Z
- [ ] C2. The test passes 20 sequential repetitions under the load gate (workers 2) in a scratch clone at the task head, and the Coordinator's full `cland verify all` at the reviewed head shows its load-gate repetitions at 5/5 (evidence in the item topic).

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
