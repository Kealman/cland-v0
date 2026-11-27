---
id: T-2092
kind: task
title: Merge-batch load gate takes an integrated stage cover whose T3 never executed (stopped at a T2 failure) as its T3 baseline, so the next batch repeats all 749 T3 identities five times and times out
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1808
branch: t/T-2092-merge-batch-load-gate-takes-an
created: 2026-11-24T17:01:06.268Z
updated: 2026-11-27T16:43:24.840Z
closed: 2026-11-27T16:43:24.840Z
---

## Summary

This is the same family as T-1582 (a T1-only batch as baseline) and T-2053 (a red T3 batch fencing every file), but through a new path. The Coordinator's Linux stage cover 31616b65 (occasion stage, dev c7aa49808) failed in T2. Its T3, T4 and Web tiers never ran ("tests 0; observed unavailable"; T3 ratchet "0 observed existing tests"). Merge batch 25591d7d (T-1917, T-2043, T-2057, T-2067) then took it as its baseline ("load gate baselines T3=31616b65"). It repeated all 749 T3 identities five times ("confirmed complete 749"), ran 4,810 s, and ended inconclusive with tests in flight and one load-sensitive failure, prune-process-lifecycle "hub crash after durable writer release…" at 24.6 s (run 46853c04, A-23061). The batch is held and no member is blamed.

## What to build

Load-gate baseline selection must skip any run whose tier wasn't executed, including integrated occasion runs (stage, epic, release, dev-t3) and batches. It falls back to the latest run with observed timings for that tier. If none qualifies, it treats the baseline as missing for that tier and doesn't repeat every identity.

## Acceptance criteria

- [x] C1. With a newer integrated stage run whose T3 is unexecuted and an older batch with a complete T3, the next batch's load gate names the older batch as its T3 baseline and repeats only the identities that are genuinely new (test, red before).
  - done: impl-2092 · 2026-11-27T15:19:36.671Z
  - verified: rev-35 [reviewer] · run rev-35-2092-evidence-1 · 2026-11-27T16:09:49.574Z · commit 77da538f473063dc3f209fc05525a66a510ced9b
- [x] C2. With no run carrying observed T3 timings, the gate reports the baseline as missing and repeats only identities absent from the duration manifest (test).
  - done: impl-2092 · 2026-11-27T15:19:36.776Z
  - verified: rev-35 [reviewer] · run rev-35-2092-evidence-1 · 2026-11-27T16:09:49.574Z · commit 77da538f473063dc3f209fc05525a66a510ced9b

## Comments

### coord · 2026-11-24T17:53:19.853Z

Second data point. The next batch, 22aa123e (run f66b1675, green, 2,988 s), took the held, inconclusive batch run 46853c04 as its T3 baseline ("load gate baselines T3=46853c04") and repeated 235 identities. Those are likely the ones that were incomplete or in flight when 46853c04 was interrupted. So an inconclusive run with partial T3 is also accepted as a baseline. It cost about 20 extra minutes here rather than a timeout. Baseline selection should skip inconclusive and partially executed runs as well as unexecuted ones.

### impl-2092 · 2026-11-27T15:07:56.886Z

Consumer inventory (rule 20/41): searched loadGateBaseline, batchBaselineRuns, batchBaselineFileRuns, timingIdentities, batchPassingIdentities and importers. Production: Suites admission/checkpoint/retention/receipt scanners, merge-batches summary, suite-load-gate-plan repetitions, suite-selection serialization and runner selection transport. Persisted schema unchanged; older records retain timing/log compatibility, client wire shape unchanged. Tests: merge-batches T1 policy (whole-case owner), suite-landed-load, suite-load-gate-plan, suite-selection, suite-shards/selection transport; tier history/migration regression preserved. Docs: hub README, docs/hub/running, docs/agents/tests; skills and QA briefs searched (no direct field consumers); no CLI usage/help exports changed. Coordinator clarified C2: missing tier baseline falls back to same-tier candidate duration manifest, no new cap. Red proof on Node 24.21.0 macOS: stage and batch tests expected observed-batch, got unexecuted; green after checking observed tier identities before resolving files.

### rev-35 · 2026-11-27T15:15:46.202Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2092-source-1
commit: 6b04efb21e44b6e9d5f8ac7858ab3288a86403df
scope: full
findings: [{"severity":"medium","text":"M1: collection sets interruptedAt for every nonzero outcome (line2132), so excluding it wholesale rejects ordinary completed red runs before file fences/passing proof. Older green can be resurrected; synthetic already-reported red fixtures omit this lifecycle field. Preserve authoritative timeout/native interruption/incomplete checks and add collected-red restart/fence regression.","file":"hub/src/hub/suites.ts","line":1156}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23819 full source review at Git tree0d8a977081d18346837041a56c115a9402857561, fixed point1c947950c8a8872e8fab53a377501d15021e257d. Sole confirmed medium M1 (Implementer7e99ea3d). No further standards/spec blocker found: observed-tier precheck, shared terminal producer validator, same-tier manifest fallback/explicit missing diagnostic, bounded-history/single-flight and consumer/doc updates otherwise match scope. Consolidated bar retains real timeout/native interruption/incomplete exclusions while keeping ordinary exit1 red passing-file proof and failed/incomplete-file fences, with collection metadata/restart regression. C1 failed; C2 source-positive but runtime-unverified. A-23818 is authored selected local macOS Node24.21 T1 evidence282counts, with earlier failed attempts retained; no raw committed producer binding or configured/T2/T3/T4/Web proof.714-file graph is selection only. Hold released for correction/Coordinator-authorized checks; changed head needs fresh source review before verify. No Reviewer execution/edits.

Criteria: C1 failed (Observed ordinary red batch receipts are wrongly skipped because their generic nonzero collection cutoff is treated as producer interruption, breaking latest-observed proof and T-2053 fences.).

### rev-35 · 2026-11-27T15:23:07.482Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2092-source-2
commit: f50850de020e75638affc02bd788f1a22c866399
scope: delta
findings: [{"severity":"medium","text":"M2: log-loss control overwrites run.log, but real collection now publishes finalized.log as artifact.path and #evidencePath prefers that retained file. Reopen can rescan it, so checkpoint-only recovery is not proven. Invalidate/observe the selected retained source after first checkpoint, then keep all proof/fence/restart assertions.","file":"hub/test/merge-batches.test.ts","line":720}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23821 at Git treecf4e1820d2acb830082eddccc00624c4cda48a38: production M1 resolved by removing generic interruptedAt exclusion while keeping timedOut/native interruption/shared terminal receipt validation. Real ordinary exit1 collection now asserts cutoff and exact completed producer metadata. Sole remaining M2 test issue confirmed6e8c61cd: actual retained evidence remains readable after raw log replacement; narrow bar names selected artifact/finalized path and positive loss observation. No other source-policy defect found. Legacy optional-field delete preserves intended absent shape; typecheck provenance correction in A-23820 acknowledged (6b04 check not established,03fb TS2375 failed, later f508 check reported green). Raw current local stdout179+44/19/2/31/7=282T1; authored head/exit metadata is not independent producer epoch proof. No configured/T2/T3/T4/Web/browser claim. C1/C2 remain unverified; no new functional criterion failure mark on this test-only not-clear pass. Hold released for narrow correction/Coordinator-authorized checks; fresh committed-head source review before verification. No Reviewer execution/edits.

### rev-35 · 2026-11-27T15:27:41.704Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2092-source-3
commit: 77da538f473063dc3f209fc05525a66a510ced9b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23823 at Git tree568417aee3507835cc508ce8214a7bd39fdf1fb4: M2 resolved by selecting collected artifact/finalized evidence, asserting path identity, positively observing timing bytes, invalidating every distinct raw/retained source and reading the exact marker before reopen. All cutoff/complete producer metadata, passing proof, failed/incomplete/older-green fences and post-reopen assertions preserved. M1 production correction remains unchanged; all8 eligibility variants, same-tier manifest fallback/diagnostic/migration/work controls and bounded-history/consumer/docs subproofs remain. Standards/spec findings[]. C1/C2 source-positive but deliberately runtime-unverified pending configured same-head producer/named finishes. A-23822 raw282T1 stdout and authored exact-head native-exit/typecheck/lint metadata are local macOS Node24.21 selected evidence, not independent epoch/configured/T2/T3/T4/Web/browser proof. Earlier lost-file/typecheck scope corrections and failed attempts retained;714-file graph is selection only. Coordinator1f8e99a3 disposition checked; no exception needed. Hold released to request exact-head verify window; changed head needs fresh source review. No Reviewer execution/edits.

### rev-35 · 2026-11-27T16:09:49.574Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2092-evidence-1
commit: 77da538f473063dc3f209fc05525a66a510ced9b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23827 final same-head audit of run411b9bfa/A-23824: result.json code0, empty cause, unfinished[], exact reviewed head; complete T0/T1/T2/245selectedT3/Web receipts exit0. All8 eligibility variants plus missing-tier manifest case each have1base+5unique load passes; both actual collected-red file/identity fence and retained-evidence-loss restart cases have base passes, with partial/history/consumer controls preserved. C1 selects observed batch/only genuinely new repetitions; C2 keeps explicit missing baseline and same-tier manifest fallback. C1/C2 verified. Git tree568417aee3507835cc508ce8214a7bd39fdf1fb4 and recorded run treed7fae64cb9142e93ff13c1739f2f171e34633e25 named independently. Linuxx64 dropletc16nyc1/4workers, Node24.21.0, isolated HeadlessShell1248/Chrome156.0.8078.4. Producer9895pass/12prerequisite skips/0fail;3known finish-only protected-output rows remain unpaired, not paired proof.31otherT3/all18T4 unexecuted; budget/ratchet/skip checks report-only, incomplete base unknown, cache metadata unknown. Earlier not-clear rounds/typecheck/provenance corrections retained. Source unchanged; no Reviewer execution or edits. Findings[].

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T16:43:24.840Z

Merged 03fe7325e72e623aa51e6cf9b02e32f19315e785 onto dev.
