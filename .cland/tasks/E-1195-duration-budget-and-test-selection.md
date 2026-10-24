---
id: E-1195
kind: epic
title: Duration budget and test selection
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-997
branch: null
created: 2026-10-24T06:45:43.660Z
updated: 2026-10-24T20:56:18.959Z
closed: 2026-10-24T20:56:18.959Z
---

## Summary

Duration budgets stop surprising the crew: expiring allowances warn 48 h ahead, a task's own verify measures new T3/T4 identities and prints an allowance stanza, the 20,000-line proof fits its budget, and shared read-path changes select their T4 load files.

## Goal

Duration budgets stop surprising the crew: expiring allowances warn 48 h ahead, a task's own verify measures new T3/T4 identities and prints an allowance stanza, the 20,000-line proof fits its budget, and shared read-path changes select their T4 load files.

## Why

Allowance expiry broke T3 at midnight 2026-10-24; T-1165 and T-1179 cost cover pairs on new identities. Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-2 · 2026-10-24T20:56:13.300Z · commit fdcea0b958178e2b34c69b5f19fc22dbe8da1626
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-2 · 2026-10-24T20:56:13.300Z · commit fdcea0b958178e2b34c69b5f19fc22dbe8da1626

## Plan

```yaml
stages:
  - name: allowances and selection
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1190
        - T-1198
        - T-1026
      - - T-1203
```

## Comments

### qa-676 · 2026-10-24T20:56:13.300Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-24-2
commit: fdcea0b958178e2b34c69b5f19fc22dbe8da1626
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Result | Evidence |
|---|---|---|
| C1 child receipts | PASS | All children merged; clear review and green verify share exact full head; raw receipt Head/Finished checked. |
| C2 behaviour | PASS | Named test identities and source assertions mapped to every child criterion in Linux and macOS current covers. |
| C2 docs/receipts | PASS | Detailed table and scope limits in artifact. |
| Freshness | PASS | demo status at tested SHA current:true immediately before verdict. |

No findings. C1,C2 verified. Four children T-1190,T-1198,T-1026,T-1203; retained child extracts explicitly reused. Exact-S named tests on both platforms prove 48h heartbeat/report warnings, every expired allowance, selected T3/T4 once and80%/1.5x stanza, mapped T4 guards, and20,000-line deterministic proof. Current proof2.177524211s Linux/.730386709s macOS under criterion5s; generic2s warning remains report-only. Task Linux1.787936153s and5 local samples in A-10608/A-10627 retained, clustered workload scope A-10609; no fully-rich benchmark claim. Current docs and removed T-1003 allowance inspected; old-host task receipt does not claim T3/T4 execution.

Evidence A-11416: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11416-e-1195-dod-at-fdcea0b9-child-receipts-and-named-tests-on-both-platforms/report.md. Read-only local macOS evidence check; no new test, browser, suite or demo lease. Existing stage pair reused per Coordinator light brief: Linux14d0d24a A-11401 and macOS9c0ab09c A-11393 at tested SHA, Finished exit0, T0,T1–T4/Web completed; T4 repetitions not run. Linux x64 droplet4400pass9skip; macOS arm644409pass0skip. Web harness pinned Chrome Headless Shell. Budgets/lint/ratchet report-only, not enforce-mode success. A-11402/A-11403 shard logs; machines cland-v0-c3d2e996/cland-v0-5e4f53ab, lifetimes1361/1110s,cost$0.0945/$0.0771,total wall1419.25s including collection,total$0.1716. No projected time treated as actual wall.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T20:56:18.959Z

Closed on qa-676's clear DoD verdict qa-dod-2026-10-24-2 at fdcea0b9: child receipts and named behaviour tests in the stage covers (Linux 14d0d24a, macOS 9c0ab09c), freshness current.
