---
id: T-1992
kind: task
title: Turn on live deletion for suite-run retention once run-reference pins exist, with the configurable age floor and its help and fixture migration
state: closed
status: done
size: S
criterion_seq: 6
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
updated: 2026-11-19T20:26:30.207Z
closed: 2026-11-19T20:26:30.207Z
---

## Summary

Split from T-1957 (2026-11-19). T-1957 ships retention in report mode (rule 27): it computes and logs what it would retire, but deletes nothing. Once run-reference pins exist, this item turns on live deletion, behind the configurable age floor (default 7 days).

## What to build

Enable deletion through T-1957's guarded deletion owner, respecting pins, the retirement claim and the age floor. Add the floor's configuration key with its parser, help text and frozen-fixture migration (rule 41). Before switching, replay T-1957's report-mode logs from the live machine to confirm what would be retired (rule 27).

## Acceptance criteria

- [x] C1. The report-mode replay artifact lists the would-retire counts and classes from the live logs, and the first live sweep retires no run that is pinned or younger than the floor (artifact plus test).
  - done: impl-1992 · 2026-11-19T18:56:45.791Z
  - verified: rev-35 [reviewer] · run rev-35-1992-evidence-1 · 2026-11-19T19:37:14.416Z · commit 667f0d783ee07a0fa4b704720f91707c13ac3e85
- [x] C2. The age-floor key parses, is documented in help, and its frozen fixtures are migrated (test).
  - done: impl-1992 · 2026-11-19T17:30:46.999Z
  - verified: rev-35 [reviewer] · run rev-35-1992-evidence-1 · 2026-11-19T19:37:14.416Z · commit 667f0d783ee07a0fa4b704720f91707c13ac3e85
- [x] C3. A live sweep on a fake root of 50,000 runs keeps `task.view` answering within a named bound (test, native slot).
  - done: impl-1992 · 2026-11-19T19:06:49.939Z
  - verified: rev-35 [reviewer] · run rev-35-1992-evidence-1 · 2026-11-19T19:37:14.416Z · commit 667f0d783ee07a0fa4b704720f91707c13ac3e85
- [x] C4. Retention also retires run directories under `.cland/run/suites` that the hub's run index doesn't know (about 91,000 of 96,758 on 2026-11-19), live from the start under the human's one-off rule 27 exception (General, 2026-11-19 18:36Z, answer to ask 2da0c7c7), with per-pass counts by class logged. A run qualifies only on a positive absence receipt from the index, no reference, pin or pointer, and the newest mtime across its bounded inventory past the age floor. Trees beyond the inventory bound are retained. A fake root with indexed and unindexed runs, including an unindexed referenced run and an unindexed run with one new file inside an old root, shows the outcome (test).
  - done: impl-1992 · 2026-11-19T18:56:46.061Z
  - verified: rev-35 [reviewer] · run rev-35-1992-evidence-1 · 2026-11-19T19:37:14.416Z · commit 667f0d783ee07a0fa4b704720f91707c13ac3e85
- [x] C5. Before the first live sweep, runs referenced only by pre-existing criterion verification marks (which `retainsSuiteRun` in tracker/index-db.ts doesn't query today) are backfilled into pins or indexed keep protection. A fixture with a criterion-only reference shows that run kept (test).
  - done: impl-1992 · 2026-11-19T17:48:00.627Z
  - verified: rev-35 [reviewer] · run rev-35-1992-evidence-1 · 2026-11-19T19:37:14.416Z · commit 667f0d783ee07a0fa4b704720f91707c13ac3e85
- [x] C6. Before removal, the guarded owner rechecks the newest descendant mtime, not just the root's (`retireSuiteRun` checked only root mtime at suite-raw-coverage.ts:87), or fences writers by identity. A deterministic control rewrites a nested file between inventory and removal and shows the run kept (test).
  - done: impl-1992 · 2026-11-19T18:56:46.255Z
  - verified: rev-35 [reviewer] · run rev-35-1992-evidence-1 · 2026-11-19T19:37:14.416Z · commit 667f0d783ee07a0fa4b704720f91707c13ac3e85

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

### coord · 2026-11-19T18:36:57.615Z

The human's decision (General, 2026-11-19 18:36Z, answer to ask 2da0c7c7): «Разовое исключение: T-1992 сразу удаляет и неизвестные», a one-off rule 27 exception, so T-1992 deletes unindexed run directories live, without a report-mode period first. C4 is reworded to match. T-2011's removal-time recheck becomes C6 here, because unindexed deletion now turns on in this item. T-2011 is closed as superseded. The safeguards stay: newest descendant mtime past the 7-day floor, no reference, pin or pointer, the 4,096 per-pass cap (configurable), and a per-pass retirement inventory.

### impl-1992 · 2026-11-19T18:52:15.852Z

Human-exception correction: C6 deterministic post-inventory/post-rename nested rewrite first failed ENOENT (old owner removed the run), then passed with bounded conservative revalidation before rename and immediately before rm, restoring the newly renamed run on changed/unusable metadata. Shared suite-retirement-inventory.ts supplies root device/inode, root/newest mtime and byte/entry facts to discovery and guarded removal. Enabled default cites General2026-11-19 18:36Z/ask2da0c7c7 beside declaration. Live unindexed actual-scheduler scale passed on50,000 roots:4096 visited/4093 directories removed, filesRemoved0, pass wall24.207531375s excluding startup/setup/teardown, task.view4.667625ms<1000ms. This empty-directory result is a floor: populated live runs add inventory and removal IO; lower verification.suite_retention_pass_limit then hub reload to throttle subsequent passes if initial ones run long. Native slot released. Coordinator53ffcc5e approved case52s/file89s,E-880/11-26; indexed case35s retained. No new configured verify submission; old run26ea38da at cdeea1ca0 is prior-head evidence.

### rev-35 · 2026-11-19T19:01:32.331Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1992-source-3
commit: ef8cbf30e4037414a3524333e1f153dde84bb30a
scope: full
findings: [{"severity":"medium","text":"M1 · Standards/rule9: the new scale case owns but does not separately bound its setup; 50k synchronous mkdir/utimes and control/hub/UI acquisition precede the first named wait, while the120s option only bounds waits/teardown. Use a named owned setup deadline plus yielding/admission-checked seed chunks, preserving original-work and resource/root/guard joins on expiry.","file":"hub/test/suite-retention-scale.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Source3 full review pinned to ef8cbf30e4037414a3524333e1f153dde84bb30a/tree3d89d7ed42d34b640e38dca9a5348c5f57aa1afe. A-21858 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21858-t-1992-source3-c6-revalidation-reviewed-scale-setup-bound-missing.md).

Medium M1, Standards/rule9: hub/test/suite-retention-scale.test.ts:22 — setup is owned but not separately bounded. Its synchronous50k seed plus control/hub/UI acquisition occur before the first named wait. caseDeadlines.run/FixtureStep do not bound that setup; the120s option bounds named waits/teardown only. Lead ae3a4eef confirms no additional control or exclusion. Use a named owned setup deadline and yielding/admission-checked seed chunks, retaining existing original-work/resource/root/control settlement.

No additional Spec/source finding: primary Coordinator2af3e8a9 establishes the human exception and revised C4/C6; default-on authority is valid. Shared bounded inventory revalidation before rename/pre-rm and the actual-owner nested rewrite control match C6's conservative option. No native-writer closure or atomic fence is inferred. Docs/census/allowances match the revised behaviour; prior five source1 fixes remain resolved.

Marks: C3 failed; no new verification marks on C1–C6. Source3 configured verification is unexecuted. Prior-head26ea38da/A-21857 is reported green at cdeea1ca0 with T4 unexecuted and is separate evidence. A-21856 local/native working-tree observations are not exact-head proof. No Reviewer runtime/edit performed. Please fix M1 and request fresh exact-head source review before Coordinator mode-free changed-tier verification.

Criteria: C3 failed (New live-unindexed scale fixture has no separate overall setup bound; its50k synchronous seed prevents deadline timers from firing, and async setup/acquisitions precede the first named wait.).

### rev-35 · 2026-11-19T19:08:33.683Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1992-source-4
commit: 667f0d783ee07a0fa4b704720f91707c13ac3e85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear at667f0d783ee07a0fa4b704720f91707c13ac3e85/tree555c0cf1d94d335ef242bf2c096b3ba4f28b3f8d. Standards/Spec: findings=[]. Full source scope; the two-file correction resolves source3 M1: named owned setup deadline encloses all acquisition/seeding/control/hub/UI/task preparation, seed chunks yield and recheck admission before at most32 root writes, and original setup/resource/root/guard joins remain. Captured completion getter preserves live overlap assertions and all final checks.

A-21860 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21860-t-1992-source4-clear-separate-owned-setup-bound-and-joined-seed-chunks.md). Production C6/default-on authority/allowances are unchanged from reviewed source3; no additional source finding. Human exception and conservative C6 scope remain as authorized.

No criterion marks added: C1–C6 remain runtime-unverified pending current-head configured receipts. A-21859's5 helper controls/lint/typecheck are correction-epoch evidence, not an executed current T4 case. Prior26ea38da/A-21857 at cdeea1ca0 excludes T4 and remains separate. Primary Coordinator43779508 plans mode-free task verification including changed T3/T4, with full integrated T3 in the merge batch. No Reviewer runtime/edit performed. Any head/default change requires fresh source review.

### rev-35 · 2026-11-19T19:37:14.416Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1992-evidence-1
commit: 667f0d783ee07a0fa4b704720f91707c13ac3e85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear at667f0d783ee07a0fa4b704720f91707c13ac3e85/tree555c0cf1d94d335ef242bf2c096b3ba4f28b3f8d. Source4 clearance current; worktree clean/unchanged. Producing17d5e176/A-21877 passed at this head. Full audit A-21881 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21881-t-1992-final-clear-exact-head-indexed-and-live-unindexed-runtime-evidence.md).

Independently streamed ordinary7023passed/0failed/0skipped/0cancelled (6878top-level+145nested),729passing files; all starts/finishes match, no duplicate identities. Separate70passing load tests/70envelopes:14authored T1/T2 cases each5distinct current-run passes; current IDs do not reuse prior26ea38da. Exact manifest completion:232T1,441T2(including44Neovim/385tests),55Web and changed T4 scale file. T3 deferred to integrated merge batch; other T4 unexecuted. Changed T4's3cases each run once, no repetitions claimed.

C1 indexed replay accepted by Coordinator plus current pin/age keep controls; C2 age/cap parser, frozen compatibility and help receipts; C3 all3T4 scales; C4 exact default/report/deletion class/retained-byte controls; C5 historical criterion-only protection, constructor-failure close and positively controlled10k-row production-query plans; C6 actual-owner equal-length nested rewrite with retained new bytes/restored root. Each required case's producer pass and unchanged final source assertions checked beyond exit0.

Live-unindexed T4:4096scanned/4093removed, pass39.706441176s, task.view4.815299ms<1000ms; case50.417482972s. Indexed4091removed/task.view4.916656ms; actual callback108lookups/task.view3.83862ms. Empty removed directories/filesRemoved0 remain a floor for populated live IO, with the reloadable cap as throttle. C6 is conservative revalidation, not atomic writer fencing or native exit proof.

Uncached canonical verification snapshot fcd1fb9c933d0f15577d7ad21ca89748862b5408; Linuxx64droplet6.8.0-149/Node24.21/Neovim0.12.5,c-8ams3/workers2,lifetime1370.781s/$0.095193125. Actual Chrome Headless Shell1248/Google Chrome for Testing156.0.8078.4. T0/T1/T2/T4/Web exit0; lint/duration advisories report-only, T4 has no tier budget. Prior-head/working-tree/incomplete epochs remain separate. No Reviewer runtime/edit. Marks: verified C1,C2,C3,C4,C5,C6. Findings=[]; integrated fullT3 remains merge-batch evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-19T20:26:30.207Z

Merged a8fc01d327616a3800b388a5c1ac1170a410edb0 onto dev.
