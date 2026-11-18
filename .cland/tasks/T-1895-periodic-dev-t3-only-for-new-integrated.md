---
id: T-1895
kind: task
title: Periodic dev T3 only for new integrated evidence
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1628
branch: t/T-1895-periodic-dev-t3-only-for-new-integrated
created: 2026-11-16T07:29:45.935Z
updated: 2026-11-18T20:57:34.035Z
closed: 2026-11-18T20:57:34.035Z
---

## Summary

It already skips an unchanged tree, or a green full cover on dev's ancestry within 1 h (`suites.ts:1203–1226`). Batches likely don't suppress it, because their candidate head is not on dev's ancestry (unverified). Skip when dev's tree equals a green T1+T3 batch candidate tree, and lengthen `dev_t3_every`. Merges impl #5 and §7 #5.

Kind: product + config. Triage ticket H-7 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes rule 6 ("periodic dev T3 covers T2 on integrated dev") and `verification.dev_t3_every`. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. A dev tree equal to a green T1+T3 batch candidate tree skips the periodic run, with a notice naming the batch (test).
  - done: impl-1895 · 2026-11-18T19:21:49.547Z
  - verified: rev-36 [reviewer] · run rev-36-1895-final-1 · 2026-11-18T20:05:17.338Z · commit fc359bbd3e3a77584a4d9050048fc07d9d3684f2
- [x] C2. The repository config sets `dev_t3_every` to 8h, with the seven-day ledger (A-21336) recorded as the baseline (evidence).
  - verified: rev-36 [reviewer] · run rev-36-1895-source-2 · 2026-11-18T19:21:01.010Z · commit fc359bbd3e3a77584a4d9050048fc07d9d3684f2
  - done: impl-1895 · 2026-11-18T19:21:52.583Z
- [x] C3. Integrated T2 keeps a stated cadence of at least once a day, or rule 6's text changes with the human's yes (test or doc).
  - done: impl-1895 · 2026-11-18T19:21:54.857Z
  - verified: rev-36 [reviewer] · run rev-36-1895-final-1 · 2026-11-18T20:05:17.338Z · commit fc359bbd3e3a77584a4d9050048fc07d9d3684f2

## Dependencies

none; suites.ts

## Comments

### impl-1895 · 2026-11-18T17:44:12.616Z

Proposed verification.dev_t3_every: 8h (repository config only; generated default remains disabled). C2's seven-day post-landing <=3/day observation stays evidence-pending. Requested structured prior-week ledger from Coordinator; never accessing live hub.db. Investigating C3: batch T1+T3 does not prove integrated T2; daily T2 may remain supplied by nightly soak under enabled/authenticated executor and spend/network availability, or need a daily backstop/updated rule 6 approved by human.

### impl-1895 · 2026-11-18T17:44:44.850Z

Consumer census before source edits (rg fields/functions plus dev-t3/devT3/dev_t3_every and notice wording across production, web, docs, skills, QA, hub/test and nvim/test): scheduler hub/src/hub/suites.ts; persistence store.ts and suite-job summaries (new eligibility must survive compact load); config init/config.ts, hub/configuration.ts, repository .cland/config.toml and init-config.test.ts pin. Verification policy/occasion/plan and cli/suite.ts retain occasion/selection shape. server.ts/daemon.ts dispatch notices through onSoakNotice; heartbeat.ts/suite-author.ts and web Agents topic/TopicsArea.tsx, merge queue/Suites views consume existing text/jobs, no new wire shape planned. dev-t3-result/report/search/probe retain results, not skip eligibility. CLI usage/suite.ts and frozen fixtures/cli-usage/commands.json require wording migration if help changes. Docs running.md, tests.md, per-file suite-soak guide and merge/implement skills describe cadence. QA E-420 assumes two-hourly (update); E-617/E-678 and E-412/E-415/E-579/E-1281/E-1532/E-1534/E-1535 refer to occasions, fixture disabling or historical results (unchanged). Tests: suite-soak, suite-soak-component, suite-scheduling, init-config directly schedule; suite-tiers/verification-commands/verification-tree/durations/merge-batches/merge-batch-dependencies/web-phase/suite-accounting/suite-persistence/suite-cover/dev-t3-search(-component), release-cover-fixture/harness/remote-fixture consume unchanged occasion/results. No nvim scheduler reader found. Tier history unchanged; existing scheduler fixture imports native modules, so new pure tests will use a leaf module only.

### impl-1895 · 2026-11-18T17:47:00.463Z

Ledger command staged as t1895-ledger.py: python3 t1895-ledger.py > t1895-ledger.json. Streams read-only root .cland/artifacts/A-*-suite-*-all-at-*.log, filters Queued in [2026-11-11T00:00Z,2026-11-18T00:00Z), deduplicates run ids, uses suite provenance occasion/tree/executor and Finished exit, never artifact mtime or hub.db. Same-tree earlier-queued green batch matches are observational only: logs do not establish durable completion ordering or producer-tier eligibility, so 'already covered before admission' remains unknown where those receipts are absent. Source skip implementation will require structured receipts. Proposed rule clarification (Coordinator only if needed): periodic integrated T2/T3/Web runs use an 8h attempt cadence; batch-only suppression cannot exceed 24h on changed dev, while unchanged trees retain existing skip. No RULES.md or clause edits.

### impl-1895 · 2026-11-18T18:16:23.049Z

Implementation decisions confirmed by Coordinator: pure receipt eligibility T1 + existing semantic Suites boundary T2; 8h proposal accepted; preserve unchanged-tree early return, with durable 24h full-periodic backstop only for changed trees suppressed by batches. Nightly rotating soak does not reset it, no rule6 edit required. Coordinator 18:14 direction: full test:lint admitted during quiet; source/tests/docs commit/review now, defer repository config pin and its init-config literal to a separate commit after rule33 files run at quiet over. No criterion marked complete; C2 post-landing week remains evidence-pending. Typecheck passed on macOS local Node24.21, no browser executed. Runtime/red/help compatibility tests and configured verify unexecuted. Additional exact consumer paths: web/src/sessions/VerifyLine.tsx + verification.ts consume unchanged queue data; TopicsArea.tsx consumes ordinary notice text. No wire shape changes.

### rev-36 · 2026-11-18T18:31:37.147Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1895-source-1
commit: 483102b5a37b5b494e783f8f2f60f1717e6bdaa6
scope: full
findings: [{"severity":"medium","text":"Spec/C3: ordinary attempt throttling precedes the 24h deadline. With start t0, full completion t1h, batch skips t8/t16/t24, the t25 backstop is blocked until t32 (31h since completion). No wake/override or approved delay exists. Honor the backstop independently of skip intervals and add the phase-offset/restart control, preserving unchanged-tree behavior.","file":"hub/src/hub/suites.ts","line":1319},{"severity":"medium","text":"Standards/C3: lastGreen credits reported dev-t3 code0 without complete full-periodic eligibility: no finished/full/unsharded/non-diagnostic checks or required T0/T2/T3/Web producer plan/receipts. Admission facts cannot establish execution, especially for legacy/partial history. Reuse shared complete receipt policy before resetting the daily baseline; missing evidence stays unknown.","file":"hub/src/hub/suites.ts","line":1328},{"severity":"medium","text":"Standards/C1: all six callbacks use wait-only caseDeadlines with raw tick/settled/jobs/reopen continuations and separate close/guard restoration. suiteUnit owns resources/submissions, not the whole caller through abort/timeout. Enroll existing normal/signal whole-case fence/join/root adoption and separate setup bounds before guard/fixture acquisition; join callback before storage/root/mock teardown.","file":"hub/test/dev-t3-coverage-component.test.ts","line":12}]
finding_counts: {"high":0,"medium":3,"low":0}

A-21351 full intermediate source review at483102b5a37b5b494e783f8f2f60f1717e6bdaa6/treedd5247b7d4730d9238236c7c0e91ca610f4ce3ed vsd7050e7e2c210bed4210cd16d37eb576192a1f09. Standards2medium/Spec1medium,nohigh/low. Author9b812c70 confirms all3gaps/no omitted owner,deadline override or full-execution invariant. C1failed for component lifetime; C3failed for phase-offset deadline and unproven baseline; verify none. Batch exact-tree/producer checker,executed or named-memberT1,artifact lookup,notice and shared ordered-receipt extraction otherwise positive. Persistence summary retainsrequiredproofs; no new log scan/hydration. SourceHEAD/origin match; two dirty future files config2h→8h/init literal intentionally EXCLUDED perCoordinatored6232ae; no undo. C2remains unchecked/pending config-rule33 andpostlandingweek,not failed for authorized stagedwork. Docs/help/frozenSUITE_USAGE/skillsCHANGES/currentconsumers/tierhistory inspected; future8h wording must align with nextreviewed config. A21343 reports typecheck/lint0,130reportonlyfindings0refusals onlocalmacOSNode24.21; runtime/red/newT1T2/help/configured/QA/browser/providerproof absent duringquiet,not countedpasses. A21335scriptreadnotrun/A21336priorweekartifactcensusonly;completionordering/qualifyingcoverageunknown,notfutureC2proof. Reviewer read-only/no runtime/SQLite/checker/scanner/liveDB/provenanceprobe. Release immutable pin for consolidatedcorrection;quiet/windowrestrictionspersist,fresh committed-head source review plus forthcomingconfig/evidence delta beforeverify,no extra stress/native/fullsuite/provenance run requested.

Criteria: C1 failed (New component scenarios lack the pre-acquisition whole-caller fence/join and root adoption required before fixture/guard teardown.), C3 failed (Attempt throttle can postpone the24h backstop, and lastGreen can reset its baseline without complete full-periodic execution proof.).

### impl-1895 · 2026-11-18T18:49:16.520Z

Review1 corrections underway, no source pin now. Reviewer A-21351's P1/S1/S2: deadline bypass before interval gate (persisted deadline attempts restore retry throttle); shared pure fullPeriodicDevT3Cover requires integrated dev full unsharded plan/selection and complete T0/T2/T3/Web producer receipts; component callback moved under existing stageCase whole-caller normal/signal owner with step fences/root adoption/guard post-cleanup. Actual red counterexamples against reviewed suites.ts: phase-offset '24h deadline bypasses the 8h skip throttle after restart', 0 !== 1; unproven-baseline 'unproven green metadata cannot extend batch suppression', 0 !== 1. Fixed code: component8/8 and focused pair2/2 green; pure20/20; member+producer19/19; suite-soak29/29; scheduling7/7; config20/20; CLI frozen bytes1/1. MacOS local Node24.21, no browser/native provider/full suite/configured verify. Typecheck green. Full lint in progress. Coordinator queued native slot for remaining rule33 suite-soak-component/dev-t3-search-component and cli-help; config pin remains uncommitted.

### coord · 2026-11-18T19:14:01.809Z

C2 narrowed by the Coordinator (2026-11-18): post-merge evidence isn't a pre-merge criterion. The week-after-landing check (at most 3 periodic dev T3 runs a day) is the Coordinator's post-landing observation, recorded here as a comment about 7 days after T-1895 lands.

### impl-1895 · 2026-11-18T19:14:43.001Z

Hub-responsive readback found the earlier timed-out correction comment already persisted (18:49:16); no retry was made. Current clean/pushed head fc359bbd3e3a77584a4d9050048fc07d9d3684f2 includes source corrections8c1d1dfe5 and separately committed8h pin. A-21361 records red/fixed-green source controls; A-21365 records all6 rule33 files green (coverage-component8, dev-search-component19, config20, scheduling7, soak-component39, soak29), cli-help9 and frozen bytes1, local macOS Node24.21, zero failures/skips. Full typecheck and full static lint passed on matching final worktree bytes; report-only findings retained. Native slot released. No full suite/T3/T4/Web browser/configured verify, and no verify window used. Revised C2 baseline A-21336 confirmed; Coordinator owns week-after-landing observation. C2 done mark awaits config-delta source clear per Coordinator instruction.

### rev-36 · 2026-11-18T19:21:01.010Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1895-source-2
commit: fc359bbd3e3a77584a4d9050048fc07d9d3684f2
scope: full
findings: [{"severity":"low","text":"Standards: the refactored notice assertion checks only a prefix and no longer checks the captured batch proof run id. A notice with a missing or wrong run would pass. Preserve the earlier exact-identity assertion using the expected cover id, including phase-offset's separate batch. Production still formats the correct structured proof; this is a test-strength gap.","file":"hub/test/dev-t3-coverage-component.test.ts","line":88}]
finding_counts: {"high":0,"medium":0,"low":1}

A-21378 records the full corrected-source review at fc359bbd3e3a77584a4d9050048fc07d9d3684f2 / tree 0a66217c593499cd96b5a877af7c32bffa71b89e, against fixed base d7050e7e2. No high or medium findings remain; Standards has one low, Spec none. The three source1 medium findings are resolved: deadline override precedes the ordinary skip throttle; fullPeriodicDevT3Cover requires complete structured T0/T2/T3/Web execution before baseline credit; component callbacks use stageCase whole-caller normal/signal fencing, setup bounds, root adoption and cleanup-before-guard restoration. Exact-tree batch/member-T1 policy and consumer/docs/help/frozen-fixture review remain positive. No dev merge; clean HEAD equals local origin. Final request supersedes queued intermediate 8c1d1dfe5.

Verify revised C2 only: committed repository dev_t3_every="8h" and A-21336 recorded baseline. Coordinator's persisted revised criterion assigns the week-after-landing observation to its own later comment; it is not current evidence. C1/C3 implementation is source-supported but remains unverified pending same-head configured evidence; restore implementation-done marks truthfully after the corrections. Source1 failure history remains retained.

A-21361/A-21365 and the final-head item comment retain selected old-scheduler red controls and local macOS Node24.21 green file counts, matching final precommit source/config. Independent read-only rule33 search matches all six reported files; native slot grant/release is recorded. Typecheck/full lint reported exit0 with zero refusals and 130 report-only findings. No full raw invocation transcripts or invocation-time whole-tree hashes are inferred from these summaries. No configured run, full suite, T3/T4 phase, Web browser or real provider proof is claimed. Reviewer ran no runtime tests/checkers/scanners/native probes. Source pin released by this verdict; unchanged head may verify only after Coordinator grants a window. Any changed head needs fresh source review.

Criteria: C2 verified.

### impl-1895 · 2026-11-18T20:02:27.929Z

Configured verification b42700c6-9fbe-4d3a-9ab9-b5d635ad1890 completed exit0 at reviewed fc359bbd3e3a77584a4d9050048fc07d9d3684f2 / tree189f07f58382228b6c0064fda2487037f9b05901, uncached. A-21399: T0/T1/T2/Web all exit0; task coverage fallback ran all T2. Hub aggregate6877 passed,0failed/0skipped. Streamed suite timing facts independently confirm20 named new pure cases +8 named component cases passed, including phase-offset and unproven-baseline. Runtime droplet c-8 ams3 Linuxx64 6.8.0-147-generic Node24.21/Neovim0.12.5; browser Chrome Headless Shell1248, Google Chrome for Testing156.0.8078.4. Lifetime1255s cost$0.0871. T0 host gate local macOS; window released at its positive exit0 receipt. Report-only lint/duration/Web-wall findings retained (not enforcement failures); skip-reason report missing0. T3 remains merge-batch evidence, T4 unexecuted, no per-item QA policy. Waiting Reviewer same-head settlement; no new source change or rerun.

### rev-36 · 2026-11-18T20:05:17.338Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1895-final-1
commit: fc359bbd3e3a77584a4d9050048fc07d9d3684f2
scope: evidence
findings: [{"severity":"low","text":"Retained Standards low from source2: the notice assertion checks only a prefix and no longer binds the captured batch proof run id. A notice with a missing or wrong run would pass. Production still formats the correct structured proof and names the batch; passing evidence does not resolve this test-strength gap.","file":"hub/test/dev-t3-coverage-component.test.ts","line":88}]
finding_counts: {"high":0,"medium":0,"low":1}

Final exact-head evidence clear; independent streaming audit A-21400 of run b42700c6-9fbe-4d3a-9ab9-b5d635ad1890 / A-21399. Owner result finished/passed exit0 at reviewed fc359bbd3e3a77584a4d9050048fc07d9d3684f2; provenance40332 pins runtime verification tree189f07f58382228b6c0064fda2487037f9b05901 and cached:null. Clean HEAD/local origin still match source2. Standards retains one low at component:88; no high/medium, Spec none. Verify C1,C3 and retain current same-head C2 source verification.

Expected names were read from pinned source: all20 pure coverage-policy and8 owned component cases have exactly one pass base finish/timing pair, five distinct passing load identities and one exact5/5 proof. No missing/extra task identity. Required batch/member-T1, unchanged, backstop, phase-offset and unproven-baseline cases pass; critical phase-offset15819/15820 and unproven-baseline15831/15832 retain their final selection/receipt assertions. Their24h schedule is fixture-clock policy proof, not a day-long production observation. C2 remains committed8h plus A-21336 baseline; the Coordinator owns the future week-after-landing observation under the revised criterion.

All230T1/433T2/55Web files have exactly one positive base envelope, no missing/nonpass/duplicate/extra file or parse error. Base6877=6732top-level+145nested passes, zero fail/cancel/skip.350 total load passes, including140 task repetitions, are separate from base totals. T0/T1/T2/Web exit0; all248T3/17T4 remain unexecuted, T3 deferred to merge batch. Component assertions about future full T3 selection are not actual T3 execution. Shared member/producer policy, all six config-key consumer files and frozen usage also have passing envelopes.

Droplet Linuxx64 6.8.0-147-generic, Node24.21.0/Neovim0.12.5; actual chromium_headless_shell-1248 chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4 (full binary path in A-21400). T0host143.777s is step-only; lifetime1255s/$0.0871 is executor accounting, not suite wall. Budget/lint/Web-wall/ratchet notices remain report-only. Prior source1/red/local checks retain their exact epochs/outcomes; no rerun or uncaptured native provenance inferred. QA scope none. Reviewer read source/Git/manifest/retained structured data only, no runtime/checker/scanner/native/browser/provenance probe. Release evidence hold; ordinary hub/lead gate handles readiness and landing.

Criteria: C1 verified, C3 verified.

### coord · 2026-11-18T20:57:34.035Z

Merged fb513e13f5991e1e05210e2005e7b04b09b2ee45 onto dev.
