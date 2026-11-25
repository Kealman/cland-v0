---
id: T-2037
kind: task
title: "Verify admission takes 90–150 s under a crew-sized load (CLI exits 75): trace the dominant cost and bring admission inside the CLI reply wait"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1778
branch: t/T-2037-verify-admission-takes-90-150-s-under-a
created: 2026-11-20T17:55:35.281Z
updated: 2026-11-25T12:10:39.378Z
closed: 2026-11-25T12:10:39.378Z
---

## Summary

On 2026-11-20 between 17:46Z and 17:56Z, with eight implementers and two reviewers live and one merge batch running, droplet verify admission took about 90–150 s per submission:
- impl-1655 submitted at 17:48:08 and was admitted at 17:49:35.
- impl-1638 submitted at about 17:52 and was admitted at 17:53:43; its CLI had already exited 75.
- impl-1865 was still unadmitted after more than 2.5 minutes.
- One submission was refused with "droplet API reachability probe failed: DigitalOcean 0 deadline: request deadline reached", and the next one, 90 s later, was admitted.

Meanwhile the hub ran at 70–94% CPU.

The web workbench's events.list polling (the old C3) was split into its own S task by the 0.4.1 re-triage A-22763, which the human approved on ask 0d31338f. This task keeps the admission trace and fix. It shares a lane with T-1928 (admission takes about 40 s of repeated candidate lint and planning).

## What to build

Find what dominates admission time under this load: the provider probe, the tree bundle, the scheduler, or hub event-loop saturation. Then bring admission well inside the CLI's 90 s reply wait.

## Acceptance criteria

- [x] C1. The dominant admission cost under a crew-sized load is named from a trace (diagnostic).
  - done: impl-2037 · 2026-11-25T08:34:57.928Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2037-source2 · 2026-11-25T08:48:38.939Z · commit df0cf4dd852c1ec3e37af7a6de66b6de2db842fb
  - verified: rev-40 [reviewer] · run rev-40-20261125-2037-source3 · 2026-11-25T08:58:26.039Z · commit ca475bac4a137b54fe63fc0a31ce3110183d74fc
  - verified: rev-40 [reviewer] · run rev-40-20261125-2037-source4 · 2026-11-25T09:32:33.203Z · commit 5e2c012a02e8b96a3c5dbf73bd62cdc53eaa9d2d
  - verified: rev-40 [reviewer] · run rev-40-20261125-2037-final · 2026-11-25T11:37:40.749Z · commit 5e2c012a02e8b96a3c5dbf73bd62cdc53eaa9d2d
- [x] C2. Admission under a crew-sized load completes within the CLI reply wait in a reproducible test or measurement (test).
  - done: impl-2037 · 2026-11-25T10:53:42.697Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-2037-final · 2026-11-25T11:37:40.749Z · commit 5e2c012a02e8b96a3c5dbf73bd62cdc53eaa9d2d

## Comments

### coord · 2026-11-24T18:03:52.897Z

Scope input from T-1928 (pushed at 0a0296c81, in source review; measurements on T-1928 and in A-23075). After its caches, cold admission is about 10.5 s. The remaining main costs are the immutable and worktree tier lints at about 2 s each, cold, and tier planning at about 1.2 s, probably from repeated duration YAML parsing. These are this lane's next targets; T-2037 follows T-1928 in the same lane. Build on T-1928's source-keyed caches, not a parallel path.

### impl-2037 · 2026-11-25T08:32:00.117Z

Consumer census: parseDurationManifest/readDurationManifest are used by suite-shards (immutable and worktree lint), suite-tier-report, suite-duration-context, suite-selection, suite-retention, hub/suites, hub/enqueue-timings, tracker/tracker; tool consumers are durations.ts, lint-tests, lint-repository-tier-plan, run-suite, selection-replay and measure-memory.test. Direct tests include suite-duration-budget and suite-duration-context; broad duration module importers include durations-refresh, durations-runner-budget, merge-budget, suite-tiers, suite-runner, web-phase, suite-load-gate-plan, duration-legacy, heartbeat, suite-soak-component and suite-admission-native. Skill/QA/docs and raw DURATION_MANIFEST searches found no wire-shape consumer requiring migration. Only internal duplicate-analysis reuse changes: fresh JSON values, warnings, owner/expiry and identity validation stay per call. suiteCandidate gains an optional phase profiler; callers keeping its previous single environment argument are unchanged. C1 trace leaves worktree tier lint and tier planning as the dominant overlapping concurrent phases, around 1.7–2 s each; follow-up T-2103 tracks them.

### rev-40 · 2026-11-25T08:37:29.788Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-source1
commit: 26222e36ed850d037cf69cd9fc0f032c6e1099ae
scope: full
findings: [{"severity":"medium","text":"M1: new concurrent proof lacks pre-acquisition whole-case setup/request ownership and positive-close restoration fence; Promise.all rejection can leave siblings running as early t.after restores native/Git seams.","file":"hub/test/suite-admission-cost.test.ts","line":158},{"severity":"medium","text":"M2: cached rendered duplicate warnings are unbounded; only source-key characters count toward4Mi, while repeating a long first value amplifies retained warning payload.","file":"hub/src/suite-durations.ts","line":181}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; both medium gaps confirmed by implementerda8d7bc0. A-23335 records full Standards/Spec findings and consolidated next-clear bar: own/bound entire crew proof before acquisition, join all request siblings on failure/cancel, require positive hub/candidate closure before root/seam/spy restoration; retain bounded compact duplicate facts or bound full retained payload while collecting, preserve exact warning replay and fresh/changed JSON behavior, add amplification/eviction proof. Coordinator-approved C1 trace/C2 five scoped measurements remain accepted scope (f268bf17,d2a8425d); T-2103 owns remaining optimization. No new provider/live-hub campaign or full run requested. Current local52passes/fivecrews/partialimportgraph remain scoped, not configured proof. C2failed; C1 final unmarked. No Reviewer execution/edits.

Criteria: C2 failed (New crew regression lacks complete setup/sibling/cleanup ownership and cache retains unbounded rendered notice payload; correct M1/M2 before verification.).

### rev-40 · 2026-11-25T08:48:38.939Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-source2
commit: df0cf4dd852c1ec3e37af7a6de66b6de2db842fb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23337. M1 newcrew nowstageCase-owned before acquisition, independently bounded setup/body, all request siblings/candidate computations retained, projectHub lifecycle+verification/stopped receipts gate root and Git/spy/native restoration. M2 stores bounded numeric source-range facts, never rendered notices; collection/entry/source/fact limits and exact replay/eviction/amplification controls preserved. Public parser/DURATION_MANIFEST semantics unchanged. C1 diagnostic verified within Coordinator scope; remaining1.7–2s worktree-tier-lint/tier-plan belongsT-2103. C2 final pending configured exact-head receipt/crew wall; corrected4971.7ms and54localcases remain scoped macOSNode24.21 fake dry-run author evidence, not Linux/provider/fullclosure. Historical red/fivewalls retain own head/scope. C2donecheckbox still unset after priorfailure; claimant restore. No Reviewer execution/edits.

Criteria: C1 verified.

### rev-40 · 2026-11-25T08:56:39.683Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-evidence1
commit: df0cf4dd852c1ec3e37af7a6de66b6de2db842fb
scope: evidence
findings: [{"severity":"medium","text":"New hub-test-suite-admission-cost.test.ts.md guide is absent from the per-test index, failing required T1 test-docs membership gate.","file":"docs/agents/tests/index.md"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23344. Literal failure A-23343: AssertionError[ERR_ASSERTION]: each per-test document must be indexed exactly once; expected diff names hub-test-suite-admission-cost.test.ts.md. Pinned index lacks that new row. T0exit0/T1exit1; T2/T3/Web unexecuted (not zero/pass), T4unexecuted; no Linux crew wall. This is docs-index integration failure, not demonstrated cache timing failure. C1 prior diagnostic remains verified; C2failed. Source2 M1/M2 conclusions retained. NoncachedLinuxx64 c8nyc1 workers2 Node24.21/Nvim.12.5; browsernull/unexecuted; budget/lint notices report-only. LocalMac evidence remains partial. Lead handles correction; changed head requires fresh source review before verification. No Reviewer execution/edits.

Criteria: C2 failed (Configuredc75959f1 failed T1 docs-index gate before T2crew regression; no completed Linux admission/caller proof.).

### rev-40 · 2026-11-25T08:58:26.039Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-source3
commit: ca475bac4a137b54fe63fc0a31ce3110183d74fc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Index correction source clear; A-23346. Complete source2→newhead diff is one matching sorted test/guide index row, resolving A-23344 without changing index assertions. Production/test sources and full M1/M2 ownership/bounded-parser review A-23337 retained byte-identically. A-23345 local test-docs4/4 plus reported typecheck/lint0 are scoped author checks. C1 diagnostic refreshed; C2done restored, final pending new configured exact-head receipt/Linuxcrew wall. Historicalc75959f1/A-23343 remains failed with laterphasesunexecuted. No Reviewer execution/edits.

Criteria: C1 verified.

### impl-2037 · 2026-11-25T09:27:27.867Z

C2 measurement now recorded from A-23356, run 11274f5e-c2f3-4bb5-8ca3-e587a68db17f at ca475bac4: ten concurrent admissions completed in 27719.6 ms scoped crew wall against the 90 s CLI wait on Linux c-8 workers2 Node24.21.0. Provider probe, acquisition, tree delivery and suite execution excluded. Complete test duration29.971s includes setup/cleanup and exceeded runner5s budget; overall T2 receipt exit1, result cause empty, T3/Web unexecuted. Positive case proof is retained independently of failed overall evidence. No duration allowance approved; replacing the recurring ten-request proof with three while preserving repository-scale duration metadata and one-tokenization assertion.

### rev-40 · 2026-11-25T09:27:37.515Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-evidence2
commit: ca475bac4a137b54fe63fc0a31ce3110183d74fc
scope: evidence
findings: [{"severity":"medium","text":"Required configured T2 ends complete exit1; new admission proof prints29.971s>5s duration-budget diagnostic. Gate disposition/attribution needed; structured producer cause remains empty/unknown.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23357. Exact-head11274f5e/A-23356 code1/causeempty, T2completioncomplete exit1; do not infer native cause from printed text. Literal diagnostic: duration budget: hub/test/suite-admission-cost.test.ts::ten concurrent admissions share repository-sized duration tokenization29.971s>5s(add to hub/test/durations.json with a reason); suite test failures[]. Case structuredpass29.971228859s; separate crew diagnostic27719.6mswall is positive inside90s and excludes provider/treebundle/setupcleanup, not whole-suite timing. T0/T1exit0, T3/Web/T4unexecuted; Browsernull. C1diagnostic retained; C2finalfailed with positive subproof preserved. NoncachedLinuxx64 c8nyc1 workers2 Node24.21/Nvim.12.5. Lead/Coordinator attribution/next-run decision required; sourceheadfixed until correction/review. HistoricalA-23343staysfailed. No Reviewer execution/edits.

Criteria: C2 failed (Final configured evidence failed in T2; positive scoped crew wall27.7196s<90s retained, not a latency assertion failure. T3/Web unexecuted.).

### rev-40 · 2026-11-25T09:32:33.203Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-source4
commit: 5e2c012a02e8b96a3c5dbf73bd62cdc53eaa9d2d
scope: full
findings: [{"severity":"low","text":"L1: guide says prior overall run failed its duration budget; producer selected cause was empty/unknown. Say run failed with printed duration-budget diagnostic, preserving that distinction.","file":"docs/agents/tests/hub-test-suite-admission-cost.test.ts.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

Source4 clear; one low docs wording finding, no high/medium. A-23362. Complete delta test+guide only; production/cache/M1owner unchanged. Recurring3requests retain exact one-tokenization and complete setup/sibling/candidate/positive-close fences; metadata distributed3dynamic sources with reduced physical-path scope documented. Coordinatorc20f3980/34cc96ba accepts15-to1red and retained10requestLinux27.7196s measurement; no further shrink/allowance here. C1refreshed; C2positive measurement preserved at its actual oldhead/failedoverallrun, final exact-head configured receipt pending. CurrentMac8/8,docs4/4,1139.7msfullcase/452.9ms3request remain scoped author evidence, not speedup/Linux/fullpass. Historicalfailedrounds retained. No Reviewer execution/edits.

Criteria: C1 verified.

### rev-40 · 2026-11-25T10:53:28.599Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-evidence3
commit: 5e2c012a02e8b96a3c5dbf73bd62cdc53eaa9d2d
scope: evidence
findings: [{"severity":"medium","text":"Required configured run interrupted during T3: producer143/cause run timeout75m; secondary package closure incomplete/machine deletion required. T3/Web lack completion; positive T0–T2 is partial proof."}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-23377. Exact-head605c4346/A-23376 producer143 primaryrun timeout75m, secondarypackageclosureincomplete/machinedeletionrequired; preserve structured hierarchy. Canonical23eb64bf executablematch. T0/T1/T2completeexit0;T3partial/no complete receipt,Web/T4unexecuted. Current3requestcasepass3.361763254s, separate1577.4msreplywall,5/5load; below5snewgate,2sadvisoryonly. All19parserbases/newcachecontrols5/5positive. C1diagnostic retained,C2finalincomplete; original10request27.7196s keepspriorhead/failedoverallroundscope. Source4lowL1remainsrecorded. No Reviewer retry/sourcechange; lead/Coordinator run-limit disposition governs. Newlyadmitted a843bfd6 is pending, not evidence of completion; this verdict covers605c4346only.

Criteria: C2 failed (Final configured evidence incomplete at T3 timeout; current3request/pass+5/5 and prior10requestmeasurement remain positive scoped subproof, not a complete run.).

### rev-40 · 2026-11-25T11:37:40.749Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2037-final
commit: 5e2c012a02e8b96a3c5dbf73bd62cdc53eaa9d2d
scope: evidence
findings: [{"severity":"low","text":"ExistingL1: prior run's selected cause was empty/unknown; guide should say failed with printed duration-budget diagnostic rather than asserting that cause.","file":"docs/agents/tests/hub-test-suite-admission-cost.test.ts.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear with existinglowL1; A-23385. Exact-heada843bfd6/A-23384 producer0/causeempty and allT0/T1/T2/T3/Webcomplete0; canonical23eb64bf executablematch. C1acceptedtrace/T-2103retained. C2Coordinator-approved10request27.7196s<90s remains atoldca475bac4/failedoverall11274f5e scope; currentcompleteconfiguredrun suppliesfinalintegration. Current3requestcasepass2.824163935s/separate1413.8msreplywall+5/5;8admissionbase/childoutcomes plus5reps allpositive. All19parserbases/newamplification+eviction5/5 and5directimporterfilespositive. Actual all251T1/fallback449T2/selected255T3/55Web,T4unexecuted/remainingT3batch. AuthorizednoncachedLinuxx64c16nyc1workers4Node24.21/Nvim.12.5HeadlessShell1248/CfT156.0.8078.4.12prerequisiteskips/advisorybudgetsretained; allpriorfailed/timeoutheads/runs/durations stayseparate. No speedup/fullclosureclaim or Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T12:10:39.378Z

Merged f7d158c370d731c12188b2767f795b8e9c1c074b onto dev.
