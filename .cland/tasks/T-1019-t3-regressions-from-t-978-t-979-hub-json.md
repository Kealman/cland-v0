---
id: T-1019
kind: task
title: "T3 regressions from T-978/T-979: hub.json webPort, the status web line, the typecheck fixture"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-978
found_by: cover
topic: topic-760
branch: t/T-1019-t3-regressions-from-t-978-t-979-hub-json
created: 2026-10-20T18:14:13.158Z
updated: 2026-10-20T18:32:24.958Z
closed: 2026-10-20T18:32:24.958Z
---

## Summary

The integrated cover 026b3431 at 76655c4c (A-7887) found three T3 regressions from T-978 (web edge) and T-979 (wire module), which landed through T1-only batches (D77): the hub-lifecycle scenario still expects hub.json without `webPort`; `cland hub status` prints the `web` line inside the sessions block, between `sessions: 1` and the session rows; and typecheck.test.ts copies a project fixture without `shared/wire/tsconfig.json`, so the new root typecheck step fails with TS5058.

## What to build

The status printer puts `web` in the hub block (beside pid, port, socket, uptime, version). The hub-lifecycle test expects `webPort` in hub.json and the corrected layout. The typecheck test fixture includes `shared/wire/` (or derives its copied paths from the typecheck script). Run all three as targeted local T3 runs.

## Acceptance criteria

- [x] C1. `cland hub status` prints `web` in the hub block, and the session rows follow `sessions: N` directly (test).
  - done: impl-1019 · 2026-10-20T18:18:37.325Z
  - verified: rev-26 [reviewer] · run rev-20261020-1019-final-1 · 2026-10-20T18:27:31.689Z · commit 7d92f03e4644b5cd11854455f0a69971806c0b9a
- [x] C2. hub/test/scenarios/hub-lifecycle.test.ts passes, expecting `webPort` in hub.json (targeted local T3 run named in the item topic).
  - done: impl-1019 · 2026-10-20T18:18:38.224Z
  - verified: rev-26 [reviewer] · run rev-20261020-1019-source-1 · 2026-10-20T18:19:49.798Z · commit 7d92f03e4644b5cd11854455f0a69971806c0b9a
  - verified: rev-26 [reviewer] · run rev-20261020-1019-final-1 · 2026-10-20T18:27:31.689Z · commit 7d92f03e4644b5cd11854455f0a69971806c0b9a
- [x] C3. hub/test/typecheck.test.ts passes with the root typecheck that includes shared/wire (targeted local T3 run named in the item topic).
  - done: impl-1019 · 2026-10-20T18:18:39.120Z
  - verified: rev-26 [reviewer] · run rev-20261020-1019-source-1 · 2026-10-20T18:19:49.798Z · commit 7d92f03e4644b5cd11854455f0a69971806c0b9a
  - verified: rev-26 [reviewer] · run rev-20261020-1019-final-1 · 2026-10-20T18:27:31.689Z · commit 7d92f03e4644b5cd11854455f0a69971806c0b9a

## Comments

### impl-1019 · 2026-10-20T18:16:51.133Z

Reproduced the three A-7887 failures in disposable local runs: hub-lifecycle discovery gained webPort, status inserted web between sessions heading and rows, compiler fixture missing shared/wire/tsconfig.json (TS5058). Fixed printer grouping and contracts; added T2 coverage for available/unavailable web output with a priority warning. Typecheck fixture now seals child Git/npm environments too. Targeted validation running on local darwin/arm64 with scratch HOME/XDG/Git configuration and credential filtering; no suite/load gate claimed.

### impl-1019 · 2026-10-20T18:18:56.547Z

At pushed 7d92f03e4644b5cd11854455f0a69971806c0b9a: local darwin/arm64 targeted T2 hub-status-component 4/4, T3 hub-lifecycle 6/6, T3 typecheck 1/1, all exit 0 (A-7891). npm run check exits 0 in disposable Git copy; static lint report-only diagnostics, zero policy refusals (A-7894). C1–C3 done; review requested through reviewer routing. Mode-free suite awaits clear source verdict. No QA required by item policy.

### rev-26 · 2026-10-20T18:19:49.798Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1019-source-1
commit: 7d92f03e4644b5cd11854455f0a69971806c0b9a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Full seven-file review against fixed 21b33962. describe() emits web and priority warning before sessions heading, preserving direct session-row adjacency; JSON contract unchanged. New T2 socket regression covers available/unavailable web plus warning; native lifecycle retains session adjacency and expects discovery webPort. Compiler fixture includes real shared/wire config plus browser-safe source, retains root/ancestor/worktree-local compiler checks and sealed Git/npm environments. Matching help/README/tests guide updated. Read-only diff check passes. Audit A-7896.

A-7891 local Darwin arm64 Node v24.21.0 retained stdout/explicit exits: status T2 4/4, lifecycle T3 6/6, compiler T3 1/1, no fail/cancel/skip. C2/C3 explicitly require these targeted local runs and are verified. C1/final execution awaits mode-free exact-head gate. These direct runs have no suite/load/duration gate; exact-head attribution is supplied by request/filename, not embedded SHA. A-7894 retains disposable-copy check output (hub+nvim+wire typecheck/static lint; test lint report-only 131 findings/zero refusals), lead exit 0. A-7892 actual pre-fix red outputs inspected before classification. No Linux/integrated pass or Reviewer execution claimed.

Criteria: C2 verified, C3 verified.

### rev-26 · 2026-10-20T18:27:31.689Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1019-final-1
commit: 7d92f03e4644b5cd11854455f0a69971806c0b9a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Audited exact-head A-7912 / c9d102ff: 2,089 ordinary passing test records, five passing load records, zero fail/cancel/skip. Hub-status component 4/4; new web/warning grouping regression ordinary 0.021090156 s and actual 5/5 repetitions (maximum 0.066597085 s), within T2. C1 verified; C2/C3 retain separately inspected A-7891 local Darwin arm64 targeted T3 lifecycle 6/6 and compiler 1/1 explicit exit-0 evidence as required by their wording. All three criteria verified. Audit A-7913.

Linux x64 c-8 lon1 droplet, two workers, Node v24.21.0 / Neovim v0.12.5; T1 exit 0 (command 43 s/package 39.39 s), fallback all T2 in both packages exit 0 (command 265 s/package 261.79 s). Actual execution, no cache/projection claim. Host check output/ref 46c2e760 not repeated remotely; lint/budgets/ratchet report-only. T3/T4 did not execute in this receipt; local required T3 runs stay separately attributed. Lifetime 385 s/cost $0.0268. No Reviewer tests or edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T18:32:24.958Z

Merged 9bbf370346775a65e434cb066fc2ba1fced6ad1f onto dev.
