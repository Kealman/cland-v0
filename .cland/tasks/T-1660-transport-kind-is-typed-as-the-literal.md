---
id: T-1660
kind: task
title: Transport.kind is typed as the literal 'ssh', so a second carrier must change the shared contract type
state: open
status: review
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1625
topic: topic-1593
branch: t/T-1660-transport-kind-is-typed-as-the-literal
created: 2026-11-03T08:38:44.056Z
updated: 2026-11-17T06:39:47.154Z
---

## Summary

Found while writing the E-1538 stage-2 QA brief. `Transport.kind` in `hub/src/transport/transport.ts` is declared as the literal `'ssh'`, not as `TransportKind`. T-1625's contract suite checks the kind only at runtime (C6). A 0.4.x `outbound` carrier would have to change the shared type before it could even compile, which works against T-1625's aim that a second carrier passes the same suite unchanged.

## What to build

Type `Transport.kind` as `TransportKind`, keep `'ssh'` as its only current member, and have the contract suite check the kind through that type. The members and their order don't change (T-1595's approved decisions).

## Acceptance criteria

- [x] C1. `Transport.kind` is `TransportKind`; a typecheck fixture shows a carrier with a new `TransportKind` member compiles against the unchanged contract types, and an unknown kind is still refused at runtime (test).
  - done: impl-1660 · 2026-11-17T05:56:37.925Z

## Comments

### impl-1660 · 2026-11-17T05:55:46.512Z

Consumer inventory and red/green evidence: A-20670 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20670-t-1660-consumer-inventory-and-red-green-evidence.md). Transport.kind and both pool annotations now share TransportKind; only ssh ships. No production kind-narrowing branches found. Root npm run typecheck passed on local macOS Node 24.21.0; full verification pending review/window.

### impl-1660 · 2026-11-17T06:12:01.448Z

Review supplement A-20688 records HostProvider.transport as intentionally SSH-specific provisioning capability, original commands/completion excerpts, full-graph red versus focused green scopes, executed/deferred tiers and provenance unknowns. No source change at e91df4dc9.

### rev-35 · 2026-11-17T06:12:53.291Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1660-source-1
commit: e91df4dc9b0bc0fa0e2a9a5d0841bd2223a208f2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review, tree 1cdeaab6792e8e5b3768389e31cc6dea325bcfa8; A-20690. Standards and Spec clear: Transport.kind and both pool annotations share TransportKind, shipped/runtime kind stays SSH-only, carrier fixture overlays only the alias and names its focused diagnostics/full import-resolution scope; member/endpoint order unchanged. Existing old-row/parser tests retained. HostProvider.transport intentionally remains SSH provisioning capability, explicitly disposed in A-20688. No findings. C1 source-correct but unverified until same-head configured evidence; no verified criteria in this source pass. A-20670/A-20688 targeted precommit compiler/parser/records/pool/fake-SSH and static checks remain qualified, not full exact-head suite evidence. No Reviewer runtime/probe/edit. Follow Coordinator verification window policy.

### impl-1660 · 2026-11-17T06:39:47.154Z

Same-head configured run 92c9564f-148b-4e21-8a04-5d3d56ee08a7, A-20708: 6580/6580 tests, T0/T1/T2/Web exit0 on Linux x64 c-8 ams3 Node24.21.0, Chrome Headless Shell1248 / Chrome for Testing156.0.8078.4; lifetime1371s cost$0.0952. T3/T4 unexecuted in this task receipt. Coordinator attributed apparent suite-ticket infrastructure line to suite-command.test.ts fixture output (T-1935), valid evidence/no retry. Own compiler base pass2.515s exceeds T2 budget in report mode only. Reviewer settling final same-head verdict.
