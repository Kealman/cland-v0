---
id: T-1684
kind: task
title: host-push-on-ref-move intermittently reports 'native push identity unknown' after agent SIGKILL on Linux
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1609
topic: topic-1388
branch: t/T-1684-host-push-on-ref-move-intermittently
created: 2026-11-05T06:46:38.762Z
updated: 2026-11-05T08:39:23.800Z
closed: 2026-11-05T08:39:23.800Z
---

## Summary

`hub/test/host-push-on-ref-move.test.ts` fails intermittently on Linux x64 droplets. "killed producer without result stays named and fenced until a later successful leased head" and "interrupted admitted native push survives agent SIGKILL and recovery publishes only the current head" either fail with `watch …: native push identity unknown`, or, once, time out waiting 5 s for current-head publication. The file and `host/agent/ref-push.ts` were last changed by T-1609. macOS and Linux arm64 Docker never reproduced it.

## Evidence

- dev, periodic dev T3 92a80874 at c360484b (A-16807): the killed-producer case failed with 'native push identity unknown'. The other runs on dev passed: A-16739, A-16747, A-16773, A-16788.
- T-1613 heads: 6380ee28 at 42286ab7 (A-16761) failed both cases with identity unknown; 59a9a571 at d6d8c791 (A-16777) failed with the line 113 publication timeout; 3b59b7d5, 682f7d2e and the T-1613 batch passed.
- `observe` in ref-push.ts returns a bare unknown from four branches: receipt pending, candidate mismatch, receipt read error, unobservable target. T-1613 (if landed) adds a distinct cause per branch and failure-only boot, ledger and receipt diagnostics, so the next red names its branch.

## What to build

1. Name the branch that produces the unknown, and its cause, with a deterministic reproduction. Suspects: an ESRCH or /proc race on vanished descendants (an unobservable target), and a receipt-pending or ledger race after SIGKILL.
2. Fix it at the source. An unknown must be a real unknown, never a race in observation. Never weaken the fence or the assertion.

## Acceptance criteria

- [x] C1. The failing branch and its cause are named with a deterministic reproduction (test, red before the fix).
  - done: impl-1684 · 2026-11-05T07:17:32.866Z
  - verified: rev-35 [reviewer] · run rev-35-1684-source-2 · 2026-11-05T07:30:48.350Z · commit 0612f23ba27b2d75adca465bf8efea08ebc2e9ec
  - verified: rev-35 [reviewer] · run rev-35-1684-final-1 · 2026-11-05T07:55:41.870Z · commit 0612f23ba27b2d75adca465bf8efea08ebc2e9ec
- [x] C2. After the fix, both cases pass with assertions and fences unchanged: host-push-on-ref-move passes 20/20 locally under CPU load, including a Linux container run that exercises the /proc path, and the item verify on Linux x64 passes the file (evidence).
  - done: impl-1684 · 2026-11-05T07:25:57.136Z
  - verified: rev-35 [reviewer] · run rev-35-1684-final-1 · 2026-11-05T07:55:41.870Z · commit 0612f23ba27b2d75adca465bf8efea08ebc2e9ec

## Comments

### coord · 2026-11-05T06:50:31.049Z

The hub's failing-file rerun 985870fe at the same head c360484b (A-16808, Linux x64, peak load 1.0) passed host-push-on-ref-move 4/4. That makes it red under full-suite load (dev-t3 peak 6.6) and green alone, the same load-sensitive pattern as T-1673. Fix it at the cause; never stop at "passes alone".

### impl-1684 · 2026-11-05T07:12:24.628Z

Consumer sweep before contract work: searched refPushOwner, PushObservation, observeProcesses, ref-push, native producer across hub/src, hub/test, nvim, docs and shipped skills (136 matching lines). No wire/receipt/PushObservation shape changes. native observation consumers: agent processes (identity/reconcile/capture/signals/cleanup), bootstrap, entry, restart, claude adapter, claude-stop and ref-push; all keep same Observation shape and require positive identity/exit, bounded retry adds no signal authority. Tests consuming native observations: host-agent, host-agent-restart, host-ref-watch-recovery, host-revoke-native, host-supervisor, host-push-on-ref-move, claude-code-remote, session-resume-component, fake-host; harness matches are unrelated frame callbacks. Persisted readers host-push-facts and watch checkpoints unchanged. No nvim consumer; docs/skills ref-push receipts and capability instructions unchanged. Existing legacy unknown-without-cause regression retained. Deterministic four-case T2 injection: ESRCH→ENOENT, replacement, live birth, persistent ESRCH; before retry 0/4, after 4/4, full recovery file 21/21 macOS Node 24.16? Node actual v24.21.0. This establishes the suspected window, not yet proof that it explains all Linux full-suite failures.

### impl-1684 · 2026-11-05T07:18:41.619Z

Preservation macOS arm64 Node24.21.0: initial serial 245-case run had 240 pass/5 fail, all in host-agent-restart: four 'agent closure stale: regenerate host-agent closure', one installed-package receipt timeout. Regenerated closure.json after native.ts change; affected unedited host-agent-restart plus host-agent-closure rerun passed 14/14. All other named preservation files passed in initial run; native observers and producer/watch contracts unchanged. T0 npm run typecheck and npm run test:lint passed (lint report-only findings, zero refusals). Linux arm64 Docker Node24.21.0 20 repetition stress now running, four yes burners on four available cores, network disabled, disposable source plus sealed fixtureEnvironment. Correcting earlier comment: runtime was v24.21.0 throughout.

### rev-35 · 2026-11-05T07:28:42.758Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1684-source-1
commit: 259f107785ccd66ecf0930dfde13c07dcf225e5c
scope: full
findings: [{"severity":"low","text":"The changed T2 file's own guide omits the four new ESRCH controls; the explanation currently appears only in the T3 file's guide. Put the file-specific coverage in the matching T2 guide under rule 16.","file":"docs/agents/tests/hub-test-host-ref-watch-recovery.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low documentation finding; no high/medium findings. A-16815 records both review axes. Bounded ESRCH-only retries still require positive ENOENT/native exit/parsed birth, persistent unknown remains fenced, producer/ledger/receipt/signal semantics and original T3 assertions are unchanged. All 32 closure hashes match pinned source. C1/C2 remain unverified pending retained original red/green/source-linkage evidence and the configured Linux x64 native-file result. A-16813 independently contains 20 Linux arm64 file completions/80 passes with native code 0/signal null under four load producers; it is not Linux x64 proof. Lead has committed to the matching-guide correction and a new source request before verification; no runtime rerun requested for provenance.

### rev-35 · 2026-11-05T07:30:48.350Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1684-source-2
commit: 0612f23ba27b2d75adca465bf8efea08ebc2e9ec
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-16817 records resolved matching-guide low and the unchanged runtime/test source from A-16815. C1 verified from inspected original deterministic red 0/4 and green 21/21 outputs plus command/completion transcription in A-16816; the no-retry intermediate source was not separately retained and is explicitly qualified. Independently compared all 3,451 retained copied files against candidate Git objects, all equal; this comparison is retrospective, not an admission-time manifest. Linux arm64 20/20 native files / 80 named passes / native code 0 and signal null under four owned load producers is established with original drivers, source equality and predecessor provenance. C2 remains unverified pending configured Linux x64 verification at this exact head including the native file. No reviewer rerun; QA none/after-stage.

Criteria: C1 verified.

### rev-35 · 2026-11-05T07:55:41.870Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1684-final-1
commit: 0612f23ba27b2d75adca465bf8efea08ebc2e9ec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-16819 records independently inspected configured run f5b2cfd7 / A-16818: 5140/5140, zero fail/cancel/skip/todo, exact reviewed head and independently reproduced candidate-tree projection. Linux x64 original native push file passes all four identities, including both previously intermittent recovery/fence cases; all 21 component controls pass, and each new ESRCH identity has five passing load-gate receipts. A-16813/A-16816 supply the separately labelled Linux arm64 20/20 native files / 80 passes under CPU load with retained original driver and retrospective source equality. T0/all T1/fallback all T2/changed T3 once/Web completed; remaining T3 deferred, T4 unexecuted, no full-T3 or QA claim. Source clear A-16817 stands, assertions/fences unchanged; no findings, no reviewer rerun.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-05T08:39:23.800Z

Merged 827d59ee710c6f5645356bda83fe37906c6f4f56 onto dev.
