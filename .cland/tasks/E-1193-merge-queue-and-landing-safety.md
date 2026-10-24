---
id: E-1193
kind: epic
title: Merge queue and landing safety
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-996
branch: null
created: 2026-10-24T06:45:43.386Z
updated: 2026-10-24T20:56:17.901Z
closed: 2026-10-24T20:56:17.901Z
---

## Summary

The merge queue covers what it lands and never drops a ready member by mistake: batches run T0 and, when they touch web/, the Web tier; the false 'task branch changed' drop is gone; dependency merges and worktrees resolve the right node_modules; a candidate touching an epic under demo warns.

## Goal

The merge queue covers what it lands and never drops a ready member by mistake: batches run T0 and, when they touch web/, the Web tier; the false 'task branch changed' drop is gone; dependency merges and worktrees resolve the right node_modules; a candidate touching an epic under demo warns.

## Why

T-1018, then N5, each caused a red dev in v0.2; T-1184 cost a batch cover. Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T20:56:13.128Z · commit fdcea0b958178e2b34c69b5f19fc22dbe8da1626
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T20:56:13.128Z · commit fdcea0b958178e2b34c69b5f19fc22dbe8da1626

## Plan

```yaml
stages:
  - name: batch coverage and the false drop
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1018
        - T-1202
      - - T-1184
      - - T-542
  - name: demo-freshness warning
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1207
      - - T-1213
        - T-1232
```

## Comments

### qa-676 · 2026-10-24T20:56:13.128Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-24-1
commit: fdcea0b958178e2b34c69b5f19fc22dbe8da1626
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Result | Evidence |
|---|---|---|
| C1 child receipts | PASS | All children merged; clear review and green verify share exact full head; raw receipt Head/Finished checked. |
| C2 behaviour | PASS | Named test identities and source assertions mapped to every child criterion in Linux and macOS current covers. |
| C2 docs/receipts | PASS | Detailed table and scope limits in artifact. |
| Freshness | PASS | demo status at tested SHA current:true immediately before verdict. |

No findings. C1,C2 verified. Seven children T-1018,T-1202,T-1184,T-542,T-1207,T-1213,T-1232. Each child criterion has exact generated passing names on both platforms (table and native finish rows): T0/Web bisection and duration reports; unchanged-head FIFO versus actual head movement; dependency install notices/host diagnostic/worktree links; active and due demo overlap warnings; dirty-root retry versus nonrecoverable hold; report-failure containment/continued serving. Timer audit A-10994 is source-only where unchanged paths were not fault-injected. Docs and actual assertions inspected.

Evidence A-11415: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11415-e-1193-dod-at-fdcea0b9-child-receipts-and-named-tests-on-both-platforms/report.md. Read-only local macOS evidence check; no new test, browser, suite or demo lease. Existing stage pair reused per Coordinator light brief: Linux14d0d24a A-11401 and macOS9c0ab09c A-11393 at tested SHA, Finished exit0, T0,T1–T4/Web completed; T4 repetitions not run. Linux x64 droplet4400pass9skip; macOS arm644409pass0skip. Web harness pinned Chrome Headless Shell. Budgets/lint/ratchet report-only, not enforce-mode success. A-11402/A-11403 shard logs; machines cland-v0-c3d2e996/cland-v0-5e4f53ab, lifetimes1361/1110s,cost$0.0945/$0.0771,total wall1419.25s including collection,total$0.1716. No projected time treated as actual wall.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T20:56:17.901Z

Closed on qa-676's clear DoD verdict qa-dod-2026-10-24-1 at fdcea0b9: all seven child reviews match their green same-head receipts, 25 test/criterion mappings per platform in the stage covers (Linux 14d0d24a, macOS 9c0ab09c), freshness current.
