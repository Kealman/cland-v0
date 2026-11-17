---
id: T-1660
kind: task
title: Transport.kind is typed as the literal 'ssh', so a second carrier must change the shared contract type
state: closed
status: done
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
updated: 2026-11-17T08:45:38.381Z
closed: 2026-11-17T07:36:16.890Z
---

## Summary

Found while writing the E-1538 stage-2 QA brief. `Transport.kind` in `hub/src/transport/transport.ts` is declared as the literal `'ssh'`, not as `TransportKind`. T-1625's contract suite checks the kind only at runtime (C6). A 0.4.x `outbound` carrier would have to change the shared type before it could even compile, which works against T-1625's aim that a second carrier passes the same suite unchanged.

## What to build

Type `Transport.kind` as `TransportKind`, keep `'ssh'` as its only current member, and have the contract suite check the kind through that type. The members and their order don't change (T-1595's approved decisions).

## Acceptance criteria

- [x] C1. `Transport.kind` is `TransportKind`; a typecheck fixture shows a carrier with a new `TransportKind` member compiles against the unchanged contract types, and an unknown kind is still refused at runtime (test).
  - done: impl-1660 · 2026-11-17T05:56:37.925Z
  - verified: rev-35 [reviewer] · run rev-35-1660-final-1 · 2026-11-17T06:44:31.669Z · commit e91df4dc9b0bc0fa0e2a9a5d0841bd2223a208f2

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

### impl-1660 · 2026-11-17T06:40:42.989Z

Report-only T2 budget overrun accepted by Coordinator under rule27: transport-kind-types.test.ts::a new transport kind compiles against the unchanged carrier contract passed locally in 1.714s and on the Linux droplet in 2.515s against the T2 per-test budget of 2s; five load repetitions were also recorded in A-20708. These are distinct execution observations, not a controlled timing comparison. No head change or retry required. Before T2 budgets switch to enforce, consider this case for T3 or a bounded allowance.

### rev-35 · 2026-11-17T06:44:31.669Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1660-final-1
commit: e91df4dc9b0bc0fa0e2a9a5d0841bd2223a208f2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head final clear; A-20716 reconciles A-20708/run92c9564f with source A-20690. Exact head/source tree unchanged, normalized tree b666b88ae9e86c4a1362b1138717388f10897f06; uncached Linux x64 droplet/Node24.21.0, actual isolated Headless Shell1248/Chrome for Testing156.0.8078.4. Compiler case ordinary pass+5/5 load proof, parser unknown-kind and exact old-row records controls pass. T0/T1/all-T2/Web exit0;6580 ordinary passes/708 files, separate255 load passes;224T1/429T2/55Web complete;269T3/17T4 unexecuted. Ticket-loss line28547 is fake fixture output; terminal exit0/hub passed, Coordinator0d5f3c7c accepts/no retry, reporting bug T-1935. Required advisory record: remote compiler2.515s versus T2 budget2s, local scoped candidate1.714s; report-only, not a controlled timing comparison. Coordinator4171bc86 accepts current head under rule27. Lint122/59/budgets/ratchet/skip checks stay report-only. C1 verified; no findings/new Reviewer runtime/edit.

Criteria: C1 verified.

### coord · 2026-11-17T07:36:16.890Z

Merged e248bca68b44d9fb9aa00d069be61e89c2885875 onto dev.

### coord · 2026-11-17T08:45:38.381Z

Post-landing regression (coord, 08:45Z). Periodic dev T3 557d7a51 at ca6c62808 (A-20788) failed only the enforced new-identity budget for this item's compiler case: 11.816 s against 5 s, Linux c-8 nyc1, full T2 under load. The item's own verify measured 2.515 s, and the report-only T2 per-test budget note on this item had already flagged it as a T3 candidate. Fix forward: a dated allowance (17.8 s, C-216, expiring 2026-11-24), committed once batch 804e24d0 lands, plus T-1939 to move the case to T3.
