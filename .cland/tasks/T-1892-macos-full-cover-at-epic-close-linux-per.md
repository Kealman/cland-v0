---
id: T-1892
kind: task
title: macOS full cover at epic close; Linux per stage
state: open
status: review
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1680
branch: t/T-1892-macos-full-cover-at-epic-close-linux-per
created: 2026-11-16T07:29:45.299Z
updated: 2026-11-20T18:19:53.607Z
---

## Summary

After-stage gates require Mac plus sharded Linux at one tree (T-469; `docs/hub/running.md:198`). Make after-stage gates Linux-only, plus an optional macOS targeted run, and require the macOS full cover at the epic DoD gate. Merges impl #4 and §7 #1 options 1–2. The macOS workers-1 default is already in config (`verification.workers = 1`).

Kind: product. Triage ticket H-4 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes T-469 (2026-10-16) stage-gate contract. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. An after-stage gate closes on a green sharded Linux cover and, when the plan names one, a green macOS targeted run (test).
  - done: impl-1892 · 2026-11-20T18:09:50.571Z
- [x] C2. The epic DoD gate still requires a green macOS full cover at the DoD tree (test).
  - done: impl-1892 · 2026-11-20T18:09:51.053Z
- [x] C3. running.md and the plan-epic and qa skills state the new gate (docs check).
  - done: impl-1892 · 2026-11-20T18:09:51.624Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1892-source · 2026-11-20T18:19:53.607Z · commit efb8cab095b54814c72da2bab038a0a5406045ca

## Dependencies

none; tracker `#stageCover`/`#stageCurrent`

## Comments

### impl-1892 · 2026-11-20T17:43:48.444Z

Consumer inventory (rules 20/41): tracker plan parser/setPlan, stage status/currency and persisted StageClosure; StageCandidates history index; Suite scheduler stageCovers/stageMissing, selection transport/parser/cache identity and command planning; dispatch verify admission/result summary; CLI verify parser/help and task plan show; MCP verify schema/pass-through; protocol validation and shared/wire declarations/conformance; hub/nvim/web plan readers (optional field additive; existing plans retain no-macos shape); stage-closure-component, planned-stage, stage-qa, stage-close scenario, suite-stage-cover/rules, suite-close-component, task-plan, epic-close, suite-selection, CLI help and frozen cli-usage/commands.json; plan-epic/qa skills and stage brief template, running.md, tests.md and hub README. Historical QA briefs and persisted legacy full-cover/closure records remain readable; full covers no longer satisfy an explicit targeted-path requirement. New --stage selector is additive; previous wire requests without it remain full local stage runs. No clause lines added, per launch brief.

### impl-1892 · 2026-11-20T18:08:16.608Z

Consumer follow-through: added suite-persistence.test.ts to the contract inventory (stageMissing literal assertions and archived summaries); its legacy cover-byte oracle is retained unchanged, while missing-platform expectations migrate to Linux-only. Full direct serial T1 selection: 237 files, 2017/2017 pass, zero skips on local macOS arm64 Node24.21.0. Earlier run retained four failures (2013/2017): own Web-mask interaction plus three superseded stageMissing expectations; affected rerun 187/187 pass. No configured verify or full Coordinator all receipt yet.

### impl-1892 · 2026-11-20T18:11:33.575Z

Native consumer checks: suite-selection.test.ts 161/161 pass; suite-stage-cover.test.ts final rerun 1/1 pass. First native stage attempt retained its changed immediate-closure assertion failure; fixed by waiting for durable closure. The successful stage rerun started at 1-minute load 12.42 (above the granted 12 bound); disclosed to Coordinator and excluded from timing claims. Native slot released. New fake-only selector test exercises MCP pinning; scripted fixtures now inject stageTree from candidate.tree so their guard catches no background native Git.

### rev-40 · 2026-11-20T18:19:53.607Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1892-source
commit: efb8cab095b54814c72da2bab038a0a5406045ca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: Standards0 findings; Spec0 findings. Linux-only after-stage cover, optional same-tree exact-path targeted macOS evidence, per-stage union pinning and exact executable plan/producer receipt validation reviewed. Full Mac map excludes targeted receipts; epic DoD close requires full Mac at accepted DoD tree. Plan changes invalidate closure hash; old closure/request shapes retained. C3 matching docs/help/frozen bytes/skills (with change records) verified. C1/C2 run-dependent marks remain pending ordinary configured verify plus Coordinator-required full all from this worktree at unchanged head. A-22209 selected local macOS Node24.21 proof is partial; disclosed12.42 load native rerun and earlier failures retained, no timing claim. Reviewer ran no tests/native/browser. Artifact records source review.

Criteria: C3 verified.
