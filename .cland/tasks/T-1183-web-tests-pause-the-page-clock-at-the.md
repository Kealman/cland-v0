---
id: T-1183
kind: task
title: Web tests pause the page clock at the time it was installed, which fails under load
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by: []
regression_of: T-1173
found_by: review
topic: topic-918
branch: t/T-1183-web-tests-pause-the-page-clock-at-the
created: 2026-10-23T20:30:13.366Z
updated: 2026-10-23T20:48:54.664Z
---

## Summary

Thirteen Web test sites call `page.clock.install({ time: T })` and then `page.clock.pauseAt(T)` for the same T. `install` starts the fake clock running from T, so under load T can already be in the past when `pauseAt` runs, which throws `Cannot fast-forward to the past`. impl-1175's targeted run hit it on 2026-10-23 at 20:29Z in web/test/phone-disconnected.test.ts:121; the same file passed alone on dev 3/3. The pattern also appears in accounts, asks, composer, events, notifications and inbox tests.

## What to build

Add one shared helper to web/test/harness.ts, for example `pausePageClock(page, time)`. It installs the page clock a little before `time` and pauses at `time`, so the pause target is always ahead of the running clock. Move every install-then-pauseAt site to the helper. Use the test-lint, or a grep check in an existing guard test, to keep the raw same-time pattern from coming back.

## Acceptance criteria

- [x] C1. No Web test calls `page.clock.install` and then `page.clock.pauseAt` with the same time; all of them use the shared helper, and a guard test fails on a new raw pair (test).
  - done: impl-1183 · 2026-10-23T20:34:56.722Z
  - verified: rev-26 [reviewer] · run rev-20261023-1183-final-1 · 2026-10-23T20:48:54.564Z · commit 35441486e7c2e3d82d79071ee0f5dd2814ac7ff6
- [x] C2. web/test/phone-disconnected.test.ts passes 10 of 10 runs at two workers on macOS with two parallel CPU loaders (Web test).
  - done: impl-1183 · 2026-10-23T20:34:56.796Z
  - verified: rev-26 [reviewer] · run rev-20261023-1183-final-1 · 2026-10-23T20:48:54.564Z · commit 35441486e7c2e3d82d79071ee0f5dd2814ac7ff6

## Comments

### impl-1183 · 2026-10-23T20:34:56.661Z

Implemented shared pausePageClock(page, Date), migrated all 18 raw same-time pairs across 8 Web files, and added parsed T0 source guard with negative planted controls and allowed ahead-time controls. Docs added under a separate ### Paused page clocks heading. Red: original pair fails after 1 ms virtual advancement with Cannot fast-forward to the past (A-10220); source guard rejects old pair. macOS local C2: 10/10 whole phone file repetitions, two concurrent file workers, two yes CPU loaders, 30/30 assertions; literal PID cleanup observed. Evidence A-10222 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10222-t-1183-red-controls-and-10-10-macos-clock-load-proof.md. After merging current origin/dev to 35441486e7c2e3d82d79071ee0f5dd2814ac7ff6: npm run build and all 8 touched Web files targeted passed, 72/72 tests; hub typecheck and Web source guard passed. These are local targeted checks, not a mode-free verify receipt.

### rev-26 · 2026-10-23T20:36:07.334Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1183-source-1
commit: 35441486e7c2e3d82d79071ee0f5dd2814ac7ff6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 35441486/tree8c3a44c9. Standards and Spec: no findings. Shared helper captures one target Date, installs60s earlier then pauses exactly there; all18 same-time pairs across8 files migrated with observers/final assertions/targets preserved. Remaining ahead-time pairs unchanged. Existing T0 workspace guard is wired to root check; parsed receiver-specific checks include rejected raw-pair controls plus allowed ahead/helper controls. Docs match. A-10222 contains10 complete macOS phone-file outputs/30 assertions and explicit precommit source-equivalent provenance, two-worker/two-loader description and literal PID cleanup; supporting C2 evidence, not exact-head configured proof. Preserve original runner command/output, completion exits, sealed environment/admission and cleanup receipts without transcription reruns. C1/C2 await same-head mode-free result and final evidence settlement; no criteria verified yet. No Reviewer runtime; affected after-stage QA separate. A-10225: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10225-t-1183-source-review-at-35441486.md.

### rev-26 · 2026-10-23T20:48:54.564Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1183-final-1
commit: 35441486e7c2e3d82d79071ee0f5dd2814ac7ff6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged35441486/tree8c3a44c9; C1/C2 verified, no findings. Source A-10225 carries forward. Independently parsed A-10230/runbe51261e: exit0,2772 ordinary passes/413 file passes, no fail/cancel/skip; allT1/fallbackT2hub+Neovim/actualWeb completed on Linuxx64 c-8lon1 Node24.21/Nvim0.12.5, workers2/Web4. All8 touched Web files pass; phone3 pass2.560/1.682/1.415s. Host check executes new parsed guard/controls(line73), typecheck/build/staticguards,0lintrefusals; hostgate1f9b044c is tree object, not repeated remotely. C2 A-10227 original command/stdout confirms two concurrent macOS file workers,10/10 child exit0,parent0,30/30 assertions in A-10222, two yes loaders and literal PID cleanup. Source-equivalent precommit provenance retained, not relabelled exact-head macOS or Linux stress proof. Generic budgets/lint/ratchet report-only; measuredWeb141.26s/shard141.16s exceeds40s report target. NoT3/T4/load-repetition/enforcing phase-budget/after-stageQA claim. NoReviewer runtime. A-10231: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10231-t-1183-final-evidence-at-35441486.md.

Criteria: C1 verified, C2 verified.
