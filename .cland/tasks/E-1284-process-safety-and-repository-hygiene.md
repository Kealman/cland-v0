---
id: E-1284
kind: epic
title: Process safety and repository hygiene
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1073
branch: null
created: 2026-10-25T09:52:51.686Z
updated: 2026-10-26T01:47:39.332Z
closed: 2026-10-26T01:47:39.332Z
---

## Summary

cland never signals a stranger's process, stops promptly during droplet reservation waits, keeps the repository's unreachable Git objects bounded without unsafe pruning, and caps local MCP input before parsing. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1284 · 2026-10-26T01:47:33.009Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1284 · 2026-10-26T01:47:33.009Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58

## Plan

```yaml
stages:
  - name: process identity, stop and hygiene
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-543
        - T-1154
        - T-1298
      - - T-1217
      - - T-1208
      - - T-1318
```

## Comments

### qa-677 · 2026-10-26T01:47:33.009Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-26-677-1284
commit: 9d60746bcbbb57098ff2da2cab2940329b0acd58
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
|---|---|---|---|
| C1 | hub-api | PASS | A-12229: six closed/merged children, clear hub Reviewer verdicts, green same-head native verifies before landing, matching source deltas/trailers/ancestry. T-1208 later red retained separately. |
| C2a | hub-api | PASS | Single stage closed, QA scope none. Linux 59c74afd/A-12220 and macOS e130305d/A-12224 green at e090007b811ef4609d490207b55955e0adcfc1e8 contain every landing. |
| C2b | hub-api | PASS | 22 listed files / 374 named cases each: 373 pass and one complementary platform skip per cover; all 10 child criteria mapped. Earlier macOS A-12206 has five load gate failure lines; current A-12224 has none and a reasoned Linux-only skip. Passing real-runner control proves 5/5 skipped, never passed. |

No findings. T-1208 latest verify 584b05c4 remains failed (missing protocol-frame module, roles-timing 0 != 300, invalid loadGuards). Landing green 7475f8a3 at same 33d24def source head and exact three-name passes in both current covers are retained. Earlier red eb2ca0d8 is not closure evidence; current pair is. Skip-reason lint is report-only. Freshness current:true at full tested SHA.

Record reading only: no new test, stress, browser, harness or demo lease. Both covers completed hostcheck/T1–T4 base/Web; outer T4 repetitions skipped, budgets/ratchet report-only. Whole-cover native totals Linux 4808 pass/9 skip and macOS 4816 pass/1 skip, no failures. Linux x64 droplets, Headless Shell 156.0.8078.4; shard lifetimes 1513.573/1292.277s, total ~$0.1949, not test wall. Local macOS arm64 exact browser binary/version absent from retained log; no droplet cost. Full durable report and receipts: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12229-e-1284-dod-qa-clear-record-audit-at-9d60746b/report.md.

Criteria: C1 verified, C2 verified.
