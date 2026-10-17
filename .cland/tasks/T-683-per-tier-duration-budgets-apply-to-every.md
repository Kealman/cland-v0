---
id: T-683
kind: task
title: Per-tier duration budgets apply to every test, with expiring allowances and a T3 ratchet, report only
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-679
  - T-681
topic: topic-416
branch: t/T-683-per-tier-duration-budgets-apply-to-every
created: 2026-10-16T19:59:28.090Z
updated: 2026-10-17T04:13:10.211Z
closed: 2026-10-17T04:13:10.211Z
---

## Summary

`durations.json` grandfathers the slow mass: 300 tests over the 5 s budget hold 51 % of all test time and never fail, while the cliff bites only new tests (report-strategy §2.5, memo §3.5). Decision 3: budgets per tier for every test, no grandfathering, a ratchet with expiring allowances; report-only for one week after `tiers.json` lands, then hard (E-678). This ticket builds the report-only half. It supersedes T-661: its relative 2× rule keeps the grandfathering decision 3 removes.

## What to build

- **Budgets per tier** in `durations.json` `budget`: T1 0.5 s per test / 10 s per file / 120 s wall, T2 2 s / 30 s / 480 s, T3 10 s / 120 s / 900 s, T4 none. Every test and file is checked against its tier's budget, known or new.
- **Allowances** gain `owner` (an open item id) and `expires` (a UTC date at most seven days after `added`, as quarantine entries do), beside the existing non-TODO `reason`. The manifest lint names expired, ownerless or closed-owner allowances.
- **The T3 ratchet.** A run projects the T3 total: the base manifest's T3 seconds, minus files and tests the head removed or moved out of T3, plus the observed seconds of T3 tests new at the head. Growth over the base needs an allowance keyed `T3` with owner and expiry. T1 and T2 may grow up to their tier walls.
- **Report only.** The result prints `budget (report only): would fail <key> <s> s > <budget> s (<tier>)` lines ranked by seconds over budget (cap 10, full list in the log) and `T3 ratchet (report only): <projected> s vs base <base> s`. Today's rule (a new test over 5 s or a new file over 60 s without an allowance fails) stays in force unchanged until E-678 switches enforcement on, so nothing gets looser this week.
- **Missing entries.** Test files absent from `durations.json` (today `suite-candidate.test.ts`, `suite-candidate-remote.test.ts`, `quarantine.test.ts`, `quarantine-runner.test.ts`, `init-machine.test.ts`) are named and budgeted by their observed time.

## Acceptance criteria

- [x] C1. Each known and new test and file is checked against its tier's budget, and the result lists the would-fail lines ranked by seconds over budget, proved by a durations test with a planted manifest.
  - done: impl-683 · 2026-10-17T02:02:52.761Z
  - verified: rev-30 [reviewer] · run rev-20261017-683-final · 2026-10-17T03:35:44.813Z · commit c33ae5e0ddf1f0172f066992ba08cb54995011f2
- [x] C2. An allowance without a non-TODO reason, an open owner item or an expiry at most seven days after `added` is refused by the manifest lint by name, proved by lint tests.
  - done: impl-683 · 2026-10-17T02:02:52.957Z
  - verified: rev-30 [reviewer] · run rev-20261017-683-final · 2026-10-17T03:35:44.813Z · commit c33ae5e0ddf1f0172f066992ba08cb54995011f2
- [x] C3. A head adding a 3 s T3 test without an allowance shows a would-refuse T3 ratchet line with the projected and base totals, and one moving a file from T3 to T2 lowers the projection, proved by a durations test.
  - done: impl-683 · 2026-10-17T02:52:15.133Z
  - verified: rev-30 [reviewer] · run rev-20261017-683-final · 2026-10-17T03:35:44.813Z · commit c33ae5e0ddf1f0172f066992ba08cb54995011f2
- [x] C4. A new test over 5 s without an allowance still fails exactly as before, and no report-only line changes a run's exit, proved by the existing durations-runner cases plus one new case.
  - done: impl-683 · 2026-10-17T02:02:53.423Z
  - verified: rev-30 [reviewer] · run rev-20261017-683-final · 2026-10-17T03:35:44.813Z · commit c33ae5e0ddf1f0172f066992ba08cb54995011f2
- [x] C5. A test file absent from `durations.json` is named and budgeted by its observed seconds, proved by a test.
  - done: impl-683 · 2026-10-17T02:02:53.629Z
  - verified: rev-30 [reviewer] · run rev-20261017-683-final · 2026-10-17T03:35:44.813Z · commit c33ae5e0ddf1f0172f066992ba08cb54995011f2
- [x] C6. `docs/agents/tests.md` describes the tier budgets, allowance fields, the ratchet and the report-only week.
  - verified: rev-30 [reviewer] · run rev-20261017-683-source · 2026-10-17T02:02:26.817Z · commit 767585e80a64d5eca010e5a91d23885bc57ff12c
  - done: impl-683 · 2026-10-17T02:02:54.009Z
  - verified: rev-30 [reviewer] · run rev-20261017-683-title-delta · 2026-10-17T02:03:11.435Z · commit 49bc933873d37aebd06d1b305821067df0fb1958
  - verified: rev-30 [reviewer] · run rev-20261017-683-ratchet-correction · 2026-10-17T02:52:09.309Z · commit c33ae5e0ddf1f0172f066992ba08cb54995011f2
  - verified: rev-30 [reviewer] · run rev-20261017-683-final · 2026-10-17T03:35:44.813Z · commit c33ae5e0ddf1f0172f066992ba08cb54995011f2

## Comments

### coord · 2026-10-17T01:52:35.726Z

Coordinator decision (D53 detail), 2026-10-17 01:53Z: the existing duration allowances in hub/test/durations.json become legacy allowances, owned by E-677 and expiring when E-677 closes, with no calendar date. Reasons and seconds are kept. New allowances keep the 7-day expiry with an open owner ticket. Budget reports list the legacy allowances separately (count and total seconds), so E-677's progress shows as that number falling. T-716's enforcement exempts legacy allowances until E-677 closes. Without this, 7-day expiries would need weekly mass renewal and would break runs once T-716 enforces.

### impl-683 · 2026-10-17T01:57:12.756Z

Implemented report-only per-tier budgets and T3 projection with a pinned merge base, full log diagnostics / top-ten result summaries, named observed-time missing baselines, and live-tracker allowance lint. Coordinator decision b53ebd2d: migrated existing allowances unchanged to legacy:true / E-677; new allowances require seven-day UTC dates and an open owner. Pure manifest and Git-snapshot tests pass; finishing runner and adjacent report/selection checks before first review.

### rev-30 · 2026-10-17T02:02:26.817Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-683-source
commit: 767585e80a64d5eca010e5a91d23885bc57ff12c
scope: full
findings: [{"severity":"low","text":"L1: The new title contains “and” twice (“known and new identity and name missing files”), contrary to docs/agents/tests.md:34. Name the coherent policy directly, or separate missing-baseline behavior if that is a distinct proof; preserve the assertions/shared fixture.","file":"hub/test/suite-duration-budget.test.ts","line":9}]
finding_counts: {"high":0,"medium":0,"low":1}

T-683 full source review clear at 767585e80a64d5eca010e5a91d23885bc57ff12c on t/T-683-per-tier-duration-budgets-apply-to-every. Fixed point 341e5ff2eef02eaed1367d85bcda733b2c63a428; git diff 341e5ff2...767585e8. Hold/task/spec/criteria read. Both axes reviewed in-session under the role's no-delegation requirement.

## Standards

Low L1 — hub/test/suite-duration-budget.test.ts:9: the new title “tier budgets rank every known and new identity and name missing files by observed time” contains “and” twice. docs/agents/tests.md:34 explicitly treats that as a finding. Rename it to state one coherent policy, or separate the missing-baseline proof if intended as another behavior. The assertions themselves are meaningful and use a shared pure fixture; this naming issue does not block source clearance.

Otherwise the new T1 policy tests use planted manifests/explicit now without processes or wall waits. Existing T3 duration refresh/Git snapshot and real runner/reporter files now state their boundaries. Input permutations share fixtures; no new sleep or elapsed-time assertion is added. Ranking, missing-baseline diagnostics, allowance lint and projection tests exercise policy rather than mirror incidental implementation.

## Spec

No findings. The 0.5/2/10-second test budgets, 10/30/120-second file budgets and 120/480/900-second walls are declared for T1/T2/T3; T4 has none. Every observed known/new identity and file is compared; exact allowances suppress only measurements within their own seconds. Repeated timing identities use a conservative single maximum. Missing file baselines are named with observed top-level test-seconds. Full logs retain all ranked overages; result summarization ranks by excess seconds and takes ten would-fail lines.

The admission host pins a merge-base SHA and stores it on the job. Post-receipt context reads committed head/base manifests and changed source via git show, including on remote runs, rather than using a droplet's dev ref or later dirty source. The ratchet starts with base T3 file seconds, excludes removed/retagged files, subtracts removed known literal/template test identities, retains unresolved dynamic titles conservatively, and adds observed new/promoted T3 identities once. A T3 allowance is a permitted projected total. Missing base data reports unavailable; it does not change exit. The pinned-source test covers a dirty post-submission source edit.

Read the primary Coordinator decision in task comments: old allowances become legacy:true under open E-677 with no calendar dates and expire on that owner's closure. Independent parsed comparison proves exactly 293 keys before/after; every existing reason, seconds and file flag is unchanged; all file/test/source baselines and old 5/60 budget values are unchanged. All 293 receive only the approved E-677/legacy metadata. New entries require non-TODO reason, open tracker owner and valid UTC added/expiry within seven days. Working/immutable admission loads authoritative root tracker ownership, including linked worktrees. Existing committed baseline keys bound the legacy exception; a new key cannot opt into legacy when that baseline is available. Refresh preserves metadata/T3 allowance rather than extending expiry. Legacy count and declared seconds are separately reported.

The active checkDurations gate is unchanged. New diagnostics are emitted after execution and appended by host reporting without modifying job outcome; the real runner case asserts report-only overages plus exit 0, while existing new-identity failure/allowance cases stay intact. The budget modules are marked shared selection infrastructure; tier-wall rendering reads declared manifest wall budgets. Docs cover semantics, report-only week, enforcement follow-up T-716 and the primary legacy exception.

A-4274 and the request record serial touched/adjacent files green, including new pure policy 4/4, durations 17/17, real runner 18/18, tier/report/dry-run suites and selection 86/86; typecheck/tier lint green. Pinned whitespace check passes. Reviewer ran no tests/compiler/provider, only read-only source and manifest audits.

C6 documentation verified. C1-C5 remain runtime-unverified pending accepted exact-head normal mode-free droplet verification; claimant done marks are currently absent and should be supplied when supported by evidence. Source clearance allows that task verification under Coordinator's current submission policy. No per-item QA. Standards: one low naming finding; Spec: zero findings; no high/medium issue remains.
Review artifact A-4277.

Criteria: C6 verified.

### rev-30 · 2026-10-17T02:03:11.435Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-683-title-delta
commit: 49bc933873d37aebd06d1b305821067df0fb1958
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-683 delta source clear at 49bc933873d37aebd06d1b305821067df0fb1958, directly compared with full-source-clear 767585e80a64d5eca010e5a91d23885bc57ff12c. Origin tip matches. The entire delta is the single test-title rename to “tier budgets rank all observed identities, naming missing baselines”. L1 is resolved; no assertion, fixture, policy, manifest or product behavior changes, and no dev merge. Standards and Spec: no findings. Prior full analysis A-4277 and targeted receipts A-4275/A-4276 apply to unchanged bytes; claimant reports renamed pure file 4/4 in 0.082 seconds and static typecheck/tier lint green. Independent whitespace check passes. C6 documentation proof refreshed; current task view confirms all claimant done marks. C1–C5 and final runtime verdict remain pending accepted exact-head mode-free droplet verification. Reviewer ran no tests/compiler/provider; no per-item QA.
Review artifact A-4278.

Criteria: C6 verified.

### rev-30 · 2026-10-17T02:47:54.548Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-683-ratchet-evidence
commit: 49bc933873d37aebd06d1b305821067df0fb1958
scope: evidence
findings: [{"severity":"medium","text":"M1: Missing base duration keys are treated as source-new T3 tests. Already-present, byte-identical T3 files therefore add false growth: A-4283 contributes 155.919319 s from unchanged T3 sources (e.g. all six models cases 18.843709 s). Compare pinned base/head source identities or equivalent change context; keep missing-baseline diagnostics separate and add unchanged-unbaselined regression coverage.","file":"hub/src/suite-duration-budget.ts","line":52}]
finding_counts: {"high":0,"medium":1,"low":0}

T-683 final evidence review NOT CLEAR at unchanged 49bc933873d37aebd06d1b305821067df0fb1958. The exact-head task run itself is green: A-4283 / 2b821d57-e889-4c08-b7a5-34f74cd8302f, full hub+Neovim, 2462 total/2454 pass/0 fail/8 prerequisite skips, exit 0. A-4284 is a labelled derived rendering, not another execution or replacement receipt. The evidence audit identifies a remaining Spec defect in the ratchet.

Medium M1 — hub/src/suite-duration-budget.ts:52: absence from base.manifest.tests is treated as “new at the head”. That is not sufficient: the base already contains many unchanged T3 tests/files lacking timing baselines. The context builds retained only from existing duration keys (suite-duration-context.ts:32–35), so it supplies no source-identity distinction for these old unbaselined tests. Their observed seconds are charged as new growth even when source and T3 assignment are byte-for-byte unchanged between the pinned base and head.

Concrete independent read-only audit of base 341e5ff2eef02eaed1367d85bcda733b2c63a428, reviewed head and A-4283 timing receipts: unchanged models.test.ts contributes all six tests/18.843709 seconds; unchanged cover-quiet contributes twelve/18.765046; unchanged suite-candidate contributes five/16.174337; unchanged config-set contributes eight/5.669181. Across unchanged T3 files, 155.919319 seconds are incorrectly charged as new. This accounts for almost all of A-4284's reported projection growth from 5250.181 to 5407.807 seconds. These files and their tier assignments already exist at the base; they are not head additions. This is manifest/source/receipt analysis, not a Reviewer-executed test.

C3 and the spec require adding observed seconds of T3 tests new at the head, while missing baseline files are separately named/budgeted. Determine new/promoted identities from the pinned base/head source or equivalent immutable change context rather than duration-key absence alone. Do not turn unchanged missing timing data into growth. Add regression coverage for an unchanged T3 file/identity absent from base duration data, including a head with no relevant source change; it must not create new-test growth. Keep the genuine new 3-second and promotion cases, removed/moved savings, dynamic-title conservatism and missing-baseline diagnostics. If missing base data prevents a truthful projection, report that uncertainty explicitly.

Positive evidence retained: all four pure policy cases, pinned-Git context test, anti-new-legacy admission test, report-only runner case and both new infrastructure selection identities pass ordinarily and 5/5 each (nine identities/45 repetitions). Full duration suite 17 cases and real runner suite 18 cases pass. Known/new tier checking, top-ten ranking, missing-file observations, reason/owner/expiry lint and unchanged active gate have passing proof. Actual log retains twelve would-fail overages, seventeen missing-baseline names and legacy 293/3710.347 s while still exiting 0. The serving pre-T-683 hub reports ratchet unavailable; derived A-4284 exposes the proposed host calculation. Neither is evidence of a deployed numeric host ratchet yet.

Fail C3 for M1; do not mark C1/C2/C4/C5 verified on this not-clear final pass. C6 source documentation remains established. L1 title correction stays resolved; Standards has no new finding. Preserve A-4283 as green execution evidence, fix this source issue and request delta source review before new-head verification. No unchanged retry, allowance to mask false growth or separate QA is directed. Reviewer ran no tests/compiler/provider.
Review artifact A-4285.

Criteria: C3 failed (Ratchet charges unchanged T3 identities missing duration baselines as new head growth (155.919319 s in A-4283); see A-4285.).

### impl-683 · 2026-10-17T02:51:10.511Z

Corrected M1 in c33ae5e0: missing duration keys no longer define source-new tests. Context covers every base T3 source, including unbaselined files, with byte-identical-source recognition and pinned base title patterns for changed files. Added no-change-head and changed-file regressions; existing new/promoted/removal/missing-baseline assertions remain. Missing base timings and uncertain identities are explicitly flagged. A-4286 replays accepted A-4283: unchanged-only growth is zero; full projection is 5251.887 vs base 5250.181, replacing the false 5407.807. A-4287 serial checks green; delta source review requested before new-head verification.

### rev-30 · 2026-10-17T02:52:09.309Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-683-ratchet-correction
commit: c33ae5e0ddf1f0172f066992ba08cb54995011f2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-683 delta source clear at c33ae5e0ddf1f0172f066992ba08cb54995011f2, compared with 49bc933873d37aebd06d1b305821067df0fb1958. Origin tip matches. Five changed files: pure policy/context, their existing tests and documentation. No dev merge. Standards and Spec: no remaining findings.

M1 is resolved in source. Context now enumerates all pinned base T3 assignments, not only files with duration keys. It records unchanged source files directly and reads both pinned sources for changed files, preserving literal/template title patterns and conservative unresolved identities. Reporting no longer charges duration-key absence by itself: unchanged base T3 sources and existing base title patterns are retained even without timings; true new/promoted observations still contribute once. Missing/uncertain timing/source data is explicitly labelled instead of presented as new-test growth. Removed known identities and demoted files still reduce the projection.

The Git-seam regression retains its removed known title, demotion, genuine new three-second observation and dirty post-submit source assertions. It now adds an unchanged unbaselined T3 source with head=base, plus old unbaselined literal/template titles in a changed file. It requires unchanged projection 14 vs 14, then the original reduced/new result 9 vs 14, alongside missing-baseline/incomplete-data notices. The previous false-new algorithm would give 46 instead of 9; A-4287 records the corrected case passing. The added pure uncertainty case covers unavailable source classification and dynamic identity, retaining uncertain data without inventing growth. Existing new/promoted/removal/dedup and T3 allowance assertions remain.

A-4286 is explicitly diagnostic replay of old A-4283 receipts, not another suite or current-head evidence. Its corrected 5251.887 vs 5250.181 projection and zero contribution from unchanged models/cover-quiet/suite-candidate/config-set are consistent with the new unchanged-source branch; incomplete timing data remains disclosed. The historical false projection and prior not-clear A-4285 are not erased.

A-4287 raw serial proof: pure policy 5/5, durations 17/17, runner 18/18, tier report 3/3, dry-run 4/4, no failures/skips; typecheck/tier lint green at low admission loads. Independent whitespace check passes. The active gate, allowance migration/expiry/ownership, diagnostic ranking and existing assertions remain unchanged. Reviewer ran no tests/compiler/provider.

C6 documentation refreshed, now explicitly distinguishing source-new identities from missing timing keys and disclosing uncertainty. C3 claimant done was cleared by the preceding failure and remains unchecked in current task view; restore it when supported by corrected proof. C1-C5 Reviewer runtime marks remain pending accepted exact-head mode-free droplet verification. Prior A-4283 is a green old-head execution, not a substituted new-head gate. No per-item QA.
Review artifact A-4288.

Criteria: C6 verified.

### rev-30 · 2026-10-17T03:35:44.813Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-683-final
commit: c33ae5e0ddf1f0172f066992ba08cb54995011f2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-683 at c33ae5e0ddf1f0172f066992ba08cb54995011f2. Same-head source correction: A-4288 / rev-20261017-683-ratchet-correction. Completed mode-free droplet verification dc11e8f4-76d3-4c8d-8607-4cf9d66ebeed, A-4293. Remote branch still resolves to this exact head.

## Standards
No remaining findings. Read-only evidence audit; no Reviewer tests or edits. Source standards and C6 documentation clearance stand.

## Spec
C1: planted known/new test and file budget ranking, missing baseline and summary cap tests pass. The complete receipt prints twelve would-fail overages ranked by excess and seventeen named observed missing-file baselines; the summary cap regression passes.
C2: allowance lint tests reject TODO reasons, missing/unknown/closed owners, invalid/expired/long dates by key. Both admission-boundary tests reject new entries adopting the one-time legacy exemption. Existing 293 legacy allowances remain reported as 3710.347 s under E-677.
C3: pure projection tests prove a new 3 s T3 identity grows 14 to 17 s without allowance, promotion accounting, explicit allowance, removal and T3-to-T2 reduction. The corrected pinned-source regression passes (ordinary 0.664 s): unchanged unbaselined source retains 14 vs 14; a changed fixture retaining old unbaselined literal/template identities while adding a true new test, removing an identity and retagging a file yields 9 vs 14. Uncertain source identity is explicitly incomplete and adds no invented growth. This resolves M1 in A-4285.
C4: the whole durations-runner file passes, including existing hard-budget failure cases and the new report-only case preserving exit zero despite planted tier overages.
C5: planted absent-file observed-budget tests and the report-only runner test pass; actual missing files are named with observed seconds in the completed receipt.
C6: source-current documentation verification remains established by A-4288.

All ten task additions pass ordinarily and 5/5 load repetitions each (50/50). Both typechecks complete. Phase counts independently sum to 2463 total, 2455 passed, zero failed/cancelled, eight skips (hub free 49/49; hub machine 2015 pass/5 skip; Neovim 391 pass/3 skip). Exit zero, full hub and Neovim, two machine workers; suite wall 2474.75 s, peak one-minute load 10.21.

Evidence limit: A-4293's outer ratchet line says unavailable (no base manifest), since the serving hub predates this code. C3 is established by the executed pinned-context/projection tests specified by the criterion; no live-host projected total is claimed. The production summary formatter is exercised by its passing test. A-4283/A-4284 are superseded old-head execution/derived preview and are not substituted for this corrected receipt.

Final review clear; verify C1-C6 at this head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-17T04:13:10.211Z

Merged 087b4afe1efc77526c7f4019291c909d0a433a84 onto dev.
