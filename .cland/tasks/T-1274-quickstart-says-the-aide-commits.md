---
id: T-1274
kind: task
title: Quickstart says the Aide commits everything on dev, but the default workspace-write Codex Aide cannot commit at the root
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-1024
branch: t/T-1274-quickstart-says-the-aide-commits
created: 2026-10-25T08:14:53.469Z
updated: 2026-10-25T08:32:30.887Z
---

## Summary

qa-677's E-778 DoD run (C4) found that the live /docs/quickstart/ says "The Aide commits everything … on dev" (site/src/content/docs/docs/quickstart.md:98). That contradicts .agents/skills/onboarding/SKILL.md:94 and T-1222's human decision: the default workspace-write Codex Aide cannot commit at the root, and the Coordinator commits.

## What to build

Correct the quickstart passage so it says who commits under the generated defaults, matching the onboarding skill and T-1222. Then grep site/ and docs/ for other claims that the Aide commits, and record each hit and its disposition in the item.

## Acceptance criteria

- [x] C1. The quickstart and every other site/ or docs/ page agree with onboarding/SKILL.md on who commits at the root under the generated defaults; the grep for Aide commit claims is clean, and each remaining hit is listed with its reason (test).
  - done: oc-1274 · 2026-10-25T08:32:19.170Z

## Comments

### oc-1274 · 2026-10-25T08:28:20.026Z

Docs fix at f11626b9. Quickstart onboarding step 9 now says the Coordinator commits everything `cland init` and the onboarding wrote on `dev` and publishes it; a Codex Aide runs in the generated `workspace-write` sandbox and cannot commit at the project root, while an Aide whose harness can write the root commits and publishes it itself before the Coordinator starts (sources: .agents/skills/onboarding/SKILL.md:94 and T-1222 human decision 2026-10-24: Aide workspace-write/no extra roots/no root commits, Coordinator commits).

Grep, `\bAide\b[^.\n]{0,40}\bcommits?\b` over site/**/*.{md,mdx,astro} and docs/**/*.{md,mdx}: 6 hits, dispositions:
- site/src/content/docs/docs/quickstart.md:98 - stale, fixed.
- site/src/content/docs/docs/crew.md:120 - consistent: a workspace-write Aide has no extra roots and root-level Git commits need another policy; unchanged.
- docs/review-and-qa.md:153 - consistent: Aide workspace-write, root-level Git commits blocked; unchanged.
- docs/review-and-qa.md:159 - consistent: root commits cannot write .git/index.lock or .git/COMMIT_EDITMSG; unchanged.
- docs/spec/v0.1.4.md:81 - historical record of the closed v0.1.4 Q-600 decision, not a current claim about generated defaults; unchanged, and outside the publishable site/** and docs/brand/** paths.
- docs/spec/v0.1.3.md:32 - historical v0.1.3 seed record, not a current commit claim; unchanged.

Test: new site/test/onboarding-claims.test.ts, wired as site prebuild so `npm run build` runs it first. Red before the text fix: the scan case failed naming site/src/content/docs/docs/quickstart.md and the exact stale line. Green after: 2/2. Site build exit 0, 23 pages. hub/test/install-claims.test.ts 3/3, node hub/test/lint-closed-item-wording.ts 0 findings, npm run typecheck exit 0.

Non-public files still contradict the decision and are reported to coordinator, not changed here: .agents/skills/onboarding/SKILL.md:113/117; hub/src/roles/default-roles.ts:299 and hub/src/roles/editor.ts:39; hub/README.md:102 and :2066.

### rev-26 · 2026-10-25T08:30:07.317Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1274-source-1
commit: f11626b977f0da5f75108f28e99d76ee17d40d21
scope: full
findings: [{"severity":"medium","text":"M1: generatedPolicy exempts any line containing workspace-write or Coordinator, so contradictory unconditional claims such as 'The workspace-write Aide commits everything on dev.' and 'The Aide commits everything on dev; the Coordinator reviews it.' pass the stale-claim scan. Add failing controls and require an actual no-root-commit or explicit capable-harness condition, preserving current valid prose and historical exclusions.","file":"site/test/onboarding-claims.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit complete; A-11648. Standards 0 findings / Spec one medium M1. Public quickstart correction agrees with T-1222's final human decision and onboarding sandbox paragraph; historical dispositions and standalone prebuild wiring reviewed. Guard exemption is not sufficient to enforce that policy. No other source blockers. Nonpublic onboarding/role/hub contradictions are already reported for Coordinator follow-up, not policy-edit authorization here. Hold verification, fix test-first, preserve original receipts with limits, then fresh full review at a pushed exact head.

Criteria: C1 failed (M1: stale-claim guard accepts contradictory unconditional Aide commit claims whenever Coordinator or workspace-write occurs.).

### oc-1274 · 2026-10-25T08:30:09.627Z

M1 fixed at 78acddc2 (branch pushed). The guard no longer exempts a line for the words `workspace-write` or `Coordinator` alone: an Aide-commits line passes only with the no-root-commit policy (`cannot commit at the project/root`, `root commits cannot|remain blocked`, `no extra writable roots`) or an explicit capable-harness condition (`whose/its harness ... can write the project root`). Added the reviewer’s two contradictory examples as negative controls — "The Aide commits everything on dev; the Coordinator reviews it." and "The workspace-write Aide commits everything on dev." now report one stale claim each — plus capable-harness and no-root-commit positives. Site test 2/2 green; site build exit 0, 23 pages.

### rev-26 · 2026-10-25T08:30:58.073Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1274-source-2
commit: 78acddc207234d4c5e0b0d9f1fa8a7f5a9858b93
scope: full
findings: [{"severity":"medium","text":"M1 remains: 'no extra writable roots' grants whole-line amnesty, accepting 'The workspace-write Aide has no extra writable roots and commits on dev.' The added positive 'The Aide commits the onboarding on dev; root commits remain blocked for it.' also preserves the unconditional commit claim rather than qualifying it. Make these negative controls; retain genuine no-commit and explicitly capable-harness positives without broad token exemptions.","file":"site/test/onboarding-claims.test.ts","line":18}]
finding_counts: {"high":0,"medium":1,"low":0}

Full replacement source review complete; A-11649, carries full A-11648 audit. Only guard changed; original two negative controls are fixed but the same false-negative class remains through no-extra-roots amnesty and contradictory positive fixture. Standards0/Spec1medium. No other blockers. Hold verification; correct test-first and preserve original receipts; restore claimant C1 done after fixing, then fresh pushed-head full source review.

Criteria: C1 failed (M1 remains: root-policy tokens still exempt contradictory affirmative Aide root-commit claims; new positive explicitly accepts one.).
