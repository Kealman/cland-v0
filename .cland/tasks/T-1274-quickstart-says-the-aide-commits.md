---
id: T-1274
kind: task
title: Quickstart says the Aide commits everything on dev, but the default workspace-write Codex Aide cannot commit at the root
state: open
status: ready
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
updated: 2026-10-25T08:46:31.987Z
---

## Summary

qa-677's E-778 DoD run (C4) found that the live /docs/quickstart/ says "The Aide commits everything … on dev" (site/src/content/docs/docs/quickstart.md:98). That contradicts .agents/skills/onboarding/SKILL.md:94 and T-1222's human decision: the default workspace-write Codex Aide cannot commit at the root, and the Coordinator commits.

## What to build

Correct the quickstart passage so it says who commits under the generated defaults, matching the onboarding skill and T-1222. Then grep site/ and docs/ for other claims that the Aide commits, and record each hit and its disposition in the item.

## Acceptance criteria

- [x] C1. The quickstart and every other site/ or docs/ page agree with onboarding/SKILL.md on who commits at the root under the generated defaults; the grep for Aide commit claims is clean, and each remaining hit is listed with its reason (test).
  - done: oc-1274 · 2026-10-25T08:32:19.170Z
  - verified: rev-26 [reviewer] · run rev-20261025-1274-final-1 · 2026-10-25T08:46:31.897Z · commit 97d9d80bba010d9633c4b2445585fe80a663965f

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

### oc-1274 · 2026-10-25T08:32:48.900Z

M2 fixed at 97d9d80b. Both reviewer controls are now negative controls: "The Aide commits the onboarding on dev; root commits remain blocked for it." and "The workspace-write Aide has no extra writable roots and commits on dev." each return one stale claim. The guard no longer grants whole-line token amnesty: an Aide-commits line passes only when the Aide clause itself says it cannot commit at the root or names a harness that can write it. Genuine no-commit and capable-harness positives are retained, plus the sandbox-description lines that use "commits" as a noun. Site test 2/2, site build exit 0/23 pages; receipts A-11650 (original outputs, limits) and A-11651 (corrected controls and green run). C1 restored done.

### rev-26 · 2026-10-25T08:33:32.722Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1274-source-3
commit: 97d9d80bba010d9633c4b2445585fe80a663965f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; A-11652 carries complete A-11648/A-11649 audit. M1/follow-up resolved: all contradictory examples negative, true Aide no-commit/capable-harness positives retained; no blanket workspace-write/Coordinator/no-extra-roots amnesty. Only guard changed; public copy/prebuild wiring unchanged. Standards0/Spec0. C1 done restored; runtime remains unverified pending same-head ordinary mode-free configured result plus original local standalone site guard output/exits (site/test outside configured tiers). A-11650/51 summaries/tail limits retained; extract original current-head npm test/build returned receipts without transcription reruns, label missing/truncated records. No native Codex, QA, publication/integration proof.

### oc-1274 · 2026-10-25T08:46:11.827Z

Mode-free verify 45da8e29 at 97d9d80b exited 0 (A-11657): suite 3114/3114 pass, 0 fail, 0 cancelled, 0 skipped. Actual phases: T0 exit 0; all T1 147 files/927 tests; fallback all T2 247 files/1852 tests; Web 44 files/225 tests. No changed T3/T4 ran: the deciding files are docs/site only. Droplet c-8 lon1 Linux x64 6.8.0-142, Node 24.21, Neovim 0.12.5, lifetime 662 s, cost $0.0460. Report-only diagnostics retained (lint 133/60, duration regressions, Web 40 s report-only over budget). Final evidence review requested at this head; origin/dev 3e2584ca fetched, merge-tree exit 0 (tree 6132381f).

### rev-26 · 2026-10-25T08:46:31.897Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1274-final-1
commit: 97d9d80bba010d9633c4b2445585fe80a663965f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1 verified. A-11658 audits exact-head configured45da8e29/A-11657 plus authoritative standalone stdout A-11654/55 and indexA-11656. Corrected public copy/dispositions/source-3 stand. Local Darwin guard2/2 duration70.584667ms, actual prebuild2/2 then Astro23pages/Complete/observed exit0; stdout/exit/source limits retained, no inferred full wall. A-11653 manual duplication superseded, original red truncation retained. Configured3114 ordinary passes/438 files plus15 existing install-claims load tests/files (three5/5), not onboarding guard repetitions. T0/T1/all fallback bothT2/Web green; noT3/T4. Host25.246s/tree d65fe37e2fc44341803ad772c4b6174eb4bcd6b8 not remotely repeated; Linux c8lon1 Node24.21/nvim.12.5/HSh156v1248/lifetime662s/$0.0460 distinct from suite wall. Report-only lint133/60/baseline1/timing warnings retained. Claimant clean read-only dev3e2584ca mergecheck0, no merge. No native sandbox/QA/publication/integration proof. Coordinator owns enqueue/merge.

Criteria: C1 verified.
