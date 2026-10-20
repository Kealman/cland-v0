---
id: T-923
kind: task
title: "Enforce mode: headroom allowances for tests near their tier budget (periodic run A-6900 red at 2.06 s and 2.39 s vs 2 s)"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
regression_of: T-915
found_by: cover
topic: topic-675
branch: t/T-923-enforce-mode-headroom-allowances-for
created: 2026-10-20T01:13:40.197Z
updated: 2026-10-20T01:24:05.160Z
---

## Summary

Since T-915 switched budgets to enforce, the periodic dev run at 0f8cb85b (A-6900) failed only on two T2 tests just over the 2 s T2 test budget: `planned-stage.test.ts::stage landing and ten close frames…` at 2.39 s and `agents-filters.test.ts::Agents item history searches…` at 2.061 s. All 1091 tests passed. Tests that sit near their tier budget cross it by load variance alone, so the release-candidate stage covers (Linux and macOS at 2 workers) will turn red at random.

## What to build

Give every test identity whose observed time in any of A-6792, A-6795, A-6796, A-6900 (and the release-candidate covers if available) reaches 80 % or more of its tier's test budget, and has no allowance yet, an allowance of its observed peak plus 50 % headroom. Owner E-880, dated added 2026-10-20 and expiring 2026-11-19 (D72), with reason "load-variance headroom near the tier budget (T-923)". Do the same for files near their file budget. Change nothing else, and keep enforce on.

## Acceptance criteria

- [x] C1. A replay of all four logs through the production budget checker shows zero failures, and the list of identities at 80 % or more without an allowance is empty.
  - done: impl-923 · 2026-10-20T01:19:02.414Z
  - verified: rev-31 [reviewer] · run rev-20261020-923-source-corrected · 2026-10-20T01:24:05.160Z · commit a6b1785bc26f4c4d8ac8e771c4d26e5a9ad1ec50
- [x] C2. The report lists every added allowance with its observed peak, and the diff contains only additions.
  - done: impl-923 · 2026-10-20T01:16:13.047Z
  - verified: rev-31 [reviewer] · run rev-20261020-923-source-corrected · 2026-10-20T01:24:05.160Z · commit a6b1785bc26f4c4d8ac8e771c4d26e5a9ad1ec50
- [ ] C3. The dry-run and the mode-free verify at the reviewed head are green.

## Comments

### impl-923 · 2026-10-20T01:15:56.166Z

Implemented 43 new test allowances and 3 explicitly authorized raises in hub/test/durations.json only. A-6901 lists every added/raised key, six-log observed peak and cap; A-6902 is the self-contained production replay. A-6792/A-6795/A-6796/A-6900/A-6763/A-6767 all replay with zero failures, and zero >=80% identities/files lack an allowance. No file additions required. Three existing raises are the Coordinator's exception (decision adda58c4-dd81-4229-9f25-af61e998d4d4); two legacy entries converted to dated E-880 entries and lint passed. Other manifest content is unchanged; enforce stays on. Typecheck and dry-run passed (A-6903).

### rev-31 · 2026-10-20T01:18:10.464Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-923-source
commit: d84a6aaaec2fb823f0f3933474d31a54be559892
scope: full
findings: [{"severity":"high","text":"M1/C1: Replay feeds raw contract/scenario descriptors instead of normalized tier names, skipping budgets. Correct six-log audit finds107qualifying versus96, four missing T3headroom allowances and A-6763crew-launch10.090752s>10s/currentcap9.872076. A-6905 lists exact keys/caps; fourth existing raise needs Coordinator disposition beyond authorizedthree.","file":"hub/test/durations.json","line":5859}]
finding_counts: {"high":1,"medium":0,"low":0}

A-6905 independently audits all six raw logs and exact manifest. Existing43additions/3authorizedraises correctly match peaks×1.5/upwardmicrosecond,onlyallowed changes,no baseline/budget/source/enforce change. Sole highM1: A-6902rawdescriptor tier values bypass check/report; normalizedaudit107qualifying,4missing Claude/Codexcontract allowances and1crew-launchfailure in A-6763. Four additions are within original scope;crew cap15.136129would be fourth existingraise outside adda58c4exception,so get Coordinator disposition throughlead before changing it. Correct production-tier normalization and fullreport/replay,then fresh source review before same-headverify. C2preservation otherwise sound,C3pending. No Reviewer tests.

Criteria: C1 failed (Normalized replay has one A-6763failure and four >=80% T3identities still lack allowances.).

### impl-923 · 2026-10-20T01:19:12.961Z

Corrected source/evidence at a6b1785bc26f4c4d8ac8e771c4d26e5a9ad1ec50: production readTierAssignments normalizes descriptor tiers; every observed tier is asserted to be T1/T2/T3/T4. A-6906/A-6907 supersede A-6901/A-6902. 107 >=80% qualifying test/file keys; 47 new test allowances, zero file additions, four existing raises. Fourth raise crew-launch authorized by Coordinator 489179e2-d195-490f-aef4-a09c5a839de0. All six production-parser/checker replays now zero failures and zero unallowed qualifying keys with normalized tiers. All existing data preserved except four authorized raises (each listed with originals/peaks/caps). Dry-run green at new committed head.

### rev-31 · 2026-10-20T01:24:05.160Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-923-source-corrected
commit: a6b1785bc26f4c4d8ac8e771c4d26e5a9ad1ec50
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6911: source clear, M1 resolved. Independent normalized six-log audit finds107qualifying keys, exactly47new test allowances/no file additions, four Coordinator-authorized raises, zero remaining missing allowances/failures. Every cap, per-log peak, report entry, E-880/date/reason matches; only durations.json changes, baseline/source/budget/enforce unchanged and other allowances preserved. A-6907 uses production tier normalization plus recognized-tier assertions and checker/report calls. Fourth crew raise explicitly authorized by489179e2; originalthree byadda58c4, six-log expansion by7d7f5b95. C1/C2verified. A-6908 exact-head dry-run green; C3awaits fresh configured mode-free green at this unchanged source-cleared head. Historical A-6905not-clear retained; no findings. QA none/per-item.

Criteria: C1 verified, C2 verified.
