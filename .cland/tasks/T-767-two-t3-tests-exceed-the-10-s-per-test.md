---
id: T-767
kind: task
title: "Two T3 tests exceed the 10 s per-test budget: typecheck pinned compilers (13.5 s) and the startup-smoke planted hang (10.9 s)"
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-482
branch: t/T-767-two-t3-tests-exceed-the-10-s-per-test
created: 2026-10-18T03:04:17.694Z
updated: 2026-10-18T06:38:20.117Z
closed: 2026-10-18T06:38:20.117Z
---

## Summary

T-745's final full run 6fc7984b (A-4904, 2026-10-18 03:02Z) has no T1/T2 budget overruns left. Two T3 tests still exceed the 10 s per-test budget in report mode, and have across today's covers:
- hub/test/typecheck.test.ts "typecheck resolves pinned compilers in roots and linked worktrees": 13.5 s, regressed from a 12.0 s baseline.
- hub/test/startup-smoke.test.ts "a planted listening startup hang fails the smoke within its bound and names the last log event": 10.9 s.
Budgets turn hard one week after tiers.json landed (D53).

## What to build

Bring both under 10 s on the droplet with margin: a smaller compiler fixture or a shared compile for the typecheck case, and a shorter injected hang bound for the smoke case. Keep what each proves. Only if a case truly needs the time, give it an owned allowance with a reason.

## Acceptance criteria

- [x] C1. A full droplet run shows neither test in a "would fail" T3 budget line, with both tests' assertions unchanged in meaning.
  - done: impl-767 · 2026-10-18T06:37:45.362Z
  - verified: rev-31 [reviewer] · run rev-20261018-767-final · 2026-10-18T06:38:12.421Z · commit f321ce9a69f529946286c42178c802ce1e2963bb

## Comments

### impl-767 · 2026-10-18T06:29:06.824Z

Implementation keeps the T3 compiler contract and detached listening-hang lifecycle assertions. Typecheck fixture copies actual package scripts, tsconfigs and launcher with small node-typed sources; all three resolution layouts, compiler version and legacy API checks remain. Listening fault injection uses 5 s with the same 2 s teardown allowance. Baseline local: typecheck 7.086 s and listening hang 10.655 s. Initial smaller fixture: 1.865 s. Typecheck, tier lint and test lint pass; five serial file repetitions are in progress under load <15. No duration allowance added.

### rev-31 · 2026-10-18T06:31:32.558Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-767-source-1
commit: 0ea97ea7101bde3e7a52e4c5f274df082f9e365b
scope: full
findings: [{"severity":"medium","text":"M1: the listening-hang execFile child is unowned on parent cancellation; stop/reap and observe bounded close/result completion before fixture directory disposal.","file":"hub/test/startup-smoke.test.ts","line":72}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-767 source review — not clear

Commit:0ea97ea7101bde3e7a52e4c5f274df082f9e365b.
Fixed point: parent f831774d (pre-implementation integration).
Scope:full; read-only source/evidence review, no Reviewer execution.

## Standards

M1 medium — hub/test/startup-smoke.test.ts:72. The listening-hang execFile invocation is not registered with ownProcess, has no test-cancellation signal and no cleanup close join before tempProject disposal. Parent cancellation can therefore remove its preload root while the real worker/descendant lifecycle is still active. The pre-discovery case explicitly owns its worker and observed daemon; this invocation has no outer owner (Implementer confirmation ae8345f2). Register ownership immediately, stop/reap on cleanup/cancellation and observe a bounded close/result receipt before directory removal. Keep the planted-last-event and timing assertions. Add a controlled cancellation/failure cleanup check with no live owned process or root removed early. Avoid replacing this with an unbounded close join.

No other Standards finding. Real npm/compiler/Git subprocesses remain justified by the three installation-layout contract. Both files remain T3; no allowance, product timeout or tier/baseline change.

## Spec

Assertion equivalence otherwise holds. The compiler fixture retains actual workspace scripts, both tsconfigs and launcher with minimal node-typed source in both include sets; root, inherited worktree and worktree-local installs,7.0.2 executable identity,5.9.3 API identity and createProgram assertion remain. Whole-repository typechecking stays in the host gate rather than being multiplied by this resolution test.

The injected listening-hang budget alone changes10s→5s and its assertion remains deadline+2s (now7s). The result must still exit1 and specifically name planted-startup-hang, so failure to reach the planted connection is not accepted as green. The pre-discovery hang and actual scenario default10s are unchanged.

A-5019 independently inspected: both complete files5/5 serial, ten invocations/fifteen passing cases, zero failures/skips/cancellations/todo. Sampled load5.33–8.82. Typecheck maximum2.084955s; listening-hang maximum5.738627625s. A-5020 retains typecheck, tier and lint checks;200 repository lint findings are report-only.

C1 runtime remains pending: its literal full-droplet requirement must be supplied by the Coordinator's integrated full cover in addition to the ordinary mode-free diff-selected task receipt, unless the Coordinator explicitly changes that requirement. Do not request a manual full task run.

## Verdict

Source not clear for M1. Fail C1 for the unowned lifecycle on the changed hang test; this does not dispute the compiler fixture or shortened bound. Fresh corrected-head source review is required before verification. No per-item QA.
Standards:1 medium finding. Spec:assertion equivalence established apart from cleanup ownership; full runtime evidence pending.

Durable review:A-5024.

Criteria: C1 failed (The listening-hang worker has no cancellation/cleanup owner or close join before fixture removal; retain assertions and establish owned bounded cleanup.).

### impl-767 · 2026-10-18T06:34:06.421Z

M1 addressed at f321ce9a: listening-hang child owned immediately; beforeDirectories waits up to 3 s for close, retains final close and fixture-present assertions, then directory cleanup runs. Controlled 2 s test cancellation completed in 2.390 s, emitted close-before-removal receipt, with worker PID gone and fixture absent afterwards (A-5027; repeatable probe A-5028). Corrected head checks pass (A-5034), both files again 5/5 serial below load 7.31 (A-5033). Max per-test timings: typecheck 2.097 s, listening hang 5.612 s. Fresh source review requested before any verification. Full-droplet C1 remains pending integrated coverage.

### rev-31 · 2026-10-18T06:35:05.785Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-767-source-2
commit: f321ce9a69f529946286c42178c802ce1e2963bb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-767 corrected source review — clear

Commit:f321ce9a69f529946286c42178c802ce1e2963bb.
Scope:full source continuation. Prior review:rev-20261018-767-source-1 / A-5024.
Read-only; no Reviewer execution or edits.

## Standards

M1 resolved. The listening-hang execFile child is now owned immediately. Cleanup stops/reaps resources first, then beforeDirectories observes its actual close event with a3s bounded condition, retains the final closed assertion and proves the preload fixture still exists before disposal. There is no unbounded join.

Independently read A-5028's controlled probe and A-5027's captured result: Node cancels the listening test at2s, the close-before-removal diagnostic appears, the worker PID is absent and the preload root is gone afterward. The intentional cancellation exits nonzero and is correctly excluded from the green series; total2.38961425s. The probe observes the real child handle and fixture path rather than inventing a completion receipt.

No remaining source finding. Only startup-smoke cleanup changed since0ea97ea7; no dev merge, unrelated pick or allowance.

## Spec

The earlier assertion-equivalence analysis remains valid: actual npm scripts, configs and launcher with minimal Node-typed fixture sources; all root/inherited/local install modes; pinned7.0.2 compiler and5.9.3 API/createProgram assertions. Listening fault injection is5s with its original2s reporting/teardown margin, exit1 and exact planted last-event assertion. Production/default scenario10s and pre-discovery assertions are unchanged.

A-5033 independently audited: ten fresh whole-file invocations, five each,15 passing cases; every raw summary zero failures/skips/cancellations/todo, no late asynchronous diagnostics. Load6.47–7.30. Typecheck maximum2.097289s; listening hang maximum5.612351417s. All five hang passes emit the close-before-removal receipt. A-5034 retains refreshed host checks.

C1 remains unverified because it includes full-droplet budget evidence. Submit the normal mode-free diff-selected exact-head task verification after this clear source verdict. The literal full requirement remains for the Coordinator's accepted integrated full cover or an explicit criterion disposition; do not substitute a manual full task run or claim that selected evidence is a full cover.

## Verdict

Source clear, no complete criterion verification yet. M1 corrected; C1 final timing/execution mark pending. No per-item QA.
Standards:0 remaining findings. Spec:assertion equivalence established; runtime/full-cover evidence pending.

Durable review:A-5038.

### rev-31 · 2026-10-18T06:38:12.421Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-767-final
commit: f321ce9a69f529946286c42178c802ce1e2963bb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-767 final evidence review — clear

Commit:f321ce9a69f529946286c42178c802ce1e2963bb.
Scope:evidence. Source continuity:rev-20261018-767-source-2 / A-5038.
Read-only audit; no Reviewer execution.

## Standards

No remaining findings. Compiler assertion equivalence and owned bounded listening-worker cleanup remain current from source-2. A-5033's fresh Mac5/5 complete-file receipts and A-5027/A-5028's controlled cancellation evidence remain applicable: no green-series failure/skip/cancellation or late asynchronous diagnostic.

## Spec and runtime

Independently inspected A-5043 /99288d1f-8496-4534-b5fa-13f99427b093: passed/exit0 at the exact source-clear head, auto hub-selected. Both target tests execute positively, with raw timings:
- pinned compiler resolution:1.970164610s;
- planted listening startup hang:5.846251599s.

Both are under10s with margin, neither appears in any would-fail T3 budget line, and the log contains the bounded close-before-removal diagnostic. The unchanged pre-discovery cleanup test also passes in2.936638094s; the real startup scenario passes in1.299241369s. The legacy5s duration notice on the listening test is a diagnostic, not a T3 limit failure.

Total16/16 pass,0fail/cancelled/skipped:11 selected hub tests and5 Neovim smoke tests. This is selected hub plus smoke, not a full package cover. Linux x64/Node24.21.0/Neovim0.12.5,c-8 lon1,2workers; suite16.00s,peak load0.82,lifetime96s,cost$0.0067.

Independently read Coordinator77cc53fa-98b8-41db-8119-fdf907d458bd in topic-482: both-file selected receipt is accepted as C1 evidence for this per-test claim; no full task run is needed. The Coordinator will confirm in the next integrated cover. This explicitly resolves the literal full-droplet requirement noted in source review; it does not turn the selected receipt into a full run.

## Verdict

Final review clear; verify C1 under that disposition. Assertions retain their reviewed meaning. No additional task run, head change or per-item QA requested.
Standards:0 findings. Spec:0 remaining gaps.

Durable review:A-5044.

Criteria: C1 verified.

### coord · 2026-10-18T06:38:20.117Z

Merged 150abcc86f74a79c968fde12b03d906a4704c19e onto dev.
