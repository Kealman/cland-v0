---
id: E-1212
kind: epic
title: Rendered Mermaid diagrams in the web workbench
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-959
branch: null
created: 2026-10-24T08:51:28.710Z
updated: 2026-10-24T11:52:23.187Z
---

## Goal

A Mermaid `.mmd` diagram artifact opens rendered in the web Artifacts area, with its source one key away. The human approved a new client-side dependency, `mermaid`, for this (option a on T-1158, General 2026-10-24 08:51Z, answer to ask 7efa7a2e).

## Definition of done

- [ ] C1. A `.mmd` artifact opens rendered in the sandboxed viewer and its source stays available, shown in a Web test.

## Plan

```yaml
stages:
  - name: mermaid rendering
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1158
```

## Comments

### qa-676 · 2026-10-24T11:52:23.187Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-24-2
commit: ad611df95d015191b8b8af11fd7aa81bcd599b6d
stage: mermaid rendering
stage_hash: e70ed65f2aa74aec306a92e3ac20c5a0d630e82f1b4a8c53cf5fcb837f8259bd
findings: [{"severity":"low","text":"S0's copied shell filter omits inherited GIT_* isolation. Coordinator c54a8975 and request 5f87c820 authorized shared fixtureEnvironment plus scratchGitEnvironment; helper and key-only census retained, zero forbidden keys. Brief correction only, no product failure.","file":"qa/briefs/E-1212-stage-1.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Result | Observation |
|---|---|---|
| S0 | PASS | Clean detached HEAD=dev, T-1158 landed; authorized sealed fixture environment. |
| M1 | PASS | 2/2 named Mermaid render/security/source tests, no skips. |
| M2 | PASS | 12/12 artifact Web tests, no skips; fixture censuses after 0. |
| M3 | PASS | 7/7 capability-route tests, no skips. |
| M4 | PASS | Build and size assertion exit 0: 455894 bytes, +571 vs 455323 baseline, limit 1024. |
| M5 | PASS | Mermaid pinned only in web at 12.2.0; installed version matches. |
| M6 | PASS | Production npm audit exit 0; all vulnerability counts 0. |
| M7 | PASS | README route and strict security documented. |
| M8 | PASS | Typecheck, colours/contrast, HTML and hooks checks exit 0 without diagnostics. |

Low finding: S0 isolation correction described in structured finding; no medium/high or product findings. Evidence A-10862: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10862-e-1212-stage-mermaid-rendering-at-ad611df9-s0-and-m1-m8-pass/report.md. Previous partial A-10759 is retained, not reused. All rows freshly run locally on macOS arm64 Node24.21.0 with isolated Chrome Headless Shell, serial targeted files; 21 test executions (19 distinct), no failed/cancelled/skipped tests. Local slot free; CPU sample retained, no quiet-machine timing claim. Scratch removed. No epic criterion marks.

Stage covers: Linux 001d0718 at 956624130bbc3ba3ab80ade149a40c0b2c481cab (A-10848 merged, A-10849/A-10850 shards), macOS 328a44b8 same head (A-10857), both exit 0, full T1–T4/Web with T4 base only and report-only budgets. Plan missing []; tested SHA differs only by durations refresh. Clean dev remained equal to tested SHA at final check. M4 ran first to satisfy the route tests' built-bundle prerequisite.
