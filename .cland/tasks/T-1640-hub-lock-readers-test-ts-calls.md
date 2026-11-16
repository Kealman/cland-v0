---
id: T-1640
kind: task
title: hub-lock-readers.test.ts calls lockHostIdentity directly and spawns sysctl on macOS
state: open
status: ready
size: XS
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
regression_of: T-1617
topic: topic-1560
branch: t/T-1640-hub-lock-readers-test-ts-calls
created: 2026-11-02T19:53:37.392Z
updated: 2026-11-16T16:49:53.530Z
---

## Summary

`hub/test/hub-lock-readers.test.ts`, from T-1617, calls `lockHostIdentity` directly in its fixture. On Darwin that runs `sysctl` through `execFileSync`, which a T2 file isn't expected to do, and every run emits report-only tier mismatches. The 14 tests pass. T-1639 added `fixtureLockIdentity`, captured once by the suite runner as `CLAND_TEST_LOCK_IDENTITY`.

## Acceptance criteria

- [x] C1. `hub-lock-readers.test.ts` takes its native identity from `fixtureLockIdentity`, and a macOS suite run of it reports no `child_process` tier mismatch originating in the test file's own fixture; mismatches from production readers (inspect/readForeignHolder, migrateOffline) are recorded raw and left to T-1917 (test).
  - done: impl-1640 · 2026-11-16T16:23:21.369Z
  - verified: rev-35 [reviewer] · run rev-35-1640-final-1 · 2026-11-16T16:49:52.939Z · commit 075dde953ec276244c968e3f8d3e6715a7401ba5
- [x] C2. Its assertions are unchanged and all its tests pass.
  - done: impl-1640 · 2026-11-16T16:24:20.436Z
  - verified: rev-35 [reviewer] · run rev-35-1640-final-1 · 2026-11-16T16:49:52.939Z · commit 075dde953ec276244c968e3f8d3e6715a7401ba5

## Comments

### impl-1640 · 2026-11-16T16:18:07.403Z

Baseline at 9859c068 on macOS arm64, Node 24.21.0, local targeted suite runner: 14/14 tests pass; report-only child_process.execFileSync tier mismatches originate in fixture lockHostIdentity. Minimal import/call substitution implemented with assertions unchanged; second run 14/14 passes but production CLI/migration native probes still emit mismatches. Scope clarification requested from lead in topic-1560 before claiming C1.

### rev-35 · 2026-11-16T16:28:31.898Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1640-source-1
commit: 075dde953ec276244c968e3f8d3e6715a7401ba5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full one-file source clear A-20257. Shared fixtureLockIdentity under sealed environment replaces direct native fixture call; all assertions unchanged, no production/test-support/tier/lifecycle change. Coordinator82b85de1 C1 narrowing/T-1917 separation honored. Independently checked A-20240/41 same14 positive named cases+file; baseline15 mismatch rows includes14 fixture origins, candidate12 production rows/zero fixture origins, report-only not native-free tier. Original argv/cwd/tool native exit0 and precommit linkage retained in A-20257 from d4b99043; no historical candidate hash/signal/log hash/suite head attestation. A-20244/45 output and report-only lint/prerequisite limits retained. C1/C2 done/unverified pending configured same-head result. Hold released; mode-free verify at exact075dde953 in Coordinator window may proceed; no Reviewer runtime or final landing claim.

### rev-35 · 2026-11-16T16:49:52.939Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1640-final-1
commit: 075dde953ec276244c968e3f8d3e6715a7401ba5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear A-20294 with A-20293 full992manifest ledger. All14 required ordinary named lock-reader cases/file positive in A-20280; assertions unchanged. C1 narrowed fixture-origin proof combines qualified MacA-20240/41 candidate14→0 mismatch origins/native0/recorded edit-to-commit chronology with exact-head Linux selected compatibility; after12production rows remain rawT-1917, no newfullMac/enforce/native-free-file claim. Independent1764ordinary tests/226files, separate210load passes/files, nofail/cancel/skip. T0/all224T1/selected1T2/Websmoke1 executed;426otherT2/269T3/17T4/54Web unexecuted. Exact provenance11401 norm4eb4de9e Linuxx64Node24.21Nvim0.12.5uncached; actualbrowser11293 isolated1248/CfT156.0.8078.4. Source clean unchanged; static/provenance/hash/signal/report-mode limits retained. C1/C2verified, hold released; Coordinator owns readiness/enqueue/landing. No Reviewer runtime or extra run requested.

Criteria: C1 verified, C2 verified.
