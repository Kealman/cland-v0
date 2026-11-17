---
id: T-1931
kind: task
title: "Nightly soak skipped: one repetition projects 5508 s against the 3540 s usable deadline, so the soak never runs"
state: open
status: in progress
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
updated: 2026-11-17T05:15:56.406Z
---

## Summary

The nightly soak on 2026-11-17 was skipped. The hub reported "soak deadline plan refused: base projection 5508.4 s exceeds 3540.0 s after 20% margin and 60 s overhead". T-1878 made the deadline plan keep real margin or trim repetitions. But when even the base selection (one repetition) does not fit the deadline, the soak is now skipped altogether, so the project loses nightly soak coverage without anyone deciding to.

## Evidence

- Hub report 2026-11-17T03:00:52Z (`soak-skip:2026-11-17`).
- T-1878 (landed 2026-11-16): C1 "fits all selected tiers with real margin or trims repetitions". The previous soak d5150de3 timed out at the deadline with Web unexecuted (A-19799).
- `.cland/config.toml`: `soak = "03:00"`; soak runs `test_soak` (T4) per the tier plan.

## Acceptance criteria

- [x] C1. Name why one repetition projects 5508 s (which tiers and files) against the 3540 s usable deadline, from the plan's own figures.
  - done: impl-1931 · 2026-11-17T04:52:54.417Z
- [ ] C2. The soak keeps running within its deadline: trim the base selection by tier or file in a recorded, rotating order, or split it across nights. A refused plan reports what it dropped and why, and a soak is never skipped silently (test over a fake duration manifest).
  - failed: rev-36 [reviewer] · 2026-11-17T05:09:33.229Z · note Dynamic calibration subtracts host-clock admission from remote /done without a duration owner/conversion, and the new rotation callback lacks whole-case setup/body ownership; deadline/rotation evidence is not source-clear.
- [x] C3. A skipped or trimmed soak is visible in the heartbeat or digest as unexecuted coverage, never as a pass (rule 17).
  - done: impl-1931 · 2026-11-17T04:52:55.316Z

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
