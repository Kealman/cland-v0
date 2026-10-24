---
id: E-1212
kind: epic
title: Rendered Mermaid diagrams in the web workbench
state: closed
criterion_seq: 1
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-959
branch: null
created: 2026-10-24T08:51:28.710Z
updated: 2026-10-24T20:56:46.261Z
closed: 2026-10-24T20:56:46.261Z
---

## Goal

A Mermaid `.mmd` diagram artifact opens rendered in the web Artifacts area, with its source one key away. The human approved a new client-side dependency, `mermaid`, for this (option a on T-1158, General 2026-10-24 08:51Z, answer to ask 7efa7a2e).

## Definition of done

- [ ] C1. A `.mmd` artifact opens rendered in the sandboxed viewer and its source stays available, shown in a Web test.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T20:56:43.409Z · commit fdcea0b958178e2b34c69b5f19fc22dbe8da1626

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

### qa-676 · 2026-10-24T20:53:29.943Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-24-3
commit: fdcea0b958178e2b34c69b5f19fc22dbe8da1626
stage: mermaid rendering
stage_hash: e70ed65f2aa74aec306a92e3ac20c5a0d630e82f1b4a8c53cf5fcb837f8259bd
findings: [{"severity":"low","text":"S0 still has the copied shell environment filter. Used previously authorized fixtureEnvironment plus scratchGitEnvironment at S, with zero forbidden keys and scratch HOME/XDG/Git; no product failure.","file":"qa/briefs/E-1212-stage-1.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Result | Observation |
|---|---|---|
| S0 | PASS | Clean detached HEAD=dev=S; T-1158 merged; sealed environment. |
| M1 | PASS | Both exact generated Mermaid names pass, 2/2, no skips. |
| M2 | PASS | 12/12 artifact cases; fixture census after 0. |
| M3 | PASS | 7/7 capability route cases, no skips. |
| M4 | PASS | Build; initial shell455894, growth571 bytes below1024. |
| M5 | PASS | web-only mermaid12.2.0, installed version matches. |
| M6 | PASS | Production audit exit0, all vulnerability counts0. |
| M7 | PASS | README route and strict security documented. |
| M8 | PASS | Typecheck/colour/tokens/HTML/hooks exit0, no diagnostics. |

Low brief isolation correction as structured finding; no product findings. Evidence A-11406, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11406-e-1212-stage-at-fdcea0b9-fresh-s0-m1-m8-pass/report.md. Fresh local macOS arm64 Node24.21.0, pinned Chrome Headless Shell1248 (path retained), serial targeted files,21 executions19 distinct,0failed/cancelled/skipped. M4 first for built bundle prerequisite. Local queue free; no timing performance claim. No real browser or epic criterion marks. Secret scan zero with positive controls.

Same-S covers: Linux14d0d24a A-11401, shard logs A-11402/A-11403; macOS9c0ab09c A-11393; both Finished exit0, T0 plus T1–T4/Web, T4 repetitions skipped/base only, budgets/lint/ratchet report-only. Linux machines cland-v0-c3d2e996 and cland-v0-5e4f53ab, lifetimes1361/1110s, costs$0.0945/$0.0771; admission-through-finish1391.44/1145.44s; total wall1419.25s including collection,$0.1716. No new full suite. Plan before verdict references prior QA commit; rechecking at this new verdict.

### qa-676 · 2026-10-24T20:56:43.409Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-24-1
commit: fdcea0b958178e2b34c69b5f19fc22dbe8da1626
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Result | Evidence |
|---|---|---|
| C1 rendered Mermaid/source | PASS | Reused exact-S stage M1/M2 in A-11406: generated test “diagram HTML, SVG and Mermaid use the sandboxed viewer with source one physical key away” passed; diagram SVG nodes and physical-key source/back assertions. |
| Freshness | PASS | cland demo status E-1212 --commit fdcea0b958178e2b34c69b5f19fc22dbe8da1626 --json returned current:true. |

No findings in this DoD scope. Run qa-dod-2026-10-24-1, tested fdcea0b958178e2b34c69b5f19fc22dbe8da1626. Coordinator request95d3f91e explicitly reuses A-11406 stage evidence; no new execution, lease or epic occasion. C1 is a Web-test requirement; no human browser claim. Original run local macOS arm64 Node24.21.0, pinned Chrome Headless Shell1248, M1 2/2 and M2 12/12 no skips. Stage isolation brief correction remains recorded on stage verdict. Stage closed with Linux14d0d24a/A-11401 and macOS9c0ab09c/A-11393 at same S; T0,T1–T4/Web completed, T4 base only/repetitions unrun, budgets/lint/ratchet report-only. Source evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11406-e-1212-stage-at-fdcea0b9-fresh-s0-m1-m8-pass/report.md.

DoD artifact A-11419: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11419-e-1212-dod-at-fdcea0b9-c1-web-evidence-and-current-freshness.md

Criteria: C1 verified.

### coord · 2026-10-24T20:56:46.261Z

Closed on qa-676's clear DoD verdict qa-dod-2026-10-24-1 at fdcea0b9 (A-11419), which reuses stage QA qa-2026-10-24-3 (A-11406) and the stage covers Linux 14d0d24a and macOS 9c0ab09c; freshness current.
