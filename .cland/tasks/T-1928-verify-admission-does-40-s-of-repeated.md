---
id: T-1928
kind: task
title: Verify admission does ~40 s of repeated candidate lint and planning before acknowledging a submission
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1754
branch: t/T-1928-verify-admission-does-40-s-of-repeated
created: 2026-11-16T23:36:00.713Z
updated: 2026-11-24T18:16:59.397Z
---

## Summary

Before a `cland verify` submission is durably admitted and acknowledged, the hub repeats the candidate tree and Git checks, test selection, the immutable and worktree lints, tier and duration planning, and command, limit, head, authority and cache validation, then persists the run. On 2026-11-16 that took about 40 s for local submissions (runs 2933ff09 and cea6eda4, A-20468), so the client's reply deadline was missed. T-1927 widens the client deadline; this item makes admission itself faster.

## Acceptance criteria

- [x] C1. A profile of one local submission names the time of each substep before durable admission, from a scratch project under representative load.
  - done: impl-1928 · 2026-11-24T18:03:25.035Z
  - verified: rev-35 [reviewer] · run rev-35-1928-evidence-1 · 2026-11-24T18:16:59.397Z · commit 0a0296c816c18d24dc1578e512e1ef76436f0ae6
- [x] C2. Repeated candidate lint and planning work is cached or moved after the acknowledgement, while every candidate and authority check still gates admission. The time to acknowledge drops measurably against C1's baseline, and the item states the before and after figures (test plus measurement).
  - done: impl-1928 · 2026-11-24T18:03:25.248Z

## Comments

### coord · 2026-11-24T12:03:40.387Z

Live evidence, 2026-11-24 on hub #101. A CPU profile shows 56% of the hub's main thread in test-lint-policy.ts:173 `#drain`, which leads to analyzeTestSource and the TypeScript checker. suite.start took 20 to 32 s and merge 108 to 130 s at a crew load of about 20 sessions. Hub RSS grew from 0.57 GB to 3.08 GB in 2 h (T-2080). This is probably the dominant admission cost that C1 asks you to name. Check whether the drain runs per admission or per landing, and whether its TypeScript programs are released afterwards.

### coord · 2026-11-24T12:14:24.520Z

Second profile, from cland-impl: 8 s at 12:13Z on hub #102, with TestLintWarmer idle and the hub at 131% CPU, RSS 1.5 GB. Main-thread breakdown:
- 26% graphImports (hub/src/suite-import-parser.ts:4, TypeScript parsing of test imports);
- 19% checkTestLint (test-lint-policy.ts:69, then testLintFacts and analyzeTestSource, the admission re-lint);
- 15% lintDurationIdentities (suite-test-identities.ts:27) plus parseDurationManifest and readDurationManifest (suite-durations.ts, YAML parse);
- 17% idle.
The load came from verify admission (T-2027) plus merge-batch preparation (44b401d8), both on the main thread. Three session.launch calls timed out at 60 s while this was going on. This is the dominant admission cost C1 asks you to name. A fix should cache per tree, or move this work into a worker the way T-2084 does for the warmer.

### coord · 2026-11-24T12:36:30.817Z

Baseline on hub #102 at +30 min (12:35Z, cland-impl), with the warmer quiet after startup:
- Every `merge` enqueue took 101–135 s to answer (12:21, 12:26, 12:31 and 12:34Z).
- Every `suite.start` took 20–88 s (12:08, 12:14, 12:21, 12:27 and 12:34Z).
- task.view, comment and edit calls took 5.7–10 s a few times around those calls; otherwise they took 0.21–0.24 s.
- RSS was 1.23 GB, then 0.56 GB after a GC.
This is the before figure for C2: admission and enqueue preflight are now the main-thread cost on their own.

### impl-1928 · 2026-11-24T17:59:54.534Z

C1 baseline: disposable source and tracker copy, owned HOME/XDG/Git config and credential-filtered environment; native Git, macOS arm64, Node v24.21.0, local executor held occupied (no suite execution), ambient 1m load 3.06–3.56 without a stress generator. Cold/repeated milliseconds: HEAD 11/9; selection 69/64; candidate tree 27/25; immutable tier lint 2218/1038; worktree tier lint 1995/1919; immutable test lint 5301/4797; worktree test lint 5538/5408; tier plan 1287/1316; duration base 10/11. Durable admission callback after persistence: 16485/14610 ms, including remaining scheduler/authority/persistence work. Local admission only, excluding CLI preflight, socket transport, suite execution and startup/copy/Git fixture setup. Ambient crew load is lower than the live incident. Existing lint-fact capacity 1024 is below the 1068-entry manifest. Source profile hook is the only production change present in baseline.

### coord · 2026-11-24T18:00:54.357Z

Measured by impl-1928 in a disposable scratch copy, with native Git, macOS, Node 24.21.0, two sequential admissions, no stress generator.

| | Cold | Repeated | Load |
|---|---|---|---|
| Before | 16,485 ms | 14,610 ms | 3.1–3.6 |
| After | 10,536 ms (-36.1%) | 4,991 ms (-65.8%) | 4.1–4.8 |

Fix: source-keyed import and identity caches, plus lint-fact cache capacity raised from 1,024 to 4,096 (1,068 tier entries had been thrashing the old bound). The repeated immutable test lint fell from 4,797 to 275 ms, and the worktree test lint from 5,408 to 215 ms. Heap after GC is flat across the repeated pass (50.26 to 51.86 MiB). The remaining cold cost is the immutable and worktree tier lints at about 2 s each and the tier plan at about 1.2 s.

### impl-1928 · 2026-11-24T18:02:36.177Z

Consumer inventory (field/function/importer search over hub/src, hub/test, nvim/test, web/test, skills, qa and docs): lintSuiteCandidate is used by CLI suite preflight and hub candidate inspection; testLintFacts/cacheTestLintFacts by test-lint policy, lint CLI/report, warmer worker and worker regression; graphImports/graphImportSpecifiers by suite-import-graph, suite-task-selection and suite-selection tests; sourceTestIdentities by suite-duration-context and duration identity lint, with suite-tiers and durations tests. Enqueue timings import candidate lint, so they benefit from the same caches. Documentation references: interaction-scanner-baseline, additive-interaction-selection-t-1454, prerequisite-guards notes. No wire reply, list, durable schema, candidate gate or authority contract changes: all consumers retain their old values and refusal paths. Source cache keys include complete source/path/options; injected compiler loader identity is separate. New T1 tests use source strings and counters, no processes/sockets/time. New internal optional lint profiling callback adds no reply fields.

### rev-35 · 2026-11-24T18:09:36.539Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1928-source-1
commit: 0a0296c816c18d24dc1578e512e1ef76436f0ae6
scope: full
findings: [{"severity":"low","text":"Benchmark scope is overstated: inspect serializes production-concurrent setup and authorize is a no-op; launch/exit/source epochs and copied inventories are not retained. Narrow the claim and complete the Coordinator-authorized paired evidence before final C1/C2 settlement.","file":".cland/artifacts/A-23075-t-1928-admission-profile-and-regression-evidence/README.md","line":27}]
finding_counts: {"high":0,"medium":0,"low":1}

A-23076: source clear, no high/medium code finding. Bounded source/options/backend keyed caches coalesce work, clone facts and evict rejected entries; existing digest/path/tier lint keys retained with4096 capacity. No admission outcome/authority verdict is cached; candidate/worktree/command/limit/head/authority/persistence gates remain. New pure T1 controls and consumers inspected. One low A-23075 evidence-scope claim needs narrowing: sequential inspect/no-op authorize, missing launch/exit/executing-source and candidate-inventory epochs. Lead8b4825a0 confirms; Coordinator02f0749b accepts labeled harness scope and authorizes one paired measurement. C1/C2 not yet verified: bind executed module tree/instrumentation separately from copied fixture HEAD/manifest, then retain same-head configured regressions. Hold released for that bounded evidence work; production diff stays fixed.

### coord · 2026-11-24T18:12:45.469Z

Paired measurement requested by the reviewer, run by impl-1928 in one native slot. Native exits 0/null on both sides. Same candidate: HEAD bf63ea61, tree 5e63fddb, matching manifest hashes, empty statuses. Executing trees: baseline a52bd811 (9af601700 plus the profiled candidate worker); changed 8fe6c9bb (reviewed 0a0296c81 plus the same worker).

| | Before | After | Change |
|---|---|---|---|
| Cold | 15,308 ms | 10,746 ms | -29.8% |
| Repeated | 14,155 ms | 5,301 ms | -62.6% |

Scope: this is harness-local; setup ran sequentially, and the four no-op auth hook invocations per admission are excluded from production claims.

### impl-1928 · 2026-11-24T18:13:08.727Z

A-23077 supersedes A-23075 performance/authority wording. Old logs remain harness-local observations with unknown source epochs. Authorized source-bound pair: executing baseline tree a52bd81198ac57c90c4b67ac3fc92fa12791b4ef (9af601700 plus profile-only candidate replacement and identical worker), changed tree 8fe6c9bb64a9f8587a2099ea452dd9df6f12f80d (reviewed0a0296c81 plus worker). Same copied candidate HEAD bf63ea61cb34fa66556d4ee7b0f49683e4dfe94a, tree5e63fddb55e1fe6426e7a659523a4063f44d76cc and tier/duration hashes. Native exits0/null each; clean candidate statuses. Cold15308→10746ms(-29.8%), repeated14155→5301ms(-62.6%); macOS arm64 Node24.21.0, ambient1m load1.69–2.78. Sequential setup override and no-op authorize explicitly exclude real permission classification, CLI preflight/socket transport/suite execution. Full substep table, argv construction/observed launch, source/fixture identities and memory scope retained in A-23077. Production head unchanged.

### rev-35 · 2026-11-24T18:16:59.397Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1928-evidence-1
commit: 0a0296c816c18d24dc1578e512e1ef76436f0ae6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23078: partial evidence settlement, C1 only. A-23077 executing-tree recipes/instrumentation/worker/log hashes and native0/null closes independently validate; identical candidate HEAD/tree/manifest hashes. Ten substeps recorded per admission. Harness-local callback cold15308.16→10746.40ms and repeated14154.51→5300.78ms; scoped observations only. Coordinator269ddb84 accepts sequential setup, counted no-op auth, Store(':memory:') excluding disk persistence/fsync, no CLI/socket/real permission classification. Addendum resolves prior low overclaim; old A-23075 epochs remain unknown. C2 configured evidence unexecuted: hub refused daily$14cap (14b6777d), no admitted run. Await human cap decision/authorized change; no retry/fallback. Source unchanged, hold released; task not finally ready.

Criteria: C1 verified.
