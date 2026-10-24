---
id: E-1194
kind: epic
title: Periodic dev T3 and executor honesty
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-1006
branch: null
created: 2026-10-24T06:45:43.538Z
updated: 2026-10-24T21:09:38.896Z
closed: 2026-10-24T21:09:38.896Z
---

## Summary

Periodic dev T3 and the executor report what really ran: a bundling or capacity failure reads as infrastructure, not a culprit; the culprit search handles Web files and boundaries; tests never write the real executor ledger; demo status agrees with exec; a cancelled local run cannot wedge admission.

## Goal

Periodic dev T3 and the executor report what really ran: a bundling or capacity failure reads as infrastructure, not a culprit; the culprit search handles Web files and boundaries; tests never write the real executor ledger; demo status agrees with exec; a cancelled local run cannot wedge admission.

## Why

Several v0.2 periodic runs were red or inconclusive for infrastructure reasons. Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T21:09:26.002Z · commit 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T21:09:26.002Z · commit 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde

## Plan

```yaml
stages:
  - name: honest periodic and executor reports
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1015
        - T-1144
      - - T-422
      - - T-1148
        - T-444
      - - T-1227
      - - T-1228
  - name: culprit search, demo states and local admission
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1098
        - T-976
      - - T-1086
      - - T-511
      - - T-1211
```

## Comments

### qa-676 · 2026-10-24T21:09:26.002Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-24-1
commit: 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Result | Evidence |
|---|---|---|
| CHILDREN / C1 | PASS | All 12 children landed; latest clear review equals green same-head verify; raw log Head and exit checked. |
| BEHAVIOUR / C2 | PASS | 40 criterion/test mappings, each ordinary named PASS in both last-landing covers; 80 matches with file and native log line in A-11449. Includes detached-child cancellation, recovery safety and real CLI blocked-reason tests. |
| COVERS / C2 | PASS | Stage 1 at 956624130bbc3ba3ab80ade149a40c0b2c481cab: 001d0718 A-10848 / 328a44b8 A-10857. Last landing at fdcea0b958178e2b34c69b5f19fc22dbe8da1626: 14d0d24a A-11401 / 9c0ab09c A-11393. All exit 0. |
| SOURCE | PASS | Requested SHA includes later OpenCode and duration/reownership changes; relevant test diff empty. Historical runtime heads remain labelled, not claimed as new runs at 5205aeb6. |
| FRESHNESS | PASS | cland demo status E-1194 --commit 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde --json immediately before verdict: current true. |

Findings: none. Light check authorized by request 154ab76a; no new tests, suite or demo lease. Linux droplet x64 and local macOS arm64 receipts include check/T1–T4/Web; T4 base ran, repetitions skipped. Budgets/lint/ratchet report-only. Web is pinned Chrome Headless Shell, not a human-browser check. Last pair: Linux 4400 pass/9 skipped; macOS 4409 pass. Linux actual walls/costs: stage 1 1397.70s/$0.1797; stage 2 1419.25s/$0.1716. Per-shard machines/lifetimes/costs and logs A-10849/A-10850/A-11402/A-11403 are named in A-11449; projections are not walls.

Scope qualifications: T-1227 C2 uses the retained source audit A-10760/A-10766/A-10793; deliberate file-preservation assertions remain and are distinguished from brittle schema comparisons. T-422 C1 combines named scratch-ledger preservation tests with the Coordinator-owned full macOS cover's real-HOME before/after count receipt (1158/1158 in each ledger, no root entry). Counts are not a byte-for-byte/key-set claim; no real-HOME ledger was read here.

Evidence A-11449: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11449-e-1194-light-dod-at-5205aeb6-12-receipts-and-40-named-test-mappings-on-both-plat/report.md. Verified C1,C2.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T21:09:38.896Z

Closed on qa-676's clear DoD verdict qa-dod-2026-10-24-1 at 5205aeb6 (A-11449): all 12 child review and verify heads match, and 40 criterion/test mappings pass on both last-landing covers (Linux 14d0d24a, macOS 9c0ab09c). Freshness was current; the five duration allowances were re-owned to E-880 in c6bc05cd before the demo SHA.
