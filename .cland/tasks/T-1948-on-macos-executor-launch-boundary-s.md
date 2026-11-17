---
id: T-1948
kind: task
title: "On macOS, executor-launch-boundary's codex recording-remote case fails: the fake-only fixture root makes the Codex socket path exceed 104 bytes"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1626
topic: topic-1604
branch: t/T-1948-on-macos-executor-launch-boundary-s
created: 2026-11-17T17:06:05.449Z
updated: 2026-11-17T18:34:42.223Z
closed: 2026-11-17T18:34:42.223Z
---

## Summary

The macOS stage cover 06df9c86 at 0f36c7f38 (A-20907, 2026-11-17) fails one test, 0 of 5 load-gate repetitions: hub/test/executor-launch-boundary.test.ts, "codex final recording-remote new role launch strips executor transport controls". The error is "Codex socket exceeds 104 bytes on host recording-remote: /private/tmp/cland-suite-<uuid>/cland-fake-only-<x>/run/cx-<id>.sock", from hub/src/adapters/codex.ts:470. T-1626 added the test and hub/test/fake-only-fixture.ts. The fixture's root is mkdtemp(join(tmpdir(), 'cland-fake-only-')), and under a suite on macOS tmpdir() is the long per-run TMPDIR. Linux runs pass because their paths are shorter. The other three cases in the file pass on macOS.

## What to build

The fixture's project root is short enough on every platform that the adapters' socket paths fit the 104-byte limit, in the same way existing tests build deterministic short socket roots (for example host-records.test.ts C4). Production code is unchanged.

## Acceptance criteria

- [x] C1. executor-launch-boundary.test.ts passes on macOS under a suite TMPDIR as long as /private/tmp/cland-suite-<uuid>/ (test).
  - done: impl-1948 · 2026-11-17T17:11:02.619Z
  - verified: rev-35 [reviewer] · run rev-35-1948-final-1 · 2026-11-17T17:45:04.650Z · commit a7f5f1e2c179267617a44fb2e5b700a7f56d4c59
- [x] C2. At setup, the fixture asserts that its longest declared socket shapes fit in 103 bytes, naming the path when they don't: root/run/cx-<12 hex>.sock, fake-forward.sock and missing.sock (test).
  - done: impl-1948 · 2026-11-17T17:11:02.854Z
  - verified: rev-35 [reviewer] · run rev-35-1948-source-1 · 2026-11-17T17:15:21.527Z · commit a7f5f1e2c179267617a44fb2e5b700a7f56d4c59
  - verified: rev-35 [reviewer] · run rev-35-1948-final-1 · 2026-11-17T17:45:04.650Z · commit a7f5f1e2c179267617a44fb2e5b700a7f56d4c59

## Comments

### impl-1948 · 2026-11-17T17:08:40.610Z

Consumer census (field/function/import search fakeOnlyFixture + fake-only-fixture across repo): executor-contract.test.ts (T1), executor-launch-boundary.test.ts (T2), host-create-admission.test.ts (T2), suite-t3-interactions.test.ts (T2). No production consumers; no public wire contract change. macOS long-TMPDIR positive control before fix: 11/12 pass; Codex recording-remote new-role fails with 'Codex socket exceeds 104 bytes on host recording-remote' and path under suite TMPDIR. Node v24.21.0, local targeted test, no suite receipt.

### rev-35 · 2026-11-17T17:15:21.527Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1948-source-1
commit: a7f5f1e2c179267617a44fb2e5b700a7f56d4c59
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20910 full source clear at tree 15642d86b116e2420d758e0a9ac2bbd715cf4f24, fixed base 0f36c7f386fd013ef2ce08db982ec96bc9e46244. Standards zero findings; Spec zero findings. One fixture-only change allocates short owned mkdtemp roots independent of suite TMPDIR. Existing whole-body cleanup and counted callback/custom/prototype launch guards are unchanged; new assertions occur inside joined work before body. C2 verified under Coordinator 8e00b295 declared-shape scope: all three required paths checked in UTF-8 bytes <=103 with offending path in refusal. Static six-character suffix shapes are 47/40/35 bytes Darwin, 39/32/27 Linux, not runtime measurements. Four callers/tier/raw-prefix census complete; no production, public command or classification change. A-20908/A-20909 retain macOS Node24.21 long-TMPDIR red11/12 and separate green caller files8/8,6/6,2/2,12/12; all precommit, first two before non-Darwin-only edit. Committed helper blob bf3cb4c17a11a43c0fc85df43929ed3a77104f06 matches retained diff abbreviation, not per-invocation tree proof. Full candidate lint/typecheck native exit0; lint130/63 report-only,0refusals; outer signals/raw hashes/publication scan controls unknown. Failed original stage A-20907 remains failed history. C1 pending same-head configured final plus qualified macOS evidence. No Reviewer runtime/probes/edits; request Coordinator window at unchanged head, no dev merge.

Criteria: C2 verified.

### impl-1948 · 2026-11-17T17:42:18.504Z

Configured verification receipt fd8e14ae-749d-4ba6-b46c-1357c6366c78 at a7f5f1e2c179267617a44fb2e5b700a7f56d4c59: auto exit 0; T0, T1, T2, Web completed exit 0; 6686 tests passed, none failed/cancelled/skipped. Task fallback all T2 because helper path coverage unsupported. Linux x64 6.8.0-147-generic droplet c-8 sfo2, Node 24.21.0, lifetime 1400 s, $0.0972. Browser binary identity not in summary (unknown here). Budget/lint advisories report-only. T3 deferred to merge batch; T4 unexecuted. Repeated 'suite infrastructure: suite ticket lost; remover unknown' is known T-1935 text noise per Coordinator brief, reported upstream; no rerun. Log A-20911. macOS long-TMPDIR proof is local targeted precommit evidence qualified in A-20909, not a macOS suite receipt. Final same-head settlement belongs to Reviewer.

### rev-35 · 2026-11-17T17:45:04.650Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1948-final-1
commit: a7f5f1e2c179267617a44fb2e5b700a7f56d4c59
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20912 final evidence clear; source A-20910 unchanged, clean a7f5f1e2, Git tree 15642d86b116e2420d758e0a9ac2bbd715cf4f24. Configured fd8e14ae/A-20911 passed, normalized delivered tree29e06f4e58047f5af03d940ade4e40c48819b084. Independent audit: 6,686 ordinary passes/710 passing file envelopes, no fail/cancel/skip/todo; all224 T1/431 T2/55 Web selected files positive; separate210 load passes. Four caller files pass8/8,12/12,6/6,2/2 with positive file envelopes; target Codex remote new-role16836 and restored-row16840 pass. Caller cases base-only, no own repetitions. All269 T3/17 T4 unexecuted. C1 combines qualified precommit macOS long-TMPDIR red11/12 then final-candidate12/12 with unchanged reviewed Darwin behavior/source-blob linkage and exact-head Linux integration; no exact-head macOS run or repaired original stage is inferred. C2 setup declared shapes match Coordinator8e00b295. Uncached Linux x64 Node24.21/Neovim0.12.5, isolated Headless Shell1248/CfT156 browser. Warning108 identities: two added versus A-20893 are same counted original-custom refusal controls, not new native escapes. All15 repeated ticket-lost rows independently attributed to pinned suite-command's15 intentional infrastructure modes, each with structured pass; not assumed from old single-pair signature. Outer hub pass/Finished0 independent. Lint130/63 and budgets/ratchet report-only; billing lifetime not wall. Prior failed stage A-20907 and unknown native invocation-tree/raw/signal/publication-scan facts retained. No Reviewer runtime/probes/edits or additional run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T18:34:42.223Z

Merged 5930e03e8db1971c901950ddd38d55cfa4a6521a onto dev.
