---
id: T-1931
kind: task
title: "Nightly soak skipped: one repetition projects 5508 s against the 3540 s usable deadline, so the soak never runs"
state: closed
status: done
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1878
topic: topic-1584
branch: t/T-1931-nightly-soak-skipped-one-repetition
created: 2026-11-17T03:01:41.324Z
updated: 2026-11-17T09:12:54.466Z
closed: 2026-11-17T09:12:54.466Z
---

## Summary

The nightly soak on 2026-11-17 was skipped. The hub reported "soak deadline plan refused: base projection 5508.4 s exceeds 3540.0 s after 20% margin and 60 s overhead". T-1878 made the deadline plan keep real margin or trim repetitions. But when even the base selection (one repetition) does not fit the deadline, the soak is now skipped altogether, so the project loses nightly soak coverage without anyone deciding to.

## Evidence

- Hub report 2026-11-17T03:00:52Z (`soak-skip:2026-11-17`).
- T-1878 (landed 2026-11-16): C1 "fits all selected tiers with real margin or trims repetitions". The previous soak d5150de3 timed out at the deadline with Web unexecuted (A-19799).
- `.cland/config.toml`: `soak = "03:00"`; soak runs `test_soak` (T4) per the tier plan.

## Acceptance criteria

- [x] C1. Name why one repetition projects 5508 s (which tiers and files) against the 3540 s usable deadline, from the plan's own figures.
  - done: impl-1931 · 2026-11-17T05:27:34.655Z
  - verified: rev-36 [reviewer] · run rev-36-1931-source-3 · 2026-11-17T05:39:31.787Z · commit 77ba11346377e1d0816a552955cae6fd5d5978b8
  - verified: rev-36 [reviewer] · run rev-36-1931-source-4 · 2026-11-17T06:18:48.185Z · commit bc57ea25cc5820d44c8909e7f56b1fe4699aa99f
  - verified: rev-36 [reviewer] · run rev-36-1931-final-1 · 2026-11-17T06:55:10.734Z · commit bc57ea25cc5820d44c8909e7f56b1fe4699aa99f
  - verified: rev-36 [reviewer] · run rev-36-1931-delta-1 · 2026-11-17T07:22:32.317Z · commit 84ce9a604d632daf74120d448095c2e3337619c3
  - verified: rev-36 [reviewer] · run rev-36-1931-final-2 · 2026-11-17T08:18:28.876Z · commit 84ce9a604d632daf74120d448095c2e3337619c3
- [x] C2. The soak keeps running within its deadline: trim the base selection by tier or file in a recorded, rotating order, or split it across nights. A refused plan reports what it dropped and why, and a soak is never skipped silently (test over a fake duration manifest).
  - done: impl-1931 · 2026-11-17T06:07:56.731Z
  - verified: rev-36 [reviewer] · run rev-36-1931-final-1 · 2026-11-17T06:55:10.734Z · commit bc57ea25cc5820d44c8909e7f56b1fe4699aa99f
  - verified: rev-36 [reviewer] · run rev-36-1931-final-2 · 2026-11-17T08:18:28.877Z · commit 84ce9a604d632daf74120d448095c2e3337619c3
- [x] C3. A skipped or trimmed soak is visible in the heartbeat or digest as unexecuted coverage, never as a pass (rule 17).
  - done: impl-1931 · 2026-11-17T05:27:35.256Z
  - verified: rev-36 [reviewer] · run rev-36-1931-final-1 · 2026-11-17T06:55:10.735Z · commit bc57ea25cc5820d44c8909e7f56b1fe4699aa99f
  - verified: rev-36 [reviewer] · run rev-36-1931-final-2 · 2026-11-17T08:18:28.877Z · commit 84ce9a604d632daf74120d448095c2e3337619c3

## Comments

### coord · 2026-11-17T04:45:20.465Z

Coordinator decision (topic-1584). Root cause per impl-1931: T-1878 replaced the worker projection (2277 s + 993 s file overhead = 3270 s) with the serial sum (5508 s), which never fits 3540 s. Reverting is not acceptable, because the worker model under-projected soak d5150de3 (about 4480 s actual for T0–T4, timed out; A-19799). Fix: calibrate the base projection against observed soak durations, keep T-1878's margin, and use rotating file trim when the calibrated base still doesn't fit. A trimmed or skipped plan reports unexecuted coverage.

### impl-1931 · 2026-11-17T04:48:57.534Z

Consumer inventory (rule20): soakDeadlinePlan producer/caller suite-load-gate-plan.ts, hub/suites.ts; shared selection consumers suite-selection.ts (parse/describe/cache), suite-shards.ts/packageShards, verification-occasion.ts/tier selection, verification-commands.ts, executor/local.ts and executor/droplet/run.ts transport, suite job persisted readers and heartbeat.ts, dispatch.ts notice/result publication. Existing shard/nvimTests/batchTests.Web masks reused; no fields removed or wire fields added. Search for soakDeadlinePlan, onSoakNotice, verification-soak-skipped, soak-attempt, soak-skip across hub/nvim/web/shared/docs/qa/.agents found suites.ts, dispatch.ts, suite-load-gate-plan.ts, suite-soak-component.test.ts(T2), suite-scheduling.test.ts(T1), suite-load-gate-plan.test.ts(T1), suite-soak.test.ts(T1). Timeout/progress consumers suite-hung-component.test.ts(T2), suite-hung.test.ts(T3) remain unchanged; no T4 direct skip reader. Docs running.md, tests.md, per-file guides and implement skill describe policy. Skip notice keeps id/callback/string shape; new private meta keys default absent on older stores; existing selection fields retain prior parsing. Trimmed soak cache and full coverage-map reduction disabled to prevent partial coverage reuse.

### rev-36 · 2026-11-17T05:09:33.229Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1931-source-1
commit: eaf46471138636f6ab9e926a1aded15d26c98caf
scope: full
findings: [{"severity":"medium","text":"SUITE_USAGE adds a soak guidance line but the frozen commands.json block is unchanged. cli-usage-compatibility.test.ts:9 deepEquals all usage exports and cli-help also consumes the frozen bytes, so required existing consumers deterministically disagree. Migrate the intended block in hub/test/fixtures/cli-usage/commands.json without weakening the compatibility assertion.","file":"hub/src/cli/usage/suite.ts","line":2},{"severity":"medium","text":"The new rotation callback enters raw suiteUnit(t), then performs FS setup, scheduler steps and reopen outside a pre-acquisition whole-case owner. suiteUnit owns tracked submissions/resources but not these caller continuations; its root/store cleanup can race the still-admitted body. Use existing shared whole-case ownership before acquisition and join/fence the full sequence before disposal.","file":"hub/test/suite-soak-component.test.ts","line":328},{"severity":"medium","text":"Dynamic calibration subtracts hosting-clock lease.execution.startedAt from remote native /done job.finished with no clock-domain conversion. Drift can persist an unsafe observed/projected factor and change future trimming/refusal. The interval also excludes the earlier local T0 host gate despite docs claiming it includes T0. Use positive same-owner elapsed evidence (or explicit unknown/floor) and accurately name included phases; retain complete-file requirements and deadline reserve.","file":"hub/src/hub/suites.ts","line":1730}]
finding_counts: {"high":0,"medium":3,"low":0}

Standards2medium; Spec1medium. A-20642 full review at eaf464711/treecef8e847 vs20202e0c. Missing frozen SUITE_USAGE fixture migration deterministically disagrees with cli-usage-compatibility/cli-help; update intended command block retaining assertions. New rotation T2 case raw suiteUnit lacks caller setup/body join before store/root disposal. Dynamic observed duration mixes host lease.execution.startedAt with remote job.finished and omits preceding host T0 despite docs claim; use positive same-owner elapsed evidence or explicit unknown/floor. All three acknowledged without probes. C1 independently reconstructed from pinned tier/duration JSON:993files,median1.161886,serial+overhead5508.409715875s versus3540s usable; T3base3382.8412dominates, original historical file membership unavailable. C3nominal heartbeat/store/log omission wiring and trimmed cache/map guards inspected, unverified pending corrected head evidence. A-20639 retains original candidate excerpts/epochs/gaps, planner3/heartbeat2/selectedscripted3/soak29,hubtyping0/lint0refusals and report-only122/59,wording0/indexcurrent; no exactheadconfigured/browser/native proof. Full54consumer rows retained. No Reviewer runtime/compiler/lint/generator/provider/browser/timing/cancellation experiment or edit/rerun, no merge. Fresh corrected committed-head source request before window.

Criteria: C2 failed (Dynamic calibration subtracts host-clock admission from remote /done without a duration owner/conversion, and the new rotation callback lacks whole-case setup/body ownership; deadline/rotation evidence is not source-clear.).

### impl-1931 · 2026-11-17T05:15:56.406Z

Review correction consumer addendum: suite runner started is an additive advisory runner-log line (run.sh producer, soakExecutionSeconds reader via Suites calibration), no RunStatus or wire field extension. Existing run.sh consumers/pins: hub/src/executor/droplet/run.ts; hub/test/executor-run.test.ts(T3), executor-prepare.test.ts(T3), executor-prepare-component.test.ts(T2), scenarios/droplet-verify.test.ts(T3), executor-run-rules.test.ts(T1); generic log parsers suite-progress.test.ts(T1), suite-summary.test.ts(T1), durations-runner.test.ts(T3). All named for serial fake-provider checks under Coordinator native slot; pending completion, no pass claimed. Legacy planted-log readers durations.test.ts/durations-refresh.test.ts preserve earlier logs, deferred. host-agent closure generator follows entry imports and native URL assets; run.sh is absent from that graph/closure, T1 closure check planned. CLI help byte consumers cli-usage-compatibility.test.ts(T1), cli-help.test.ts(T2), cli-usage-fixture.ts now migrate only fixture SUITE_USAGE value; compatibility assertion unchanged. New rotation callback owns setup/body/FS/reopen through pre-acquisition shared caseDeadlines and adopted root. Dynamic calibration uses native remote start + remote /done on same clock, unknown/floor for missing/invalid/duplicate markers; host T0 excluded and documented. No source merge after first review.

### impl-1931 · 2026-11-17T05:22:55.276Z

Strict runner-log marker retention addendum: suite-log.ts is an additional semantic reader and now retains only the exact exported SOAK_RUNNER_STARTED UTC-second line. suite-summary and result/artifact-chip publication consume retained evidence through hub/suites.ts and hub/dispatch.ts; this additive line does not contribute test counts/status. Matching semantic parser consumers: hub/test/suite-phase.test.ts(T1), suite-cover.test.ts(T1), suite-summary.test.ts(T1), suite-log-backfill.test.ts(T2), web-phase.test.ts(T1), suite-command.test.ts(T1), dev-t3-search.test.ts(T1); tests default to their existing legacy logs, no field migration. New T1 summary positive control failed null!==3 before filter widening and passes after; malformed runner-like noise stays excluded and old logs yield unknown. T2 rotation initially planted millisecond ISO unlike native date second format; strict parser rejected it, fixture now matches producer UTC-second bytes. Native runner list remains the previously completed development receipt; log retention source changed afterwards, so native runs do not claim this later tree.

### rev-36 · 2026-11-17T05:33:29.187Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1931-source-2
commit: d8cb270de2a7762b0ab760e9dc15a388760d8dda
scope: full
findings: [{"severity":"medium","text":"soakExecutionSeconds splits, maps and filters the complete retained semantic log into arrays to find at most two markers. Evidence has no fixed byte/count bound, so completion adds whole-history transient allocations contrary to rule23 and suite-log.ts's incremental line policy. Scan incrementally with bounded extra storage and stop on the second marker (or share a pure iterator leaf without native imports/cycles); keep positive/missing/duplicate controls. No runtime reproduction was performed.","file":"hub/src/suite-load-gate-plan.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards1medium; Spec0. A-20654 full pass atd8cb270de/tree2abe3124 vs20202e0c. All3A-20642 findings resolved: exact SUITE_USAGE fixture now matches export/assertion unchanged; rotation whole-case shared ownership enrolled before acquisition/adopts root/joins setup-body; dynamic elapsed uses same-remote-clock start plus /done, with hostT0 excluded and unknown retaining prior/floor. New M at suite-load-gate-plan.ts:15 uses whole-log split/map/filter arrays; semantic evidence has no byte/count bound, claimant520af00d confirms. Scan incrementally, stop second valid marker, preserve pure seam; existing log-backfill50MB tests do not cover this helper. C2failed; C1/C3unverified. Current manifests unchanged993files/5508.409715875s vs3540s, historical membership limits retained. Shared exact marker retention/legacy absent behavior, all47closure hashes and no run.sh generated membership independently checked. Full80consumer rows retain previous54+new native/semantic/artifact readers. A-20653 serial candidate epochs/ninefiles positives preserved, postfilter summary5/selected3/backfill5 and staged planner4/help1; not exact-head configured/Linux/browser/nativeperformance proof. Lint122report-only/0refusals, wording/index/typecheck claimant receipts retained. No Reviewer runtime/compiler/lint/generator/probe/edit/retry/merge. Fresh corrected source review before configured window.

Criteria: C2 failed (New soakExecutionSeconds allocates split/map/filter arrays across an unbounded retained semantic log; use incremental scanning with bounded extra storage before calibration is source-clear.).

### rev-36 · 2026-11-17T05:39:31.787Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1931-source-3
commit: 77ba11346377e1d0816a552955cae6fd5d5978b8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0; Spec0. A-20659 full source clearance at77ba11346/tree95a3e667, direct child/no dev merge. Three-path correction removes retained-log split/map/filter; shared anchored regex cloned gm requests first/second result only, stops on ambiguity, bounded extra result storage, no native/cyclic import. Pure large-log work control red atd8cb then5/5 green bounds regex-result requests, not CPU/heap/wall or live-data performance; prior interval controls intact. Earlier help/exact fixture assertion, whole-case before-acquisition normal/signal/root ownership and same-remote-clock calibration fixes unchanged. All80consumer dispositions retained,47closure hashes/source unchanged, run.sh outside generated closure. C1verified via pinned993files median1.161886 total5508.409715875s vs3540s; historical full file membership/reconstruction limits retained. C2/C3source supported but unverified pending completed same-head configured evidence or explicit waiver. A-20657 dirty candidate planner5/summary5/ONLY3nightly cases, hubtyping0/wording0/lint0refusals with122report-only; staged tree used for typing/lint, no pretest immutable/raw/native-signal receipt. Earlier serial fake-native epochs not current native passes; no T4/Web/Linux/browser/real-soak proof. No Reviewer runtime/tests/lint/generator/probe/edit/retry/merge. After clear request Coordinator window; retain positive exact generated planner/heartbeat/nightly/summary identities beyond aggregate exit.

Criteria: C1 verified.

### coord · 2026-11-17T06:02:04.052Z

Coordinator note on verify b7230c90 (A-20677). The task verify cannot exercise this item's run.sh change: hub/src/executor/droplet/run.ts:156 uploads the running hub's own run.sh. So the remote start marker is absent from task verifies by construction. The marker gets its real receipt only after this item lands and the hub restarts. Post-landing check (coord): the first nightly soak after the restart shows the "suite runner started" marker in its runner log and a calibrated ratio, or the 2.17 floor if the marker is missing. The run's T2 failure (suite-soak-component notice text) is a missed consumer and is being fixed.

### rev-36 · 2026-11-17T06:05:10.041Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1931-evidence-1
commit: 77ba11346377e1d0816a552955cae6fd5d5978b8
scope: evidence
findings: [{"severity":"medium","text":"Configured run b7230c90 fails this unchanged exact notice assertion: actual includes 'skipped; unexecuted coverage: all selected tiers;' while expected still uses 'skipped:'. This item changed the producer at Suites' skip path without migrating its existing consumer (rule20); source clearance missed it. Update only the intended notice bytes, retaining single-notice, spend and no-droplet assertions, as Coordinator db6ab96e directs.","file":"hub/test/suite-soak-component.test.ts","line":134}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards1medium; Spec0 new production findings. A-20681 checks A-20677/runb7230c90 atsource-clear77ba11346: exact deepEqual failure suite-soak-component:134, actual skipped;unexecuted coverage vs expected old skipped:. Typed failure28983/file29240, detailed diff33420ff; omitted item-local migration acknowledged72b985ce/Coordinator db6ab96e. My source clearance missed it. C2failed/C3unverified; C1arithmetic unchanged. All15requested base cases pass and8new each5typed loads+proof, retained individually; positives do not override failure.5825ordinarypass/1fail,607filepass/1fail,290scopepasses; T0/T1green,T2exit1 (383files pass/1fail/44no finish),Web/T3/T4unexecuted. LinuxdropletNode24.21; browsernull, report-only122lint/budgets. Native marker absent expected: hosting run.ts:156 uploads hosting-source run.sh, not candidate; Coordinator db6ab96e owns first real post-land/restart soak check, current claims fakes/floor only. All80consumer rows updated, no runtime/probe/edit/retry/merge. Release pin for already authorized single assertion correction/fullfile/help/compatibility checks and fresh source review/window.

Criteria: C2 failed (Same-head configured run exits1 at the missed exact cap-skip notice consumer; migrate intended text while retaining notice/spend assertions, then fresh source review.).

### impl-1931 · 2026-11-17T06:07:56.481Z

Configured run b7230c90 failed at77ba11346 on one missed exact cap-notice assertion (A-20677/A-20681). Migrated only that expected string in bc57ea25c; preserved single-notice/restart, no-create and no-extra-spend assertions. Literal skipped: search across hub/test,nvim/test,docs found no other old nightly consumer; remaining distinct periodic/sharding/categories/connection/count formats unchanged. Full T2file39/39, cli-help9/9, compatibility1/1 development checks pass under released Coordinator slot; A-20684 retains failure/partial positives/epoch limits. Hosting run.ts uploads running hubs own run.sh, so no real marker expected in task verify; current evidence fakes/floor only. Coordinator owns first native marker receipt on first nightly soak after landing and hub restart. No configured retry yet.

### rev-36 · 2026-11-17T06:18:48.185Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1931-source-4
commit: bc57ea25cc5820d44c8909e7f56b1fe4699aa99f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0/Spec0. A-20696 full correction source clearance atbc57ea25c/tree69678928, direct child77ba11346/no dev merge. Exactly one assertion literal migrates cap skip notice to intended unexecuted text; exact deepEqual/single-notice restart/no-create/spend checks unchanged. No production/help changes; previous bounded scan/remote-clock/rotation ownership fixes intact. Literal skipped: search has no old nightly hit;15remaining paths have distinct unaffected formats. Full90consumer ledger retains80prior. A-20684 wholeT2file39/help9/compat1 serial candidate0 receipts with dirty/staging/raw/native gaps, not current configured verification. A-20677 remains failed partial, no historical green carry. Coordinator db6ab96e: task uploads hosting hub's own run.sh; real candidate marker deferred to Coordinator first post-land/restart nightly soak, current evidence fake-only/prior-or-floor. C1reverified unchanged accounting993files/5508.409715875s vs3540s with historical membership limits; C2/C3unverified until completed same-head configured evidence or explicit waiver. Request new Coordinator window; retain15required bases,8new5loads and positive cap-notice case. No Reviewer runtime/probe/test/compiler/lint/generator/edit/retry/merge.

Criteria: C1 verified.

### impl-1931 · 2026-11-17T06:53:08.105Z

Completed uncached configured run ea88f987 at reviewed bc57ea25c, verification tree8a828874: T0/T1/T2/Web exit0, aggregate6561pass/0fail/0skip/0cancel. Read-only audit A-20720 confirms all224T1/428T2/55Web required files have positive base completion, all16named controls pass, eight new identities have5pass load finishes plus exact5/5proof lines. T3/T4unexecuted/deferred. Linux x64 c-8ams3 Node24.21.0/nvim0.12.5; HeadlessShell1248 ChromeTesting156.0.8078.4; lifetime1635s cost$0.1135 (not suite wall). Test/duration diagnostics report-only. Prior A-20677 remainsfailed. Hosting-runner marker expected absent; Coordinator owns first native marker on post-land/restart nightly soak; current task marker proof fakes/floor. Await same-head Reviewer final settlement; no head changes.

### rev-36 · 2026-11-17T06:55:10.735Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1931-final-1
commit: bc57ea25cc5820d44c8909e7f56b1fe4699aa99f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0/Spec0. A-20723 independently checks exact source-clearbc57ea25c/tree69678928, completed ea88f987/A-20717 passed. All16required base identities positive incl corrected cap notice28969; all8new each5typed load passes+exact5/5proof; all51target-file cases and4file envelopes pass, entire soak-component39.6561ordinarytest/707filepasses,290loadtest/filepasses,0nonpass/duplicate/unmatched/skips. T0/T1/allT2/Web exit0; manifest224/428/55files complete.269T3/17T4unexecuted, no native/QA/performance carry. Actual LinuxdropletNode24.21/nvim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4; provenance38233execsnapshot8a828874 distinct Git tree69678928, cached:null.122lint/budget/ratchet/skip diagnostics report-only. All90consumer rows updated:30filepass/8deferred/52refs. Source accounting993files5508.409715875s vs3540s retains historical reconstruction limits. A-20677 remainsFAILED prior history. Critical Coordinator db6ab96e disposition retained: task uploads hosting-source run.sh, so native marker absent expected; current marker evidence fake-only/floor, Coordinator owns first real marker at first post-land/restart nightly soak. No actual native calibration/soak wall claimed. C1-C3verified; no Reviewer runtime/probe/test/compiler/lint/generator/edit/retry/merge.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T06:57:02.151Z

Rule 36 preflight (coord, 06:57Z): head bc57ea25c conflicts with origin/dev in suites.ts, suite-log.ts and suite-load-gate-plan.test.ts (T-1582 and T-1576 landed there). Not enqueued. Requested a dev merge (rule 11), a delta review and a new verify. Landing order on these hot files: T-1850 (queued), T-1931, T-1935, T-1848.

### impl-1931 · 2026-11-17T07:06:58.954Z

Coordinator rule11 request d053808f: merged origin/dev1e4bceff once into bc57ea25c, producing84ce9a604/tree1533c016. Three conflict resolutions preserve task soak calibration/rotation with dev per-tier batchBaselineRuns/#batchIdentities, strict marker semantic retention with T-1576 infrastructure prefix, and both planner/positive-completion test groups. Full root typecheck/full test:lint passed; 0refusals and122report-only advisories. Native slot released after requested serial planner6/soak29/component39/summary6/merge-batches87/help9/compat1 allpass at84ce9a604. A-20730 preserves exact checks/epochs and prior-head green limits. Inherited contract consumers confirmed: hub/src/hub/suite-worker.ts, suites.ts, merge-batches.ts, suite-infrastructure.ts, suite-load-gate-plan.ts and corresponding summary/batch/planner tests; no new task wire policy. Delta source review pending, new configured evidence required. Coordinator retains post-land/restart first native marker check.

### rev-36 · 2026-11-17T07:22:32.317Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1931-delta-1
commit: 84ce9a604d632daf74120d448095c2e3337619c3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0/Spec0 for authorized merge delta. A-20740 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20740-t-1931-authorized-merge-delta-and-inherited-allocation-disposition.md records clean84ce9a604/tree1533c016 vs prior bc57ea25c, parents exactly bc57/1e4bceff per Coordinator d053808f once-only merge. Three conflicts preserve soak calibration/cursors/replanning and bounded marker scanner alongside per-tier batchBaselineRuns/#batchIdentities/provenance, dev infrastructure semantic retention, completion-summary plus all5task planner controls. SUITE_USAGE/MERGE_USAGE fixtures independently equal exports; assertions intact. All103 changed paths classified90dev-byte/13combined; all90task consumer dispositions retained. Inherited parser log.split issue is real, not bounded or exempt: Coordinator b327a4f1 explicitly assigns it out of this delta to filed T-1936 regression_of T-1582, independently read back. No silent fix. C1 historical static explanation reverified; C2/C3 await completed configured evidence at84ce, old A-20717 green remains bc57 only. A-20730 local committed-head planner6/soak29/component39/summary6/merge-batches87/help9/compat1 and resolved-byte root typecheck/lint0refusals retained with transcript/raw/native/tree epoch limits. No current-head configured/load/T3/T4/Web/browser/QA/provider or native soak wall claim. Hosting own run.sh boundary unchanged; Coordinator owns first real marker post-landing/restart. No Reviewer execution/edit/merge/retry.

Criteria: C1 verified.

### impl-1931 · 2026-11-17T08:11:14.382Z

Current-head configured run e19ab9f4 at84ce9a604/verification treead730526 passed6736/6736, T0/T1/T2/selectedT3/Web exit0. A-20766 streams A-20763 independently: all224T1/428T2/55Web files positive; selected native executor-run/claude-code-remote/suite-runner files positive with120passing timing identities once/no repetitions; remaining266T3 and17T4unexecuted. All20task+merge controls base/timing pass; eight task-new controls have5pass frames+exact5/5proof;50global proof identities/250load passes. Known T-1935 infrastructure fixture line immediately followed by still-writing text confirmed/reported, no retry per Coordinator. Linux c-8ams3 Node24.21.0/nvim0.12.5 HeadlessShell1248 ChromeTesting156.0.8078.4; executor lifetime1582s cost$0.1099, not suite wall. Advisories report-only; marker post-land/restart Coordinator check and inherited T-1936 disposition retained. Await Reviewer same-head final settlement, clean unchanged head.

### rev-36 · 2026-11-17T08:18:28.877Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1931-final-2
commit: 84ce9a604d632daf74120d448095c2e3337619c3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0/Spec0 within approved scope. A-20773 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20773-t-1931-final-merged-head-evidence-and-coverage-limits.md independently checks completed e19ab9f4/A-20763 at delta-clear84ce9a604/tree1533c016. C1-C3verified:20required named base positives,8task identities each5distinct typed load passes+exact5/5proof,all140cases across5target files,all224T1/428T2/55Web file envelopes.6736ordinarytest/710filepasses,250loadtest/filepasses,zero nonpass/duplicate/unmatched. Selected3native files positive:120top-level timingpass/127typedtestpass incl7nested,once/no native load. Remaining266T3/17T4unexecuted. T0/T1/T2/selectedT3/Webexit0. Actual HeadlessShell1248/CfT156.0.8078.4, LinuxdropletNode24.21/nvim0.12.5, provenance38792 effective treead730526 distinct Git1533c016,cached:null,no skips. All90consumer dispositions:31filepass/7deferred/52refs. Known T-1935 literal pair28651-52 is fixture output, no retry. Explicit inherited T-1936 out-of-scope allocation disposition b327a4f1 retained; not fixed/bounded/exempt. Outer marker0 expected under Coordinator db6ab96e hosting-source boundary; first real nightly marker remains Coordinator post-landing/restart responsibility, no new production interval claim. Budget/lint report-only; old A-20677 FAILED and prior receipts/limits retained. No Reviewer test/compiler/lint/generator/probe/browser/provider/edit/merge/retry.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T09:12:54.466Z

Merged 66bca5453d8c0fbd66b5f3fd725256221a4a08f1 onto dev.
