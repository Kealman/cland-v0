---
id: T-911
kind: task
title: "Workbench autostart ignores the restart deferral and cland hub start kills a slow but progressing hub at 15 s (restart #22 gap 2 min 28 s)"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-865
found_by: human
topic: topic-654
branch: t/T-911-workbench-autostart-ignores-the-restart
created: 2026-10-19T21:39:16.640Z
updated: 2026-10-19T21:57:33.459Z
closed: 2026-10-19T21:57:33.459Z
---

## Summary

During hub restart #22 (2026-10-19), the Neovim workbench's autostart ran `cland hub start` 12 s after the operator stopped the hub, which means the restart deferral (markHubStop/autostartDeferred) did not hold it. That start took the lock (journal: hub-started pid 39797 at 21:33:52Z, starter `{"client":"nvim","parentPid":92893}`). The hub was listening by 21:33:58Z, still restoring sessions, then vanished without a signal or stop event before 21:34:05Z. That matches `cland hub start` killing its child at START_DEADLINE_MS (15 s, hub/src/cli/hub.ts). Startup takes about 14 s (storage 5 s plus 11 s of restoring sessions on attempt 2). The operator's direct serve had exited on "a hub already runs", so the project went without a hub for 2 min 28 s. That's past the 60 s limit beyond which the Claude Code mod bridge can be lost.

## What to build

- The workbench autostart honours the stop deferral: after an operator stop, it does not start a hub inside the deferral window.
- `cland hub start` never kills a hub that is still making startup progress: listening, restoring sessions or opening storage. It waits while the startup log advances, and reports a stall only when no progress is logged within the deadline. T-865 fixed the stalled-storage path only.

## Acceptance criteria

- [x] C1. A T2 test: with a stop deferral recorded, the workbench autostart path does not run `hub start` inside the window, and starts after it.
  - done: impl-911 · 2026-10-19T21:45:38.548Z
  - verified: rev-30 [reviewer] · run rev-20261019-911-final · 2026-10-19T21:53:21.328Z · commit a86f7a4886d6e1f295e09206dcb8e0905138ae5b
- [x] C2. A T2 test: a fake hub that logs progress every few seconds past 15 s and is then serving is not killed by `cland hub start`, while a hub that logs nothing for the deadline is still reported and stopped.
  - done: impl-911 · 2026-10-19T21:42:30.095Z
  - verified: rev-30 [reviewer] · run rev-20261019-911-final · 2026-10-19T21:53:21.328Z · commit a86f7a4886d6e1f295e09206dcb8e0905138ae5b
- [x] C3. Both causes and the 21:33:40–21:36:06Z incident are recorded in the task report.
  - done: impl-911 · 2026-10-19T21:42:30.692Z
  - verified: rev-30 [reviewer] · run rev-20261019-911-source-corrected · 2026-10-19T21:46:03.767Z · commit a86f7a4886d6e1f295e09206dcb8e0905138ae5b
  - verified: rev-30 [reviewer] · run rev-20261019-911-final · 2026-10-19T21:53:21.328Z · commit a86f7a4886d6e1f295e09206dcb8e0905138ae5b

## Comments

### impl-911 · 2026-10-19T21:40:39.010Z

Reproduced C2 with a fake child, fake clock and fake authenticated socket: node --test hub/test/startup-deadline-component.test.ts failed at simulated 16 s (killed=true despite fresh restoration progress). Diagnosis: fixed total 15 s deadline, plus stop marker expires at 10 s before the incident's +12 s retry and client lacks a pre-spawn marker guard. Coordinator decided 30 s grace so fallback startup remains below the bridge's ~60 s expiry.

### rev-30 · 2026-10-19T21:45:15.196Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-911-source
commit: 0c640848e2591f471706edb7cb9951ac67084c03
scope: full
findings: [{"severity":"medium","text":"M1: New markHubStop value import adds hub/src/hub/startup.ts to a T2 Neovim import closure, making the existing nvim-fixture-boundary T1 assertion fail. Seed recorded marker data without runtime hub imports; preserve timing/command assertions and guard.","file":"nvim/test/client-component.test.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear, A-6739. Standards M1 medium at nvim/test/client-component.test.ts:10: the new runtime hub import is forbidden by docs/agents/tests.md and is directly detected by nvimHubImports, whose T1 guard requires an empty result. Preserve the regression while seeding recorded marker data without hub runtime; CLI controls already exercise markHubStop. No additional Spec finding: Coordinator-approved 30 s grace, pre-spawn marker guard, explicit bypass and renewed inactivity deadline match the request. Incident report establishes C3 by source, but no final runtime criteria are verified yet. Correct this head and request fresh source review before mode-free verification. No Reviewer tests; QA none.

Criteria: C1 failed (New client T2 regression imports hub runtime and violates the enforced Neovim fixture boundary; correct its marker setup without weakening the guard.).

### impl-911 · 2026-10-19T21:45:44.565Z

Corrected source-review finding M1 at a86f7a4886d6e1f295e09206dcb8e0905138ae5b: Neovim regression seeds recorded marker JSON without importing hub runtime; timing and command assertions retained. Client component 3/3, fixture-boundary guard 7/7 and root typecheck pass. Fresh source review requested before verification.

### rev-30 · 2026-10-19T21:46:03.767Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-911-source-corrected
commit: a86f7a4886d6e1f295e09206dcb8e0905138ae5b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-6741. M1 resolved: Neovim T2 writes recorded marker JSON via node filesystem APIs, removing the runtime hub import while preserving all time/command assertions; CLI controls retain actual markHubStop coverage. Combined six-file review has no outstanding Standards or Spec finding. Coordinator-approved 30 s grace, pre-spawn marker guard, explicit start bypass and progress-renewed 15 s inactivity deadline match the request. C3 verified from incident/both-causes report. C1/C2 await exact-head mode-free green and new-identity load receipts with no owned tier/resource/budget mismatch. A-6739 is historical. QA none; no Reviewer tests.

Criteria: C3 verified.

### rev-30 · 2026-10-19T21:53:21.328Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-911-final
commit: a86f7a4886d6e1f295e09206dcb8e0905138ae5b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6749. Independently audited A-6748/cf0d5ffb: 1907/1907, zero fail/cancel/skip/TODO, all four new groups 5/5 with 20 positive finish receipts, zero tier/resource mismatch or budget-overrun rows. C1 workbench window ordinary .529729444 s, five-repeat max .554770437 s; CLI deferral/explicit-bypass control also ordinary+five. C2 progressing and later-stalled controls ordinary+five (max .021980804 s); existing silent diagnostic/kill control passes. Neovim import-boundary guard passes after M1 correction. Source A-6741 plus receipt settle C1/C2; C3 report remains verified. Linux component evidence, no task T3/live-project restart claim. QA none; no Reviewer tests.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T21:57:33.459Z

Merged 49dd74435a26fa9fddec48621edc4a54d18150c2 onto dev.
