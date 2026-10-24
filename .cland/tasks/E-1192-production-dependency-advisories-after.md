---
id: E-1192
kind: epic
title: Production dependency advisories after v0.2.0
state: closed
criterion_seq: 1
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-995
branch: null
created: 2026-10-24T06:30:56.698Z
updated: 2026-10-24T20:54:40.906Z
closed: 2026-10-24T20:54:40.906Z
---

## Summary

Production dependency advisories reported by `npm audit --omit=dev` after v0.2.0 are fixed: zod 4.5.4 pinned in `hub/package.json` (high, GHSA-mrhx-c7xc-m3w5) and ip-address 10.7.3 (moderate). The human approved the update on 2026-10-24 06:30Z.

## Goal

Production dependencies carry no known high or moderate advisory, with the suite green.

## Definition of done

- [ ] C1. `npm audit --omit=dev` reports no high or moderate advisory on dev, and a full integrated suite with the Web phase is green on Linux and macOS at that commit.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-2 · 2026-10-24T20:54:34.169Z · commit fdcea0b958178e2b34c69b5f19fc22dbe8da1626

## Plan

```yaml
stages:
  - name: dependency advisories
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1189
  - name: site advisory
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1238
```

## Comments

### qa-676 · 2026-10-24T20:54:34.169Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-24-2
commit: fdcea0b958178e2b34c69b5f19fc22dbe8da1626
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Result | Evidence |
|---|---|---|
| Root production audit | PASS | npm audit --omit=dev --json exit0, all vulnerability counts0. |
| Site production audit | PASS | Same command in independent site/ lockfile subtree, exit0, all counts0. |
| Child receipts | PASS | T-1189/T-1238 merged; latest clear reviews match passed same-head verify and raw Head/Finished receipts. |
| Integrated covers | PASS | Linux14d0d24a A-11401, macOS9c0ab09c A-11393 at exact tested SHA, Finished exit0. |
| Freshness | PASS | demo status current:true. |

No findings. C1 verified. A-11410: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11410-e-1192-at-fdcea0b9-root-and-site-audits-clean-paired-covers/report.md. Fresh macOS arm64 isolated audits; root and site are the only lockfile subtrees, web uses root. site pins expressive-code0.44.3 and selector-parser7.1.6. Earlier moderate findings remain historical; no QA dependency changes.

Coordinator-authorized light check reused existing covers, no new suite or lease. Linux x64 droplet4400pass9skip; macOS arm644409pass0skip. T0,T1–T4/Web completed, T4 repetitions not run, budgets/lint/ratchet report-only. Web uses pinned Chrome Headless Shell; no real browser here. Shard logs A-11402/A-11403, machines cland-v0-c3d2e996/cland-v0-5e4f53ab, lifetimes1361/1110s,$0.0945/$0.0771; overall wall1419.25s,$0.1716. Exact child receipt and audit JSONs retained; site build/browser child evidence was read, not rerun.

Criteria: C1 verified.

### coord · 2026-10-24T20:54:40.906Z

Closed on qa-676's clear DoD verdict qa-dod-2026-10-24-2 at fdcea0b9 (A-11410): root and site/ production audits are clean, child receipts and both stage covers (Linux 14d0d24a, macOS 9c0ab09c) confirmed, freshness current.
