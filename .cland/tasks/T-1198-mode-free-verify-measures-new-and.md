---
id: T-1198
kind: task
title: Mode-free verify measures new and changed T3/T4 identities on Linux and prints an allowance stanza
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-934
branch: t/T-1198-mode-free-verify-measures-new-and
created: 2026-10-24T06:46:04.400Z
updated: 2026-10-24T08:11:29.138Z
---

## Summary

In v0.2 a new T3 identity over its budget first showed up in a stage cover (T-1179, 7.23 s on cover c110635c), costing a cover pair. A task's own mode-free verify skips T3/T4. Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. A mode-free verify runs each new or changed T3/T4 identity once on Linux and, for any identity at 80 % or more of its tier budget, prints a ready-to-commit allowance stanza at about 1.5 times the worst passing sample (test).
  - done: impl-1198 · 2026-10-24T07:55:43.079Z
  - verified: rev-31 [reviewer] · run rev-20261024-1198-final · 2026-10-24T08:08:15.105Z · commit 03779f975a9d8859b2f520a7dd2dbf195c21a52d
- [x] C2. docs/agents/tests.md documents the check and how it relates to T-931's headroom rule (docs).
  - verified: rev-31 [reviewer] · run rev-20261024-1198-source · 2026-10-24T07:50:03.358Z · commit ad4e6bd8c747fef46db8d2d31d731492065c1ee9
  - done: impl-1198 · 2026-10-24T07:55:43.294Z
  - verified: rev-31 [reviewer] · run rev-20261024-1198-source2 · 2026-10-24T07:56:15.152Z · commit 03779f975a9d8859b2f520a7dd2dbf195c21a52d
  - verified: rev-31 [reviewer] · run rev-20261024-1198-final · 2026-10-24T08:08:15.105Z · commit 03779f975a9d8859b2f520a7dd2dbf195c21a52d

## Comments

### impl-1198 · 2026-10-24T07:45:11.115Z

Implemented the three confirmed seams test-first: changed-file selection/sharding, reusable allowance formatter, and real package-runner receipt/report. Selection includes new/edited T3/T4 files independently of T2 fallback; one base execution each and no repetitions. Recommendations retain passing outcome, threshold >=80%, 1.5x worst passing sample, UTC dates and nearest open container ownership. No durations.json edits. Focused selection suite 97/97 on local macOS; initial npm run check passed before docs edits (report-only test lint). Full targeted runner and final docs/check validation in progress. Coordinator confirmed live mode-free Linux capability evidence follows landing/restart, not a pre-merge blocker.

### rev-31 · 2026-10-24T07:50:03.358Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1198-source
commit: ad4e6bd8c747fef46db8d2d31d731492065c1ee9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at ad4e6bd8 (tree 948e6857f9c268663da1099fafb9e22135a01f2a); no findings. Standards/Spec audit A-10421. C2 documentation established. Changed-file T3/T4 selection is bounded across tier plans, deduplicated, once-only with soak prerequisite; pass-only formatter uses >=80% tier threshold, worst passing sample, 1.5x headroom and dated open-container ownership; log/summary preserve the full stanza and measured wall. Coordinator decision b1091c06 explicitly assigns live Linux proof after landing/restart, with fixture proof pre-merge; final C1/runtime settlement awaits retained original receipts and ordinary configured mode-free verification at this exact head. Reviewer ran no tests; no live new-phase/Linux or stage-QA pass claimed.

Criteria: C2 verified.

### rev-31 · 2026-10-24T07:55:23.919Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1198-evidence-fail
commit: ad4e6bd8c747fef46db8d2d31d731492065c1ee9
scope: evidence
findings: [{"severity":"medium","text":"M1: task-owned clause wording changed but its defaults/project assertions retain old task tier, procedure and fallback text (lines65/66/68). Configured 3bdea1a2 fails both shipped-clause cases. Migrate matching expectations to changed T3/T4 sampling and retained T2 fallback; keep byte-reserve and other guards.","file":"hub/test/roles-clauses.test.ts","line":65}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear at ad4e6bd8: 3bdea1a2/A-10445 T1 exit1, two roles-clauses failures; T2/Web not executed. A-10454 records exact failure, evidence counts/platform, and A-10434 original targeted provenance. Source review missed the task-owned matching assertion migration. C2 source documentation retained; no new product defect inferred. Coordinator b1091c06 live-Linux-after-restart disposition remains, but this task-owned configured failure must be fixed first. Fresh committed source review before retry; no dev merge or allowance change requested. Reviewer ran no tests.

Criteria: C1 failed (Configured exact-head verification exits1 on two stale clause-contract assertions; correct matching tests, obtain fresh source review and a replacement mode-free result.).

### rev-31 · 2026-10-24T07:56:15.152Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1198-source2
commit: 03779f975a9d8859b2f520a7dd2dbf195c21a52d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at03779f97/tree410a7045; M1 resolved, no findings. A-10458 carries A-10421 full audit/A-10434 fixture attribution. Exactly three matching expectations migrate for both default/project clauses/shared procedure, plus indexed test guidance; reserve/other guards intact, production/policy unchanged and no dev merge. A-10452 original local clause27/27 and A-10456 check output inspected with working-tree/static limits. C2 documentation re-established; C1 remains pending replacement exact-head mode-free result under Coordinator b1091c06. Historical A-10445 remains failed; no runtime executed by Reviewer.

Criteria: C2 verified.

### impl-1198 · 2026-10-24T08:07:44.379Z

Replacement configured mode-free verification 2bcfb25f at exact reviewed head 03779f975a9d8859b2f520a7dd2dbf195c21a52d passed on droplet c-8/lon1 Linux x64 6.8.0-142-generic, Node24.21: 2795 tests, 2795 passed; T1, T2, Web completed. Runtime duration budgets/test lint report mode; host typecheck gate reused at dce74e75 (not repeated), plus local task npm run check A-10456. Receipt A-10475; machine lifetime602s/cost$0.0418. Current hosting hub still pins T1/T2, so this is not live proof of the new changed-T3/T4 phase; Coordinator b1091c06 assigns that proof after landing/restart. Prior A-10445 remains failed. Post-result git fetch + merge-tree conflict check returned exit0 without changing HEAD; worktree clean. Awaiting Reviewer final same-head settlement.

### rev-31 · 2026-10-24T08:08:15.105Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1198-final
commit: 03779f975a9d8859b2f520a7dd2dbf195c21a52d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final pre-merge C1/C2 clear under Coordinator b1091c06 at unchanged 03779f97/tree410a7045. A-10477 carries source A-10421/A-10458 and original local fixture provenance A-10434. Replacement 2bcfb25f/A-10475 exit0,2795/2795,Linux c-8 lon1 T1/all fallback hub+Neovim T2/Web. Independently checked both corrected clause passes, per-tier equality, timing contract and formatter ordinary+five distinct load passes/explicit5/5. Current hosting hub did NOT execute new T3/T4 sampling or its native fixtures: C1 pre-merge uses approved fixture seams; Coordinator explicitly owns live Linux capability proof after landing/restart and said do not hold ready for it. C2 docs established. Historical A-10445 stays failed, budgets/lint report-only, hostT0 not repeated remotely; no stageQA claim or Reviewer runtime/enqueue. No findings.

Criteria: C1 verified, C2 verified.
