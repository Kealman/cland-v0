---
id: T-1893
kind: task
title: "Light landing: T1 plus affected T3"
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1528
  - T-1582
topic: topic-1678
branch: t/T-1893-light-landing-t1-plus-affected-t3
created: 2026-11-16T07:29:45.541Z
updated: 2026-11-20T18:22:27.136Z
---

## Summary

After T-1528's report, a batch runs T1 plus the T3 files that import the members' changed modules. A full-T3 batch runs when 3 or more members wait, or for hub-behaviour diffs. Merges impl #1 and §7 #6 option 3.

Kind: product + config. Triage ticket H-5 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes rule 6 (T1+T3 batch as the pre-merge full suite; ask 31d43750, Discord 11-02) and `merge.batch_tiers`, `merge.batch`, `merge.batch_wait`. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. T-1528's replay shows which v0.4.0 T3-only red batches (T-1819, T-1666, T-1553, T-1644) the importer selection catches and which it misses (evidence).
  - done: impl-1893 · 2026-11-20T17:56:04.059Z
- [ ] C2. An affected-T3 batch runs T1 and only the importer T3 files, and a batch of 3 or more members or with a hub-behaviour member runs the full T3 (test).
  - failed: rev-35 [reviewer] · 2026-11-20T18:12:22.156Z · note New policy test setup lacks its separate complete bound and the T3-mask contract misses periodic whole-coverage consumers (M3/M4).
- [ ] C3. T-1582's per-tier baseline holds for partial-T3 batches (test).
  - failed: rev-35 [reviewer] · 2026-11-20T18:12:22.156Z · note Unbounded skipped-history visits and unrelated-tier budget consumption break bounded per-tier proof fallback (M1/M2); partial coverage must also remain scoped (M4).

## Dependencies

T-1528, T-1582

## Comments

### impl-1893 · 2026-11-20T17:37:29.454Z

Consumer audit: batchTests producers suite-interactions and suite-load-gate-plan; decoder/cache suite-selection; wire mirror shared/wire; executor transport and pinned/persisted jobs retain selection; planner suite-shards applies masks. Searches across hub/shared/web/nvim/docs/.agents/qa include every test tier. Existing old-shape selection regression retained. New optional T3 mask tested through batch admission and planner. No taskDurationSelection changes; coordinated with T-1901.

### impl-1893 · 2026-11-20T17:50:36.877Z

C1 evidence A-22196: retained T-1819 candidate importer replay catches daemon/tracker (3 generated failures); remaining 3 exact candidates not retained, importer-only outcomes unknown. Original deciding-file receipts prove all four full-T3 production triggers. Shared scan-and-publish helper initially refused local artifact-root source path; exported that false positive as id/hash and retry passed both scanners with generated positive control. T1 focused six cases pass, full typecheck passes; full lint exit0 with advisory findings and zero refusals. Reachable T1 run in progress (98 files incl 3 unknown graphs). C2/C3 tests were observed red before fixes. Original 136-case batch run 134 pass/2 fail due superseded red-ignore expectation; revised focused controls now pass, full rerun pending.

### impl-1893 · 2026-11-20T17:51:16.303Z

Consumer audit addendum: optional BatchSuite.waiting is captured by MergeBatches from the queue and read only by Suites policy; legacy jobs fall back to pinned member count. Both protocol/wire declarations migrated; old wire shape is explicitly planned as full T3 in the new regression. Internal batchBaselineFileRuns is persisted and pinned with the job and retained-run references include every per-file source; status/wire shape remains unchanged. Report summary distinguishes affected T3 file count and deferred remainder. No CLI help exports or pinned config changed; batch size/wait retained by Coordinator decision.

### rev-35 · 2026-11-20T18:12:22.156Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1893-source-1
commit: 6fb4d292e6d0f3ced98c0dba3ae7d2154338876f
scope: full
findings: [{"severity":"medium","text":"M1: qualifying-receipt hydration cap does not bound skipped-summary visits; each tier can scan all retained ineligible jobs on every admission. No index/checkpoint or work-count control covers that path. Bound summary work and test skipped retained history, not only suiteJob reads.","file":"hub/src/hub/suites.ts","line":1011},{"severity":"medium","text":"M2: receipt count increments before checking the requested tier, so32 newer T1-only receipts exhaust T3's budget and hide its older valid proof. Make the32-receipt budget genuinely per tier and add a mixed-tier history regression.","file":"hub/src/hub/suites.ts","line":1017},{"severity":"medium","text":"M3: new guarded policy/baseline callbacks bound only suiteUnit creation as setup; subsequent seed writes/history reopening remain outside separate setup bounds. Existing whole-body join and positive cleanup/guard fence are present, but do not supply the missing complete setup boundary.","file":"hub/test/merge-batches.test.ts","line":152},{"severity":"medium","text":"M4: batchDevT3Cover ignores the new batchTests.T3 mask; completeTierPlanReason proves command completion rather than complete file inventory, so a partial importer batch can suppress full periodic T3 through Suites:1512. Migrate whole-coverage consumers and test previous/full/partial shapes.","file":"hub/src/dev-t3-coverage.ts","line":26}]
finding_counts: {"high":0,"medium":4,"low":0}

Consolidated A-22204: four medium findings; Standards M1/M3/M4, Spec M2. Implementer ac5bd48c/b6c8c3ad confirm the gaps. Coordinator787e95ad expressly retains exact-head T1 omission and directs first3 fixes; no T1-omission finding remains. Named full triggers, per-file red fencing, old wire shape, transport/mask/cache semantics and retained source ids otherwise reviewed. C1 replay A-22196: T1819 raw candidate catches daemon/tracker's3 failures; other3 candidates positively missing in current Git inspection, importer-only results remain unknown. All4 recorded production deltas trigger fullT3 under approved policy. No partial verification mark on not-clear pass. A-22201 remains qualified precommit/failed-round evidence, no configured proof. Correct together, fresh source review, then Coordinator-owned full verify-all per launch brief. Reviewer performed only static/Git/log inspection; hold released.

Criteria: C2 failed (New policy test setup lacks its separate complete bound and the T3-mask contract misses periodic whole-coverage consumers (M3/M4).), C3 failed (Unbounded skipped-history visits and unrelated-tier budget consumption break bounded per-tier proof fallback (M1/M2); partial coverage must also remain scoped (M4).).

### impl-1893 · 2026-11-20T18:22:27.136Z

Review correction consumer sweep: shared wholeSuiteSelection now guards batch/full-periodic suppression, fresh integrated-cover suppression, stage cover and cached source, release T3 cover, full-stage load baseline and whole integrated coverage recording. Compact history retains batchTests mask presence (empty array flags) and duration subset presence. Per-file batch baselines intentionally retain partial receipts but intersect each mask and actual current-tier files. sameSuiteSelection already compares complete masks; shard planning excludes batches and is not a coverage proof; member verification proves T1 (no T1 mask) plus ordinary selected T2, so it is not a full-T3 consumer. Package planner and per-file baseline share tierTestMask. Searches covered field names, mode/soak/tiers predicates and function callers across source/tests/docs/skills, not only importers. New native-free controls cover restart, empty/nonempty masks, full-stage baseline, periodic batch and fresh-cover scheduling.
