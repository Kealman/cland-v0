---
id: T-1992
kind: task
title: Turn on live deletion for suite-run retention once run-reference pins exist, with the configurable age floor and its help and fixture migration
state: open
status: review
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by:
  - T-1957
  - T-1991
topic: topic-1658
branch: t/T-1992-turn-on-live-deletion-for-suite-run
created: 2026-11-19T01:26:36.765Z
updated: 2026-11-19T17:50:39.378Z
---

## Summary

Split from T-1957 (2026-11-19). T-1957 ships retention in report mode (rule 27): it computes and logs what it would retire, but deletes nothing. Once run-reference pins exist, this item turns on live deletion, behind the configurable age floor (default 7 days).

## What to build

Enable deletion through T-1957's guarded deletion owner, respecting pins, the retirement claim and the age floor. Add the floor's configuration key with its parser, help text and frozen-fixture migration (rule 41). Before switching, replay T-1957's report-mode logs from the live machine to confirm what would be retired (rule 27).

## Acceptance criteria

- [x] C1. The report-mode replay artifact lists the would-retire counts and classes from the live logs, and the first live sweep retires no run that is pinned or younger than the floor (artifact plus test).
  - done: impl-1992 · 2026-11-19T17:48:00.165Z
- [x] C2. The age-floor key parses, is documented in help, and its frozen fixtures are migrated (test).
  - done: impl-1992 · 2026-11-19T17:30:46.999Z
- [x] C3. A live sweep on a fake root of 50,000 runs keeps `task.view` answering within a named bound (test, native slot).
  - done: impl-1992 · 2026-11-19T17:30:47.138Z
- [x] C4. Retention classifies run directories under `.cland/run/suites` that the hub's run index doesn't know (about 91,000 of 96,758 on 2026-11-19) in report mode only (rule 27): each pass logs would-retire counts by class. A run qualifies only on a positive absence receipt from the index, no reference, pin or pointer, and the newest mtime across its bounded inventory past the age floor. Trees beyond the inventory bound are retained. A fake root with indexed and unindexed runs, including an unindexed referenced run and an unindexed run with one new file inside an old root, shows the classification (test). Live deletion of the unindexed class is a separate item, after a replay of these report lines.
  - done: impl-1992 · 2026-11-19T17:48:00.367Z
- [x] C5. Before the first live sweep, runs referenced only by pre-existing criterion verification marks (which `retainsSuiteRun` in tracker/index-db.ts doesn't query today) are backfilled into pins or indexed keep protection. A fixture with a criterion-only reference shows that run kept (test).
  - done: impl-1992 · 2026-11-19T17:48:00.627Z

## Comments

### impl-1992 · 2026-11-19T17:02:34.847Z

First vertical slices observed red then green locally on macOS Node v24.21.0: age-floor parser (undefined !== 7), historical criterion-only indexed keep (false !== true). Proposed live limits: 32 identities per yielded batch, cap 256 retirements/classifications per pass. Existing consumer census docs/hub/suite-run-references.md is being refreshed with raw-path/field searches across source, all tiers, briefs, skills and frozen CLI fixtures. New config consumers: init/config.ts parser/default/render, init/config-set.ts shared candidate validation, hub/configuration.ts reload, hub/suites.ts, cli/usage/config.ts, frozen commands.json, config/init/reload/help tests.

### impl-1992 · 2026-11-19T17:12:40.647Z

Coordinator accepted higher-cap option and requested a throttle. Defaults now share SUITE_RETENTION_PASS_LIMIT=4096; verification.suite_retention_pass_limit accepts 1..4096 and suite_retention_min_age_days accepts positive integer days, default7. Both reload for the next pass. Maximum4096 indexed attempts +4096 discovered directory entries per pass, yielding every32. At4.5 passes/hour, eligible unindexed capacity18432/hour minus1500/hour growth gives16932/hour net (~5.4h for91000); projection excludes actual IO and young/protected runs. Scale allowance title migration authorized with existing111s case/113s file bounds, E-880 owner, expiry2026-11-26 alongside other allowances; live sample still in flight, any increase will be reported before commit.

### impl-1992 · 2026-11-19T17:29:57.150Z

Evidence published through the shared scan-and-publish helper as A-21845 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21845-t-1992-report-replay-bounded-retirement-and-validation-evidence.md; staged copy removed. It preserves A-21843 replay, red/green and incomplete full-drain epochs, precise before/after timing scopes, native keep controls, consumer census, and local validation. Completed: all 232 T1 files / 1946 tests, targeted 65 tests including required help/config/frozen usage coverage, both changed T4 cases, full typecheck. No configured verification or source verdict yet. origin/dev fetched and merged once (already up to date). Final lint still in its normal CLI-install prerequisite probes; earlier full lint completed zero refusals.

### rev-35 · 2026-11-19T17:42:47.132Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1992-source-1
commit: 3b3e9e513292b684ee2291d5f096a8b3856ac0ae
scope: full
findings: [{"severity":"high","text":"H1 · Standards/Spec: unindexed discovery inherits production remove:true from Suites, enabling deletion of a class that has no live report replay; current C4 and Coordinator b06bf65b/9ba7ad4d require its independent switch to default to report-only.","file":"hub/src/suite-retention.ts","line":77},{"severity":"medium","text":"M1 · Spec: qualification checks only root mtime; countTree never records descendant mtimes, so a new file or updated nested file inside an old root can qualify despite the age floor. C4 requires newest inventory mtime and an old-root/new-file regression.","file":"hub/src/suite-unindexed-retention.ts","line":70},{"severity":"medium","text":"M2 · Spec: report mode emits only removed:false and ignores the guarded approval result; unindexed classifications never enter SuiteRetention's counters/snapshot, so the scheduler produces no per-pass would-retire reason/class counts required by C4.","file":"hub/src/suite-unindexed-retention.ts","line":56},{"severity":"medium","text":"M3 · Standards: the matching partial hash='' index exists at line200, but the new per-candidate migration lookup has no large-tracker query-plan/work-count control. Coordinator 9c9b54cc requires that proof; this is a validation gap, not evidence that the query actually scans.","file":"hub/src/tracker/index-db.ts","line":535},{"severity":"medium","text":"M4 · Standards: both new C5 TrackerIndex constructors assign only after returning and cleanup captures index?.close(); a schema/migration rejection after DatabaseSync opens leaves that connection unowned and root/guard cleanup eligible. Inject pre-owned database capture and exercise constructor rejection.","file":"hub/test/suite-reference-pins.test.ts","line":36}]
finding_counts: {"high":1,"medium":4,"low":0}

Source-only full review at immutable 3b3e9e513292b684ee2291d5f096a8b3856ac0ae (Git tree 9eae2b0fc296e0dfdc74116a7073a32f867c7f3f). Five findings ranked high/medium, details and retained evidence limits in A-21848 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21848-t-1992-source1-unindexed-mode-age-reporting-and-c5-proof-gaps.md).

H1: hub/src/suite-retention.ts:77 — unindexed discovery inherits live deletion despite revised C4/default-off disposition.
M1: hub/src/suite-unindexed-retention.ts:70 — root-only mtime ignores young descendants.
M2: hub/src/suite-unindexed-retention.ts:56 — report approval/classification facts never become per-pass reason counts.
M3: hub/src/tracker/index-db.ts:535 — large-tracker query-plan/work control missing; matching partial index DOES exist at :200.
M4: hub/test/suite-reference-pins.test.ts:36 — a throwing TrackerIndex constructor can leave its native DB outside index?.close().

Marks: failed C1,C4,C5; no new verification marks. C2/C3 remain unverified. Coordinator explicitly accepts aggregate replay for indexed classes only; that is not a finding. Coordinator-authorized dirty corrections are outside this fixed-head verdict. No runtime or native verification executed by Reviewer; configured suite remains unexecuted at this head. Please include all five findings in the single correction and request fresh exact-head source review before verification.

Criteria: C1 failed (Pinned source enables unreplayed unindexed deletion and uses root-only mtime, so a young descendant can be retired.), C4 failed (Unindexed class must default report-only, use newest bounded-inventory mtime and emit per-pass class/reason counts; pinned source does none of these.), C5 failed (Existing partial index needs the required large-fixture query-plan/work proof; new historical-mark fixture does not own database acquisition through constructor rejection.).

### rev-35 · 2026-11-19T17:50:39.378Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1992-source-2
commit: cdeea1ca069b0b6439285fb97ca4ccdf97e5fb87
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source-only clear at cdeea1ca069b0b6439285fb97ca4ccdf97e5fb87, Git tree596e05911916c7bd450532c57da41489734445ae. Standards and Spec: no remaining in-scope findings. A-21850 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21850-t-1992-source2-clear-indexed-activation-and-independent-unindexed-reporting.md) records the complete resolution and evidence limits.

All A-21848 findings resolved: independent default-off unindexed deletion; newest bounded inventory mtime and fresh-file/depth controls; per-pass class reporting with no retirement claim in report mode; positively controlled actual-query EXPLAIN over10,000 retained rows; pre-owned native DB capture and constructor-rejection settlement in C5. Matching partial index remains present. Documentation and report consumers match the revised source/C4.

No criterion marks added: C1–C5 remain runtime-unverified pending configured verification at this exact head. A-21849 local checks are uncommitted-tree retained-return evidence; A-21845 native observations belong to earlier working-tree epochs. No Reviewer runtime/native execution. Indexed aggregate replay is explicitly accepted by Coordinator; unindexed shipping mode stays report-only. S/Tech debt aside for a future unindexed deletion writer/nested-change fence was routed separately to T-2011 and is outside this default-off shipping authority. Any head/default change needs fresh source review.
