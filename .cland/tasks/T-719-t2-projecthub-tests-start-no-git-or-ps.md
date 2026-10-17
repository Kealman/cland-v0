---
id: T-719
kind: task
title: "T2 projectHub tests start no git or ps probe: injected tracker reader and process table"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-677
blocked_by:
  - T-685
topic: topic-444
branch: t/T-719-t2-projecthub-tests-start-no-git-or-ps
created: 2026-10-16T20:09:33.790Z
updated: 2026-10-17T15:07:28.448Z
---

## Summary

A T2 projectHub test still spawns infrastructure probes: about 6 git calls (configuration source commit, tracker branch tips) and 3 ps calls (lock identity, harness cleanup) per fixture, found by T-685's spawn census. A T2 test should start no child process unless the native boundary is its subject (memo §5.1, A-4143).

## What to build

projectHub and the in-process hub take narrow in-process answers for these probes in T2: the tracker reads branch tips and the configuration commit through an injected reader, and lock identity and cleanup use an injected process table. The real git and ps paths stay the production default and stay covered by their own T3 lifecycle files.

## Acceptance criteria

- [x] C1. A T2 projectHub test that launches, signals and stops a session through the in-process fake adapter shows zero child processes in its spawn census row, proved by a census test.
  - done: impl-719 · 2026-10-17T14:30:09.500Z
- [x] C2. The production git and ps paths are unchanged and still covered by their existing lifecycle tests, with each T3 file's assertions unchanged in meaning.
  - done: impl-719 · 2026-10-17T14:30:10.101Z
  - verified: rev-30 [reviewer] · run rev-20261017-719-source · 2026-10-17T14:34:37.713Z · commit 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a

## Comments

### impl-719 · 2026-10-17T14:26:46.754Z

Implementation at d99c2d2e (origin/dev merged before review): serveProject accepts injected Git/base readers and synchronous lock process table; projectHub has probes:'fake' preset. Census covers imports, all three fake adapters' launch/signals/stop, teardown, injected nonempty branch/provenance facts and reload with zero children. NO_PS moved unchanged to native-process.ts, with only import changes in eight native test files; cleanup self ps is lazy. Typecheck and tiers pass. Collecting serial 5/5 census medians and unchanged native-path receipts before review.

### impl-719 · 2026-10-17T14:32:42.264Z

Final source-review head 3964cc80 pushed to origin; review requested from Reviewer in topic-444. A-4548 is the updated durable evidence artifact: zero-child census 5/5, Mac median 0.315233s, load 3.8; duplicate-root refusal, all three fake adapters, injected branch/provenance and reload. 112 declaration audit rows include new census plus unchanged native tests; all existing declaration bodies/options unchanged. Supporting native-path checks green; exact-head Linux run follows clear source verdict. QA policy none/after-stage.

### rev-30 · 2026-10-17T14:34:37.713Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-719-source
commit: 3964cc80d2ccf88ee6e1ba97fedfaaa460e30c7a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at3964cc80, fixed42ebe8a0; Standards0/Spec0 findings. All18files reviewed. Optional Git/base and synchronous lock-process readers preserve native defaults, commands/cache/ownership checks; async locks unchanged. Explicit projectHub fake preset uses PID liveness+nullstart conservative across native/injected readers, with duplicate-root refusal. Lazy cleanup self identity removes eager ps but retains native group/ancestor/start protections. NO_PS moved verbatim; all eight existing native files independently non-import-byte-identical. Tier manifest only one sortedT2entry, durations unchanged. A-4548 final census5/5 zerochildren in imports/threeadapterlifecycles/configreload/teardown; independent recorder0children/0gaps/0truncation. Before directly2Git+3ps, baseline descendant gaps disclosed/no speedup ratio. Eleven supporting native/config/freshness files128/128green before fake-preset-only hardening; unchanged native/default paths retained. C2 verified. C1 awaits exact-head droplet evidence; normal mode-free verification may run at this head. No Reviewer execution or per-item QA.

Criteria: C2 verified.
