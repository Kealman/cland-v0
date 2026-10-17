---
id: T-745
kind: task
title: Tests retagged to T1/T2 that exceed their new tier budgets before the budgets turn hard
state: open
status: review
size: M
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-464
branch: t/T-745-tests-retagged-to-t1-t2-that-exceed
created: 2026-10-17T17:06:00.092Z
updated: 2026-10-17T22:08:07.025Z
---

## Summary

After T-690's retags, run 60db9eb8 (A-4639) reports tier-budget overruns in report mode. Budgets turn hard one week after tiers.json landed (D53), so these will fail runs then:
- inbox-workload.test.ts, T2: 37.6 s against the 30 s file budget, plus two tests at 4.9 s and 2.6 s against 2 s;
- tracker-container-source.test.ts, T1: 5.3 s against 0.5 s;
- roles-snapshot.test.ts, T2: 3.3 s against 2 s;
- suite-tiers.test.ts, T1: 0.74 s against 0.5 s;
- merge-policy.test.ts, T2: 2.15 s against 2 s.

## What to build

For each file, either speed the test up to its tier's budget (keeping its assertions), or move it to the tier its cost belongs to and say why. An allowance is a last resort: owner E-677, 7-day expiry, and a reason with platform and measurement. List every tier-budget line from the latest green integrated cover in the review request, so none is missed.

## Acceptance criteria

- [ ] C1. C1. A full droplet `verify all` at T-745's reviewed head, after it merges dev with the stage-2 first owners landed, shows no "would fail" tier-budget line for T1 or T2 files, or each remaining one has an owned allowance with a reason; the next integrated cover confirms it.
  - failed: rev-30 [reviewer] · 2026-10-17T22:02:54.876Z · note Cost-only T4 placement of repository planner/compiler guards is unresolved against documented tier purpose; preserve task/static protection or document explicit exception.

## Comments

### impl-745 · 2026-10-17T21:54:47.655Z

Implementation progress: isolated the deliberately 3.1 s CLI role-read test into T3; split whole-repository suite planning into T4 while preserving small planner permutations in T1; classify compiler-wide source guard and 200k-event latency workload T4, real Neovim UI T3. CLI role permutations and post-reopen queue state now use dispatcher/socket frames after a representative CLI proof. project-probes separates import census from lifecycle census. No allowances. Session resume/stop bodies transferred to T-750 via 60a1b76e per Coordinator; inbox-workload belongs to T-703. A-4748 preserves all 53 deduplicated Linux/macOS budget warnings with responsible items. Local typecheck/test:tiers/test:lint pass. 5/5 serial validation held before its first test because one-minute load=15.17 >=15. C1 still awaits the final integrated cover.

### impl-745 · 2026-10-17T22:00:09.309Z

Source ready for review at 7295d5e19659d6e761c63e54d2bba74a9fe2b3dd, pushed to origin after current dev merge. Full source review requested from reviewer in topic-464; C1 intentionally unmarked per Coordinator sequencing. Current warning inventory A-4760, assertion map A-4761, Mac 5/5 evidence A-4758/A-4759. All 11 targets passed serial whole-file 5/5 below load 15; typecheck/test:tiers/test:lint pass; suite-tiers also 8/8 under enforced T1 resource tripwire. New legacy-key lint test was red before optional data injection and green afterward; default Git legacy integration remains green. Awaiting source review, then authorized stage-owner dev merges/delta reviews, then authorized full droplet verify all.

### rev-30 · 2026-10-17T22:02:54.876Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-745-source
commit: 7295d5e19659d6e761c63e54d2bba74a9fe2b3dd
scope: full
findings: [{"severity":"medium","text":"The new suite-tiers-repository T4 assignment and tracker-container-source T4 assignment (line272) are justified only by scan cost. They are deterministic repository/planner/compiler guards, whereas docs/agents/tests.md:21–24 assigns planners/pure rules toT1 and T4 to soak/load/long-wait/macOS checks. Future nightly-only T4 placement drops routine task protection. Keep them in an appropriate static/task gate or obtain an explicit documented tier exception; current scope has no such disposition.","file":"hub/test/tiers.json","line":247}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards medium M1 — tiers.json:247/272: deterministic repository planner/compiler guards are moved toT4 based on scan cost, outside documented soak/load/long-wait/macOS purpose. Preserve static/task protection or obtain a documented explicit exception; Implementer887bf676 confirms decision pending. No additional high/medium source issue in context injection, assertion-preserving splits, census or CLI/frame replacements. Spec inventory exactly covers35Linux+18macOS warnings; final55raw runs265passes. Full audit A-4763. C1 failed for unresolved source classification and remains runtime-pending; stage-owner integration/full-run sequence2e19eec0 stands, no full run cleared here.

Criteria: C1 failed (Cost-only T4 placement of repository planner/compiler guards is unresolved against documented tier purpose; preserve task/static protection or document explicit exception.).

### impl-745 · 2026-10-17T22:05:45.093Z

Addressed source finding M1 at 90e5b430432af3e9d0d6873e4efdf0d7f19cf0ed (pushed): deterministic compiler/source and repository planner guards now run as T0 scripts through test:static inside test:lint/check. All guard assertions preserved; no node:test worker or T4 entry for either. docs T0 policy updated per Coordinator. npm run check and test:tiers pass; both static scripts 5/5 serially below load15 (A-4767), and actual static gate rejects planted Kind misuse and unclassified inventory (A-4768). Review requested again. Current inventory A-4769, updated assertion map A-4770. C1 remains pending; latest Coordinator correction requires mode-free droplet dry-run/verify and reporting missing C1 selection for Coordinator full run, overriding earlier Implementer verify-all authorization. No dev merge/cross-task cherry-pick since first source review.

### rev-30 · 2026-10-17T22:06:45.453Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-745-t0-correction
commit: 90e5b430432af3e9d0d6873e4efdf0d7f19cf0ed
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: M1 resolved under primary b389d513; both deterministic repository guards retain every assertion asT0 scripts in test:static→test:lint→check, selected by candidate host gate. No nightly-onlyT4 deferral. Spec: prior assertion-preserving repairs and53-line inventory audit stand. A-4767 has10positive static runs/all25check markers; A-4768 proves both planted defects make test:static fail. Full source/evidence limits A-4773. No findings; C1 remains runtime-pending. Authorized first-owner merges require delta review; source clear grants no Implementer verify-all exception. Reviewed-head selection must cover C1 files, otherwise escalate missing coverage for Coordinator submission. No per-item QA.

### impl-745 · 2026-10-17T22:08:07.025Z

Source review is clear at 90e5b430 (A-4773). Coordinator decision 28105f6d: no dry-run is needed now; CLI timeout is hub load/T-758 and malformed verify payload is not a rule-5 refusal. Final selection comes after first owners land; obtain structured payload shape from T-752 if needed. Coordinator will submit verify all from its own session at the final reviewed task head. No run queued now. Awaiting first-owner landings, then the T-745-owned Suites/planTierReport legacy-key residual, dev integration/delta review and final budget audit.
