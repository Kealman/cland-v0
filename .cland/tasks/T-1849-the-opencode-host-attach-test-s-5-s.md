---
id: T-1849
kind: task
title: The opencode host-attach test's 5 s close deadline fails under a loaded macOS full run
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1502
branch: t/T-1849-the-opencode-host-attach-test-s-5-s
created: 2026-11-14T03:43:39.067Z
updated: 2026-11-14T05:51:30.020Z
closed: 2026-11-14T05:51:30.020Z
---

## Summary

`hub/test/host-attach.test.ts` "opencode host attach uses private environment, refuses foreign records and exit preserves native identity" failed in the T-1846 + T-1847 local merge batch a52745fe (log A-19260, head ccb28cf45, darwin arm64, 1 worker, peak 1-minute load 5.07). The error was `Error: attach close incomplete; stderr:` (host-attach.test.ts:72, fired from a 5 s deadline). Alone, it passed 5/5 at 2026-11-14 03:43Z in 0.46–0.99 s each.

## What to build

The case's wait for the attach process to close uses `testWaitMs()` scaling, or a named bound sized for a loaded one-worker full T3 run. The behaviour it proves (private environment, refusal of foreign records, native identity preserved on exit) stays asserted exactly. If the close is slow because the product is slow under load, the item names that instead of widening the wait.

## Acceptance criteria

- [x] C1. The attach-close wait in host-attach.test.ts no longer depends on a fixed 5 s real-time deadline, and an attach that never closes still fails the case (test).
  - done: impl-1849 · 2026-11-14T03:58:40.582Z
  - verified: rev-36 [reviewer] · run rev-36-1849-final-1 · 2026-11-14T04:44:02.858Z · commit c35fa0bade6adf375fa154f6c9cc44d7679d6592
- [x] C2. The case passes five lone repetitions on macOS and the task's mode-free verify (test).
  - done: impl-1849 · 2026-11-14T03:58:40.686Z
  - verified: rev-36 [reviewer] · run rev-36-1849-final-1 · 2026-11-14T04:44:02.858Z · commit c35fa0bade6adf375fa154f6c9cc44d7679d6592

## Comments

### coord · 2026-11-14T03:51:36.082Z

Moved into R-1530 under the human's standing yes for test-defect items in the running release (2026-10-28): it reddened batch a52745fe alongside T-1846's case, and the stage-2 macOS cover rerun needs a quiet suite.

### impl-1849 · 2026-11-14T03:53:34.169Z

Diagnosis baseline: batch a52745fe at ccb28cf45 (A-19260), darwin arm64, one worker, reported `Error: attach close incomplete; stderr:`. Existing 5 s deadline starts immediately after spawning a fresh CLI and includes module loading, hostAttachPlan record read + native identity probe, execve /bin/sh, stty and fake harness exit. No held precondition or shutdown grace is present for opencode. Probe is absolute /usr/bin/perl; fake PATH includes stty/harness/env only, so does not intercept it. No shared contract changes. Waiting on T-1851 preservation lock before controlled native probes.

### impl-1849 · 2026-11-14T03:58:40.772Z

Implemented c35fa0bade6adf375fa154f6c9cc44d7679d6592, pushed origin; fetched/merged origin/dev once (already current). Evidence A-19276 and complete inventory A-19275: controlled startup old-bound red/configured-bound green; held-client bound red; five lone macOS passes0.439–0.522s, serial pair4/4. No repeatable unmutated product slowness, original exact stage unknown. Positive-control secret scan matched, exported evidence/inventory zero matches. Native lock released with inventory13501→13501 delta0. QA policy none. Review next; exact-head mode-free local verification pending.

### rev-36 · 2026-11-14T04:01:56.418Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1849-source-1
commit: c35fa0bade6adf375fa154f6c9cc44d7679d6592
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, zero Standards/Spec findings. Fixed5s attach completion becomes shared testWaitMs(default15s), retaining actual close, code/signal, environment/record/refusal/native-identity assertions and joined before-directory cleanup. Failure reports last usable existing fixture receipt without logging its content. No production/shared-contract change; docs match. C1/C2 runtime verification pending exact-head mode-free receipt and retained controlled-never-close/normal-run producer facts requested from existing outputs. A-19276 narrative limits/original unknown stage and A-19275 names-only equality remain qualified. No reviewer native execution or additional provenance-only/fullT3 run requested.

### rev-36 · 2026-11-14T04:44:02.858Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1849-final-1
commit: c35fa0bade6adf375fa154f6c9cc44d7679d6592
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C2 verified. Independently read A-19282:6259 base passes/692 file passes,separate125 load passes; all5 host-attach identities/file finish plus3 routing identities/file finish pass,OpenCode1.854873875s. A-19278 retained delayed-start old-bound red/configured green and held-client1500ms missing-close red establish bounded failure; five normal macOS lone passes and tool/source limits accepted. Source proof A-19279 unchanged. T0/T1/fallbackT2/changedT3 once/Web green,localdarwinarm64 Node24.21/Nvim0.12.5/HeadlessShell1248 CfT156 attested. Report-only advisories retained; names-only inventory excludes ha/account roots,original loaded stage unknown. Full remainingT3/T4/Linux unexecuted,QA-none; no reviewer execution/further run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-14T05:51:30.020Z

Merged f4f4689ee03c08e1a9990d779098ccc2e5473f39 onto dev.
