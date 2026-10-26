---
id: E-1282
kind: epic
title: Test reliability and harness
state: closed
criterion_seq: 2
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1072
branch: null
created: 2026-10-25T09:52:46.898Z
updated: 2026-10-26T01:43:36.238Z
closed: 2026-10-26T01:43:36.238Z
---

## Summary

No flake or harness defect from 2026-10-20 to 2026-10-24 stays open: load-sensitive component tests, fixture leaks, the frame recorder, the harness frame readers and the rule 15 sealing gaps. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1282 · 2026-10-26T01:43:30.150Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1282 · 2026-10-26T01:43:30.150Z · commit 9d60746bcbbb57098ff2da2cab2940329b0acd58

## Plan

```yaml
stages:
  - name: load-sensitive tests and sealing
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1028
        - T-1036
      - - T-1259
      - - T-1041
      - - T-1233
        - T-1237
        - T-1285
      - - T-1299
      - - T-1301
  - name: runner and frame tooling
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-450
        - T-1250
      - - T-1024
```

## Comments

### qa-677 · 2026-10-26T01:43:30.150Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-26-677-1282
commit: 9d60746bcbbb57098ff2da2cab2940329b0acd58
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
|---|---|---|---|
| C1 | hub-api | PASS | A-12228: twelve closed/merged children, clear hub Reviewer verdicts, green same-head native verifies, matching source/landing deltas, trailers and ancestry. |
| C2a | hub-api | PASS | Both stages closed with QA scope none. Last Linux 59c74afd/A-12220 and macOS e130305d/A-12224 green at e090007b811ef4609d490207b55955e0adcfc1e8 contain every landing. |
| C2b | hub-api | PASS | 17 files / 330 generated cases: Linux 327 pass and 3 macOS sandbox skips; macOS 330 pass. All 20 child criteria mapped, including native 20/20 launcher, 20 sequential explorer, 10/10 macOS CPU-load receipts, T0 controls and five raw 11-pass hung-runner file logs. |

No findings. Historical T-450 repetitions retain 5b040a06→a07f5563 mixed-commit/identical-blob attribution; they are not relabelled final-head runs. T-1285 red control is retained historical summary evidence, not raw command output. Exact names, positive controls, source and capture limitations are in A-12228. Freshness current:true at full tested SHA; no new tests, stress, browser, harness or demo lease.

Both covers completed hostcheck/T1–T4 base/Web; outer T4 repetitions skipped, budgets and T3 ratchet report-only. Whole-cover native totals Linux 4808 pass/9 skip and macOS 4816 pass/1 skip, no failures. Linux x64 droplets: Headless Shell 156.0.8078.4; shard lifetimes 1513.573/1292.277s, total ~$0.1949 (not test wall). Local macOS arm64: exact browser binary/version not printed, no droplet cost. Audit local record reads only. Durable evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12228-e-1282-dod-qa-clear-record-audit-at-9d60746b/report.md.

Criteria: C1 verified, C2 verified.
