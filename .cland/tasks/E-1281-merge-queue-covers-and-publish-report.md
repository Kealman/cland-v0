---
id: E-1281
kind: epic
title: Merge queue, covers and publish report the truth
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1071
branch: null
created: 2026-10-25T09:52:44.721Z
updated: 2026-10-26T01:39:17.723Z
closed: 2026-10-26T01:39:17.723Z
---

## Summary

Plan stages, cover receipts and periodic runs report the truth: a published task counts as merged, hub-owned runs are attributed to the hub, the culprit search skips regressions dev already fixed, artifact reservations don't race, and scripts-only package.json changes don't demand an install. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1281 · 2026-10-26T01:39:12.152Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1281 · 2026-10-26T01:39:12.152Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58

## Plan

```yaml
stages:
  - name: honest stage and run records
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1276
        - T-1306
      - - T-1218
        - T-521
      - - T-1244
      - - T-1251
  - name: covers across restarts
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1029
```

## Comments

### qa-677 · 2026-10-26T01:39:12.152Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-26-677-1281
commit: 9d60746bcbbb57098ff2da2cab2940329b0acd58
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
|---|---|---|---|
| C1 | hub-api | PASS | A-12227: seven closed/merged children; clear hub review and green same-head native verify at each landing; Item/Reviewed-by/ancestry audited. T-1218 blank-line-only landing difference retained. |
| C2a | hub-api | PASS | Both stages closed; QA scope none. Linux 59c74afd/A-12220 and macOS e130305d/A-12224 green at e090007b811ef4609d490207b55955e0adcfc1e8, containing every child landing. |
| C2b | hub-api | PASS | 16 listed files, 275 named passing cases per platform, no scoped skips/failures; all 13 child criteria mapped including docs and qualified historical T-1306 5/5/negative-control evidence. |

No findings. Record audit only; no new tests, browser, harness or demo lease. Freshness current:true at the full tested SHA. T-521 latest verify 55b87b2c remains failed (roles-timing 0 !== 300); landing green 6e780a7b at the same source head and exact failing-name passes in both current covers are retained separately.

Cover native totals Linux 4808 pass/9 skip; macOS 4816 pass/1 skip, 0 failures each, 4817 tests each. Hostcheck, T1–T4 base and Web completed; T4 repetitions skipped, budgets/ratchet report-only. Linux x64 droplet: Chrome Headless Shell 156.0.8078.4, shard lifetimes 1513.573/1292.277 s, cost ~$0.1949. macOS arm64 local: exact browser binary/version absent from retained log, no cost. Audit local record reads, no runtime measurement. Full provenance, named receipts and recorder rows: A-12227 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12227-e-1281-dod-qa-clear-record-audit-at-9d60746b/report.md.

Criteria: C1 verified, C2 verified.
