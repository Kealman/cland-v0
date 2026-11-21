---
id: T-1896
kind: task
title: Shard batches; cut the full run toward 15 min
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1688
branch: t/T-1896-shard-batches-cut-the-full-run-toward-15
created: 2026-11-16T07:29:46.101Z
updated: 2026-11-21T00:09:08.775Z
closed: 2026-11-21T00:09:08.775Z
---

## Summary

`suites.ts:1006` excludes batches, soak and dev-t3 from sharding. A green batch takes 37 min median and a cover 38 min. Sharding costs about +2–3 min of setup per shard and little money (§4.5). impl #2.

Kind: product + config. Triage ticket H-8 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

cost: more droplets per run under the $14/day cap (human's cap). The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. A batch run shards across `verification.shards` machines and lands only when all shards are green (test).
  - done: impl-1896 · 2026-11-20T21:25:36.922Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1896-final · 2026-11-20T22:35:53.653Z · commit 429c10c84ef483f4c8626f2b1ccf3c7fe7e413a0
- [x] C2. An artifact gives the per-phase wall time and the 20 slowest files of five covers and five batches, and the shard count that reaches 15 min or less (evidence).
  - done: impl-1896 · 2026-11-20T21:10:13.277Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1896-source2 · 2026-11-20T21:27:33.512Z · commit 429c10c84ef483f4c8626f2b1ccf3c7fe7e413a0
  - verified: rev-40 [reviewer] · run rev-40-20261120-1896-final · 2026-11-20T22:35:53.653Z · commit 429c10c84ef483f4c8626f2b1ccf3c7fe7e413a0

## Dependencies

none; suites.ts

## Comments

### coord · 2026-11-20T20:54:27.145Z

C3 (one-day median at or under 20 min) moved to T-2042 on 2026-11-20. It's post-landing evidence and can't gate the merge. T-1896 keeps C1 (sharded batches land only when all shards are green) and C2 (shard-count sizing artifact from existing covers and batches).

### impl-1896 · 2026-11-20T21:00:01.232Z

Consumer census: scheduler/job persistence/history/isolation; merge-batches diagnostic and landing; dev-t3 full-cover policy; suite-shards/package planning; aggregate logs, infrastructure, raw coverage and flaky reruns; droplet reservations/accounting; protocol/status clients (unchanged wire); stage/close/soak fixtures and tests across tiers; defaults/config tests; docs/agents/tests.md, docs/hub/running.md, merge/QA skills and role source. Optional internal plannedShards added; legacy nonsharded receipts and previous selection wire retained. Non-cland/whole-test-only commands remain single-machine. Full batch proof requires complete structured child receipts and exact parent file inventory; partial masks remain partial.

### impl-1896 · 2026-11-20T21:10:13.466Z

C1: red observed at fake Suites seam (undefined !== 2 before batch sharding), and at full-cover seam (complete sharded batch rejected before policy update). Green controls: configured 2/3 shards, missing-last receipt pending, red last shard no landing, all-green exact candidate lands; light importer masks and one Web/Neovim owner; full coverage rejects missing/red/incomplete/foreign shards and missing file inventory. Existing merge-batches 143 tests passed on macOS with fake executors; no browser. C2: A-22267 at .cland/artifacts/A-22267-t-1896-five-covers-and-five-batches-phase-times-slow-files-and-shard-sizing.md. Five-batch model: five shards 10.39–13.84 min and USD 0.2165–0.2883/run, setup estimate 3 min per shard, cleanup unknown; no universal 15-min cover claim. Coordinator accepted the mixed sharded/unsharded Linux cover sample. Full verification has not run; Coordinator runs authorized verify all after source clear.

### rev-40 · 2026-11-20T21:15:52.942Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261120-1896-source1
commit: 6bf282d0c526bdff9e46f72bb0afbc3979c1e85d
scope: full
findings: [{"severity":"medium","text":"M2: only green shard groups use structured child validation. A failing child plus a 137/143/notRun child collapses to parent exit1; prefixed tier lines hide the interruption and a failing identity can classify the incomplete group red, allowing culprit drop/diagnosis. Check child interruption/incomplete receipts before red classification; cover mixed groups as inconclusive with no landing or culprit drop.","file":"hub/src/hub/merge-batches.ts","line":113},{"severity":"medium","text":"M3: periodic coverage now hydrates every same-tree sharded batch via #full before eligibility filtering, repeatedly parsing unbounded archived full jobs. Frequency throttling/inflight sharing do not bound per-check work. Checkpoint eligibility in the compact index from loaded settlement receipts; unknown legacy eligibility must stay unknown or use bounded incremental backfill, with hydration work-count controls.","file":"hub/src/hub/suites.ts","line":1551},{"severity":"medium","text":"M1: new tests end separately bounded setup at shardedCover, leaving config/source/manifest writes outside setup and f.jobs/packageShards awaits outside step bounds (also lines48–69). Whole-case ownership does not provide a separate complete setup bound. Enclose all pre-admission setup and independently bound post-admission reads/planning.","file":"hub/test/suite-cover.test.ts","line":26}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear: Standards2medium(M1 setup bounds,M3 history hydration); Spec1medium(M2 mixed incomplete/red classification). Implementer decisionsb3bea50f/d6bd1b60 confirm no omitted guards/bounds. All-green exact count/identity/file-union, light partition and legacy unsharded paths otherwise reviewed. C2 evidence A-22267 independently audited: ten original logs' phase walls/exits and all200slow-file rows/order/sums match. Coordinator5a620505 accepts3sharded+2unsharded Linuxcovers/fiveunshardedbatches. Five-shard10.39–13.84min/$0.2165–0.2883 remains a model,3min parallel setup, collection/capacity/cleanup excluded or unknown; no universal15min or measured improvement claim. C2 established but not marked verified on not-clear pass. Docs/skills/change records and two exact role sentences reviewed. Local fake macOSNode24.21 checks are partial; earlier own clause failure retained, no configuredT2/T3/T4/Web proof yet. Reviewer performed source/Git/streamed-log inspection only, no tests/native/provider/browser. Correct all findings together; fresh source verdict before Coordinator-authorized fullall.

Criteria: C1 failed (Mixed interrupted shard groups can enter red culprit diagnosis; retained-history hydration and complete test setup bounds are unbounded (M1–M3).).

### impl-1896 · 2026-11-20T21:21:20.735Z

Review source1 corrections consumer census: verification-tier-receipts complete checker retained unchanged public signature; new terminal checker shares its ordered supersession parser, consumed by batch-shard-receipts and merge-batches. Other consumers: batch-member-verification, executor/droplet/run writer, dev-t3-coverage, suites, and their verification-tier-receipts/dev-t3/suite-cover/merge-batches tests (all tier searches included). New optional internal batchT3Proof persists in full jobs and existing compact suite-history projection; periodic consumers use it without hydration. Legacy unsharded records retain existing policy; old sharded records without checkpoint remain unknown, no backfill or startup reads. No reply/CLI/help field removed.

### impl-1896 · 2026-11-20T21:23:30.177Z

T-2039 is covered inline under Coordinator decision c997b61e-8797-4e62-8616-f95a1f25d143: shared scriptedMachine.finish retains its supplied numeric code. Exact native-status assertions were red (1 !== 137 and 1 !== 143) before the shared fake correction; callers retain the same API. Include T-2039 in source2 review; Coordinator closes it as covered after T-1896 lands.

### rev-40 · 2026-11-20T21:27:33.512Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1896-source2
commit: 429c10c84ef483f4c8626f2b1ccf3c7fe7e413a0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear: Standards0/Spec0 findings. M1 full setup and later async read/planning bounds resolved. M2 every group uses shared child identity/inventory/terminal receipt checks before diagnosis; mixed red+native137/143/notRun controls retain no landing/drop/probes and exact producer outcomes. Shared complete/terminal checker keeps parser and ordered supersession. T-2039 scripted finish code preservation included under independently confirmed Coordinatorc997b61e, named in notes. M3 producer-derived version/run/head/tree checkpoint persists in compact history; periodic reads no full archive jobs, legacy uncomputed shards stay unknown. Producing fake batch/reopen64groups×1024paths control positively observes read then proves zero read/bytes; missing/foreign checkpoint controls retained. C2 verified using unchanged A-22267/prior ten-log phase and200row audit, Coordinator-accepted mixed cover sample and explicitly bounded projection claims; no measured15min claim. Docs/skills/exact governance changes remain consistent. C1 runtime final pending Coordinator-authorized full verifyall at unchanged head. Selected macOSNode24.21 fake1152T1/181focused passes plus lint/typecheck do not substitute configured/native/T3/T4/Web evidence. Reviewer ran no tests/native/browser.

Criteria: C2 verified.

### rev-40 · 2026-11-20T22:35:53.653Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1896-final
commit: 429c10c84ef483f4c8626f2b1ccf3c7fe7e413a0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, no findings. A-22283/rune474e5e4 binds reviewed head/canonical tree1653aca61af6391e85b09b064f5478a2aaa38b54, independently matches outside excluded tracker/rulebook paths. C1 all12new named base-test finishes positively pass: exact full-group coverage1465; controller0/1/137/143/notRun4647–4667;2/3shard wait/aggregate8671–8690; light partition/Web-Neovim8698; checkpoint/zero archive hydration8710. Existing explicit-shard control1346 passes. Mixed controls exercise exact native outcomes/no landing/drop/probes and authorized inlineT-2039 fix. This is functional fake-executor evidence on Linux, not deployed throughput measurement. T0/T1/T2/T3/Web exit0,9394pass12platform-prerequisite skips0fail/cancel; T4unexecuted. Noncached Linuxx64 c-8ams3 Node24.21.0 Nvim0.12.5; Web Headless Shell1248/CfT156.0.8078.4. Host gate not repeated remotely; budgets/lint report-only, no performance clearance. C2 retains qualified A-22267 ten-run/200row audit: accepted mix, five-shard10.39–13.84min/$0.2165–0.2883 projected with3min setup, unknown cleanup/excluded collection/capacity; no observed15min claim, T-2042 measurement separate. Reviewer ran no tests/native/browser.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T00:09:08.775Z

Merged ecdc13a99587648982cea357ebe19b776740317d onto dev.
