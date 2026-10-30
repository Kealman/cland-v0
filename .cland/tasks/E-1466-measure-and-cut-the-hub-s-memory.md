---
id: E-1466
kind: epic
title: Measure and cut the hub's memory footprint
state: open
criterion_seq: 3
labels: []
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: null
created: 2026-10-30T06:38:36.448Z
updated: 2026-10-30T22:54:19.893Z
---

## Goal

The hub's resident memory on this project drops from about 3 GB to a measured budget that suits a consumer machine running two or three projects, with a test that holds it there.

## Contents

1. Measure where the memory goes, at startup and at rest, on a scratch copy of this project's live data: heap by retainer, external buffers, SQLite and native memory.
2. Fix the largest holders found. The fix tickets are cut from the measurement's findings.
3. Add a memory budget check, in report mode first per rule 27, on a copy of live-scale data.

## Definition of done

- [ ] C1. A measurement artifact names the top retainers of the hub's heap and its non-heap memory at startup and at rest on a scratch copy of the live project, with sizes and code paths.
  - verified: qa-677 [qa] · run qa-2026-10-30-677-1466 · 2026-10-30T22:54:19.892Z · commit 3cc3d62e8ed9c8142938e6746fa693453d304aa6
- [ ] C2. The hub's RSS at rest on the same scratch copy falls to the budget agreed with the human after the measurement, shown before and after on the same machine.
  - verified: qa-677 [qa] · run qa-2026-10-30-677-1466 · 2026-10-30T22:54:19.892Z · commit 3cc3d62e8ed9c8142938e6746fa693453d304aa6
- [ ] C3. A memory budget test runs on live-scale fixture data and reports the hub's heap and RSS at startup and at rest against the budget.
  - verified: qa-677 [qa] · run qa-2026-10-30-677-1466 · 2026-10-30T22:54:19.893Z · commit 3cc3d62e8ed9c8142938e6746fa693453d304aa6

## Plan

```yaml
stages:
  - name: measure and startup fixes
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1467
      - - T-1476
      - - T-1477
  - name: at-rest growth and budget
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1478
```

## Comments

### qa-677 · 2026-10-30T22:54:19.893Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-2026-10-30-677-1466
commit: 3cc3d62e8ed9c8142938e6746fa693453d304aa6
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M1 / C1 | hub-api | PASS | A-14729/M1-artifacts.md; A-14160/14157/14167/14226/14701/14690 audited |
| M2 / C2 | hub-api | PASS with comparison limitation | A-14729/M2-audit.log; original A-14699 numerical audit exit0 |
| M3 / C3 | hub-api | PASS | A-14729/M3-tests.log and M3-required-cases.json:57/57,0 fail/cancel/skip; ten required identities executed |
| M4 / C3 | hub-api | PASS | A-14729/M4-summary.json and original numeric/native receipts |
| M5 | hub-api | PASS under Coordinator amendments | A-14729/M5-audit.json, M5-hub.json, M5-landings.log |

No high/medium/low product findings in amended scope. C1,C2,C3 established. Artifact A-14729, durable entry /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14729-e-1466-definition-of-done-qa-evidence-run-qa-2026-10-30-677-1466-at-3cc3d62e8-cl/report.md;43 declared hashes independently match the published copy.

Actual QA execution: local macOS arm64 Nodev24.21.0, clean detached 3cc3d62e8ed9c8142938e6746fa693453d304aa6; read-only Python original-record audit, one targeted T3 file node --test hub/test/measure-memory.test.ts, dry inventory and one granted600s live-scale scratch-copy probe. No full suite, browser, droplet lease/cost, native real harness, pre-fix rerun or live-hub memory probe. No enforced memory gate.

M4: grant b70f13a2 22:37–22:58Z; native close22:47:45.356Z code0/signalnull, worker complete/stoppedtrue, no forced/incomplete/write failures.62 rest samples span600.571234s. Readiness heap153.022560/RSS575.750000MiB; rest129.185318/562.531250MiB, all within report-only256/768MiB. Immutable live endpoint equals report bytes. Observed intermediate rest maximum heap294.316017/RSS653.125MiB remains explicit: endpoint budget success is not continuous heap-under256 proof. Native pressure always1, unchanged swap-outs80848688, max observed load2.241699. Other local jobs held; live hub streamed T-1473 remote logs. Slot released. Automatic exit profile diagnostic “V8 sampling heap profiler was not started” retained separately from present required numeric/boundary receipts.

C1 limits: coarse1MiB sampled surviving allocations are attribution estimates, not retained sizes; native SQLite allocation remains explicitly unknown. No universal leak exclusion; positive historical RSS/footprint slopes retained.

C2 limitation: original after aa8e5ecdf endpoint99.482605MiB heap/549.140625MiB RSS is under256/768; audit reproduces182samples and slopes. Before c8defa34d3833.65/1633.4MiB is STARTUP readiness, with intermediate c51f9984b1009.79/525.27MiB. Same Mac, fresh snapshots, not byte-identical data or same-probe at-rest before. No controlled at-rest before/after or fixed-leak claim. Accepted exactly under the brief's explicit limitation.

M5: all5 children closed/done and Item trailers on pinned dev. Four have same-source-head clear review plus passed verify. T-1478 final0c2236271 is waiver-qualified: parent aa8e5ecdf green6946de51/A-14709; final28 targeted receipts337passes/A-14714 and clear deltaA-14715. No final-head full verify claimed. Original Linux skips remain separately listed, not passes. Decisions b70f13a2/72cd395e amend brief: both stages OPEN, covers pending and Coordinator-owned; not a C1–C3 failure. No stage closure or integrated stage/release pass claimed.

Final demo status freshness.current=true, state none. Artifact publication in Agents was refused to QA; action stopped, Coordinator published A-14729 with its authority. Five QA ledger rows recorded. Hold/worktree cleanup follows this verdict.

Criteria: C1 verified, C2 verified, C3 verified.
