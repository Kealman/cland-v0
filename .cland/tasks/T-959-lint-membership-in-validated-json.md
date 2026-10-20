---
id: T-959
kind: task
title: "Lint: membership in validated JSON dictionaries uses Object.hasOwn or a Map, never `in`"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-728
branch: t/T-959-lint-membership-in-validated-json
created: 2026-10-20T09:53:37.650Z
updated: 2026-10-20T10:06:39.360Z
---

## Summary

impl-822 (T-822) found that `key in dict` on a validated JSON dictionary accepts prototype keys like `constructor` or `toString`. Add a static lint so the pattern cannot return.

## What to build

The repository's static lint (npm run check) flags `in` used for membership on plain-object dictionaries in hub/src. Allowed forms are `Object.hasOwn` or a Map. The lint has an inline exemption with a reason for genuine prototype checks. Fix the existing occurrences, or exempt them with a reason, and add prototype-key regression coverage where a key grammar admits such names. This comes from the residue of the rule batch (A-7281), which the human approved on 2026-10-20.

## Acceptance criteria

- [ ] C1. npm run check fails on a scratch `'x' in someRecord` in hub/src, naming file and line.
- [ ] C2. Every existing occurrence is converted or carries an exemption with a reason; the evidence lists them.
  - verified: rev-26 [reviewer] · run rev-20261020-959-source-1 · 2026-10-20T10:06:06.216Z · commit d0f25f233f213e8378b5cb1f390c21d35d65436d
- [ ] C3. A regression test shows a prototype key (`constructor`) is refused where the key grammar admits it.

## Comments

### impl-959 · 2026-10-20T09:55:34.726Z

Audited 79 production `in` expressions using the TypeScript AST. Unsafe dictionary uses include OpenAPI comparison keys, task subcommand dispatch and OpenCode active-session dictionaries. Requested supervising lead's scope decision on explicit structural union narrowing exemptions; preserving TypeScript narrowing is the main compatibility consideration. Regression seam is the public existing OpenAPI comparison API and/or task CLI command parser, per C3.

### impl-959 · 2026-10-20T10:04:18.634Z

Pushed clean d0f25f233f213e8378b5cb1f390c21d35d65436d after fetching/merging origin/dev. A-7336 records C1 scratch npm run check exit 1 with hub/src/__membership_scratch.ts:2, exhaustive 81-expression audit (25 converted, 3 reasoned prototype checks, 53 declared finite-key guards automatically allowed per Coordinator decision), and red/green constructor snapshot regression. Exact-head local macOS T0 check exited 0 (existing test lint report-only); targeted T1 8/8 passed in isolated source copy. Source review requested; no suite receipt claimed yet. qaPolicy scope none / after-stage.

### rev-26 · 2026-10-20T10:06:06.216Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-959-source-1
commit: d0f25f233f213e8378b5cb1f390c21d35d65436d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no finding. Enforcing typed T0 guard is wired to root check, finite-key exception follows Coordinator 3579b880, local reasoned comments and fake exemption self-checks are documented. T1 snapshot replaces request before use, so no fetch/timer runs despite conservative reachability diagnostic. Spec: 81-expression audit covers 25 own-key conversions, three inherited-error exemptions and 53 authorized finite-key guards; constructor/toString/__proto__ regression distinguishes absent inherited from real own JSON entries. C2 source verified. A-7336 isolated scratch diagnostic and targeted 8/8 output checked with local/report-only limits; requested original pre-fix red retention. C1/C3/final execution remain pending post-source mode-free result at d0f25f23. Reviewer ran no tests.

Criteria: C2 verified.

### impl-959 · 2026-10-20T10:06:39.360Z

Source clear at unchanged d0f25f233f213e8378b5cb1f390c21d35d65436d (rev-20261020-959-source-1; C2 verified). Submitted mode-free configured verification run 01c91b4d-f938-452d-a1c9-623da216d330, admitted at queue position 2; no completed receipt yet. Original pre-fix constructor regression tool output and exit 1 preserved without rerun as A-7350. Waiting for the hub result; source head remains stable.
