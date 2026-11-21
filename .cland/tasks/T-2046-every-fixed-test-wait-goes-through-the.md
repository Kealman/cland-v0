---
id: T-2046
kind: task
title: Every fixed test wait goes through the shared load-scaled helper, with a per-wait load factor (E-1881 C3 rework, A-22306)
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1691
branch: t/T-2046-every-fixed-test-wait-goes-through-the
created: 2026-11-21T03:32:07.872Z
updated: 2026-11-21T12:55:31.810Z
closed: 2026-11-21T12:55:31.810Z
---

## Summary

E-1881's C3 wasn't met (A-22306). After T-1889 (load-aware test waits), 5 of 15 macOS covers were still red on fixed waits, against 15 of 60 before. The load factor is computed once per tier and only rises above 1 when the 1-minute load is above 8. Three of the five failing waits bypass the shared helper: the Discord test fake's 2000 ms default, Playwright's 3000 ms locator wait, and node's 5000 ms per-test timeout. The human chose on 2026-11-21 to close E-1881 with that reason recorded and to do this rework as a separate 0.4.1 task (ask cdaedf29).

## What to build

Route every fixed test wait through the shared load-scaled helper, with the factor applied per wait from the current load, not once per tier. This covers condition waits, test fakes' default deadlines, Playwright locator and expect timeouts, and per-test timeouts. Keep the assertions. Add a lint that flags new fixed waits outside the helper, in report mode first (rule 27).

## Acceptance criteria

- [x] C1. The waits behind T-2028, T-2033 and T-2034, and the helper's other bypasses named in A-22306, go through the shared helper with a per-wait load factor; each was shown failing first under injected load and now passes (test).
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-final · 2026-11-21T07:37:24.634Z · commit 71dc49862363f2b686cd167c9def8241bc50e466
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-final2 · 2026-11-21T09:17:41.848Z · commit 879df801bf87a7f706bad73b4ffc2189e896146b
  - done: impl-2046 · 2026-11-21T11:28:47.331Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-final3 · 2026-11-21T12:01:50.221Z · commit 50d5745686ab27675e8bb8370a89915a5414f5c7
- [x] C2. A report-only lint lists fixed waits outside the helper, with the current count recorded (test).
  - verified: rev-35 [reviewer] · run rev-35-2046-source-2 · 2026-11-21T04:58:00.998Z · commit 6fab755a9f9fdf3751d8f9eb787b2f93175d21ca
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-M3-source · 2026-11-21T05:49:46.661Z · commit 71dc49862363f2b686cd167c9def8241bc50e466
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-final · 2026-11-21T07:37:24.634Z · commit 71dc49862363f2b686cd167c9def8241bc50e466
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-M45-source · 2026-11-21T08:49:52.184Z · commit 879df801bf87a7f706bad73b4ffc2189e896146b
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-final2 · 2026-11-21T09:17:41.848Z · commit 879df801bf87a7f706bad73b4ffc2189e896146b
  - done: impl-2046 · 2026-11-21T11:28:47.514Z
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-merge-source · 2026-11-21T11:30:21.002Z · commit 50d5745686ab27675e8bb8370a89915a5414f5c7
  - verified: rev-40 [reviewer] · run rev-40-20261121-2046-final3 · 2026-11-21T12:01:50.221Z · commit 50d5745686ab27675e8bb8370a89915a5414f5c7

## Comments

### coord · 2026-11-21T03:32:16.767Z

Post-landing check (Coordinator, not a merge criterion): two consecutive macOS full covers on dev after this lands should show no load-timing failure; record them on E-1881's successor or here as a comment. Related open items covered by C1: T-2028, T-2033, T-2034.

### impl-2046 · 2026-11-21T03:53:10.366Z

Consumer inventory before shared default changes: until/eventually/testSetupWaitMs and harness socket/channel-event defaults; remote-fixture.remoteWaitMs/remoteEventually (T-2033); Discord fakes admission/exchange plus existing fake-api setup helpers; web/test/harness.ts default Page/Locator actions (T-2034; repository uses node:assert, no Playwright expect package); run-suite.ts inherited CLAND_TEST_LOAD_FACTOR and --test-timeout; suite-command/file-startup watchdog explicit factor callers. Production waitTimeoutMs consumers retain explicit factors; suiteLoadFactor unchanged. Literal timeout sites elsewhere will be report-only census debt per Coordinator scope ruling. A-22306's Telegram setup and release-item 5s cases were already converted by T-1736/T-1951; preserve those assertions and exercise the shared paths. No change planned to prune-process-lifecycle.test.ts.

### rev-35 · 2026-11-21T04:37:00.247Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2046-source-1
commit: e289ff9740af8eb32cfeff2336af37f29bc360d1
scope: full
findings: [{"severity":"medium","text":"M1 (Standards, rules9/12): The new actual-child launch-timeout regression uses raw TestContext across fixture creation, writeFile, run() launch and done observation. Narrow directory/child hooks do not own and join the complete original setup/body before acquisition or fence root removal across cancellation/late setup. Enroll an encompassing owner with a separately bounded setup and positive child/pipe-close join before directory disposal. Keep the real child execArgv assertion and child-confined OS injection; this native T3 subject does not require a fake-only launch prohibition.","file":"hub/test/suite-runner.test.ts","line":968},{"severity":"medium","text":"M2 (Spec/C1): pollerDeadline samples testDeadlineMs while generating a numeric script. Module-level command constants in executor-run:98, executor-safety:24, suite-close-recovery:69 and suite-remote-process:17 therefore freeze import-time load for later barrier waits. No runtime resampling owner or approved exclusion covers this; the only once-per-launch exception is Node's CLI backstop. Sample when the launched producer arms its timer, or construct the command at actual admission, using the shared policy and a retained load-change control.","file":"hub/test/fakes/finish-poller.ts","line":4}]
finding_counts: {"high":0,"medium":2,"low":0}

First full Standards/Spec source review not clear: one medium Standards and one medium Spec finding, no high/low. A-22330 credits central per-operation defaults, approved launch-time Node exception and advisory C2 census, while documenting native callback ownership and generated-barrier sampling gaps. A-22328 retained red/green exports were inspected with explicit missing raw/native/source-epoch fields; no missing proof is reconstructed. C2 remains done/unverified, no partial verification on this pass. No Reviewer runtime/source edits; correct both findings together and request fresh source review before Coordinator-configured verification.

Criteria: C1 failed (The new native Node-timeout case lacks encompassing pre-acquisition/child-close ownership, and generated finish barriers freeze import-time load instead of sampling actual admission. A-22330 M1/M2.).

### impl-2046 · 2026-11-21T04:52:53.286Z

Source1 correction consumer inventory: pollerDeadline/finish-poller generated-script callers are executor-run.test.ts (module-level longTest), executor-safety.test.ts (module-level longTest, inline package test script and explicit 50ms exit-124 control), suite-candidate.test.ts (candidate barrier), suite-close-recovery.test.ts (module-level barrier), suite-remote-process.test.ts (module-level longTest), and the new until.test.ts guarded VM admission control. Existing production/native callers embed CJS JS inside shell double quotes; the encoded policy module path preserves that grammar while deferring shared budget sampling to producer timer admission. Explicit numeric bounds remain exact; expiry stderr/exit124 are unchanged. Search covered hub/nvim/web tests and fixtures, docs and skills; frozen CLI/help bytes and persisted-record readers do not consume this helper. Matching five file-specific guides and the runner/until guides updated. Source2 evidence A-22336 retains exact command argument arrays/pinned source metadata and native exit/signal results for new checks; earlier A-22328 provenance gaps remain explicit.

### rev-35 · 2026-11-21T04:58:00.998Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2046-source-2
commit: 6fab755a9f9fdf3751d8f9eb787b2f93175d21ca
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full Standards/Spec source2 clear within Coordinator-approved central-default scope. A-22337 resolves M1 with pre-acquisition original setup/body ownership and positive native result/pipe-close receipts, and M2 with shared budget sampling inside generated producers at timer admission. Real child execArgv and final receipt assertions retained. A-22336 pinned command/native code0/signal-null records support64 runner,5 targeted native and55 unit passes plus full lint/typecheck; earlier A-22328 gaps stay explicit. C2 verified: planted advisory census and1963-site current report with zero refusals. C1 final runtime evidence waits for Coordinator's actual exact-head configured result, no new full/native/Web claim. No Reviewer runs/probes/edits.

Criteria: C2 verified.

### rev-35 · 2026-11-21T05:30:25.295Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2046-evidence-1
commit: 6fab755a9f9fdf3751d8f9eb787b2f93175d21ca
scope: evidence
findings: [{"severity":"medium","text":"M3 (configured evidence/C1): The adapter wraps returned Frame objects such as page.mainFrame(), but forwards event listeners and waitForEvent predicates unchanged, so Playwright supplies raw Frames. The unchanged identity comparisons at connection.test.ts113–114 compare raw Frame to proxy and cannot match. A-22342 fails that child on a6000ms framenavigated wait and its parent; this is one underlying identity regression, not proof of slow/absent navigation. Preserve consistent compared-object identity, add frame listener/predicate controls and keep the real browser reload/count/final assertions, per Coordinatorc468eb04.","file":"hub/test/browser-wait-defaults.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured evidence not clear: Web child framenavigated predicate times out6000ms, parent fails; one underlying adapter identity regression. A-22347 preserves exact failure/source cause and unknown native navigation state, positive named condition/Discord/barrier/runner/hosts controls and actual selected phases. C2 current source verification retained; no final C1 mark. Coordinator223d858a's mode-free scope and omitted importing T3 files are explicit for decision; fullT3 not inferred. Coordinatorc468eb04 correction/local-Web/narrow-review/fresh-mode-free plan recorded. No Reviewer run/probe/edit.

Criteria: C1 failed (Same-head13518715/A-22342 fails unchanged Web frame comparisons because returned mainFrame is proxied while event/predicate Frames remain raw. A-22347 M3; Coordinatorc468eb04 authorizes identity correction and narrow re-review.).

### rev-40 · 2026-11-21T05:49:46.661Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2046-M3-source
commit: 71dc49862363f2b686cd167c9def8241bc50e466
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow M3 source clear, Standards0/Spec0 findings. Native owners decorated in place; original Page/Frame/Locator/array and callback identity preserved. Existing/new Frame/popup enrollment retains per-action load sampling without callback wrappers; explicit timeouts still win. Raw listener/predicate equality and removal controls reproduce old0!==1 then observe documents1/predicateMatches/pageMatches; async/newowner controls pass. Real connection comparisons/reload count/final receipts unchanged. Prior source2 M1/M2 code unchanged. A-22349 pinnedcleanhead/tree localmacOSNode24.21 unit57 andall55Webfiles/twoworkers Node351pass nativecode0/signalnull, lint/typecheckgreen. HeadlessShell isolated perharness; browserbinary/version not emitted/unknown, no borrowedLinuxversion. Supplied admissionpin is not independent percommandGitattestation. C2reverified: unchanged advisory/plantedlint with current1963report-onlysites/zero refusals. C1finalpending Coordinator7f14c967/b3455900's four whole nativeT3importers at finalhead after quietwindow plus freshsamehead mode-freeverify; localWeb is not overallgreen. Failed13518715 retained. Reviewer ran no tests/native/browser.

Criteria: C2 verified.

### coord · 2026-11-21T06:51:35.921Z

Recurrence on dev 792d643d8, before T-2046 landed: Linux epic cover 6b458fee (A-22358), shard-1 Web, `web/test/hosts-view.test.ts:552` "Hosts Add moves the real inbox login wait through booting to placed". `locator.waitFor: Timeout 3000ms exceeded` waiting for "waiting for host waiting-host to boot". The Web tier observed 643.9 s against a 202.9 s projection (about 3x slower runner). This is the T-2034 class of fixed wait that T-2046 C1 converts. It is the only failure among 9,546 passing. Under the flaky rule, coord resubmitted the Linux cover once, fresh, at the same tree.

### impl-2046 · 2026-11-21T07:35:41.416Z

Final required native coverage completed after quiet at unchanged reviewed71dc49862363f2b686cd167c9def8241bc50e466/Git treebf5bd21ab8edcf5c3ff1f2ebc520a9e922d5a9cb. Whole files, serial: executor-run22/22, executor-safety17/17, suite-close-recovery4/4, suite-remote-process1/1; zero fail/skip/cancel, each native code0/signalnull. Fresh enforcing one-minute load<12 per launch (1.842/1.647/1.637/2.303); no continuous-load or real stress-cover claim. A-22367 retains complete command/source/runtime/outcome records with declared path-prefix redactions. Native slot released. Existing same-head configured a1147b6e/A-22356 remains green, with Reviewer auditA-22357; prior13518715 remains red. No source edits, dev merge, or new configured submission. Requesting final C1 evidence settlement; full LinuxT3 integration remains with the merge batch.

### rev-40 · 2026-11-21T07:37:24.634Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2046-final
commit: 71dc49862363f2b686cd167c9def8241bc50e466
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards0/Spec0 findings. A-22372 independently audits A-22367's four whole importer files at unchanged source-clear head: executor-run22/22, executor-safety17/17, suite-close-recovery4/4, suite-remote-process1/1; local macOS/Node24.21.0, serial native code0/signalnull each, no fail/skip/cancel, fresh enforcing launchload<12. Launcher clean-head pins are retained, not independent per-child Git attestations; first absolute admission time remains unknown. A-22356/a1147b6e (A-22357 audit) supplies noncached same-head Linux c8ams3 T0/T1/fallbackT2/all55Web plus selected suite-runnerT3 64 cases and mappedT4 one parent once:7319pass/1Mac-only selector skip/0fail. RemainingT3 merge batch and remainingT4 unexecuted. HeadlessShell1248/CfT156.0.8078.4; advisory budgets remain report-only, no performance/stress clearance. Named condition/Discord/browser/producer timer/real Node launch/setup join and original Hosts/reload receipts pass. C1 verified in approved central-default scope, with Node's approved once-per-launch backstop exception. Earlier red-first capture/provenance gaps remain explicit in A-22328/A-22336; current receipts do not reconstruct them. C2 verified: current1963-site report-only census, planted control and zero refusals. Prior13518715/A-22342 stays failed. Source unchanged; no Reviewer runtime/probe/browser actions.

Criteria: C1 verified, C2 verified.

### impl-2046 · 2026-11-21T08:28:13.819Z

Dropped batch33dcd1f7/A-22420 assigned two owned fixes by Coordinatorddfea08f: CJS-only generated policy import breaks ESM/TLA barrier.mjs; configured test_timeout1000 is incorrectly scaled to1300. Proposed additive SuiteLimits.testTimeoutIsDefault metadata, with absent/legacy metadata conservative exact. Consumers searched: suiteLimits/run-suite/suite-command/suite-shards/territory; hub suites job policy, suite-worker serialization, executor RunRef/droplet env export and persisted job limits; suite-timeouts partial cached fixtures, suite-command partial caches, suite-queue-policy exact admitted limits. Old four-field cache records stay supported, all fields retained. Existing admitted projectConfig snapshots remain exact; only positively identified source defaults opt into launch scaling. parseConfig remains the sole duration/presence parser; add an optional presence observer rather than a copied TOML parser. Generated producers searched by pollerDeadline/finish-poller and host commands: executor-run/safety/close/remote are CJS shell snippets; suite-candidate writes ESM barrier.mjs with top-level await. The old fake-VM barrier arithmetic control will move to actual owned CJS/ESM T3 host controls (no borrowed T1 proof); original budget/exit and candidate assertions remain.

### impl-2046 · 2026-11-21T08:37:34.789Z

Batch correction at879df801b (tree49ccf9c03950bc4171b3e3e32d8cd47b20b3e4e1): M4 generated producer now uses portable dynamic import and preserves per-admission sampling; actual CJS and top-level-await ESM controls replaced the former T1 VM case (no tier-proof reuse). M5 source config presence comes from parseConfig's additive validated-setting observer; SuiteLimits adds optional testTimeoutIsDefault. Explicit settings and legacy admitted snapshots lacking provenance remain exact. Consumer search: suiteLimits/run-suite; suite-command (stall/workers only); suite-shards and territory (workers only); hub/suites config/admitted job snapshots, suite-worker serialization, RunRef/executor policy and droplet CLAND_SUITE_LIMITS export; persisted job readers remain compatible because the field is optional. parseConfig callers retain the same ProjectConfig value shape; strict parsing/validation remains shared. Prior four-field cached shape is retained as a regression. Poller producer search includes executor-run, executor-safety (including package-script and explicit50 fault), suite-close-recovery, suite-remote-process, and suite-candidate's barrier.mjs. Only suite-candidate has a top-level-await ESM host; native controls now exercise both formats. Existing native argv, configured1000ms and candidate final receipt assertions remain unchanged.

### impl-2046 · 2026-11-21T08:49:09.174Z

Coordinator scope decision82b46a05-cf5f-48e8-a5aa-09178ed42eff explicitly accepts conservative exact limits for fresh projectConfig-backed admissions that omit test_timeout, as well as legacy-unknown snapshots. This repository explicitly configures120s. Positive default provenance through fresh admission/config capture is deferred Tech debt with shared-parser ownership and rule19 live-hub handling; Coordinator is filing the follow-up. Reviewer notified. No source change after879df801b.

### rev-40 · 2026-11-21T08:49:52.185Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2046-M45-source
commit: 879df801bf87a7f706bad73b4ffc2189e896146b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow M4/M5 source clear; Standards0/Spec0 findings. Dynamic import supports actual CJS/TLA-ESM hosts with per-producer timer sampling; native owner/result/close/pipes and unchanged candidate/fault assertions checked. Validated config parser owns presence; optional SuiteLimits default provenance scales only stricttrue, explicit and prior4field admitted bounds exact. New hub projectConfig admissions also lack provenance/stay exact: fact-checked and explicitly accepted by Coordinator82b46a05 as separate Tech debt, not claimed complete. Matching docs/skill provenance and old-shape consumers reviewed. A-22438 final-head native/module/timeouts/importer/argv/static receipts independently inspected; dirty red epochs/missing platform fields/redactions not reconstructed. C2 reverified:1963report-onlysites/0refusals and planted census pass. C1 final pending fresh same-head mode-free result; previousa1147b6e only71dc49862, failed13518715/batch33dcd1f7 retained. No newWeb/fullT3/T4 or Reviewer execution/edits.

Criteria: C2 verified.

### rev-40 · 2026-11-21T09:17:41.848Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2046-final2
commit: 879df801bf87a7f706bad73b4ffc2189e896146b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected-head final clear; no findings. A-22448/63d4441c exact head/canonical executable tree passed T0/all239T1/fallback442T2/selectedT3(candidate7+runner64)/mappedT4oneparent/Web55:7326pass/1Mac-selector skip/0fail/cancel. Named CJS/ESM timer/native-close, explicit/legacy exact bound, real argv, condition/Discord/browser and original reload/Hosts receipts independently pass; A-22438 current-head whole timeouts19 and refreshed importer22/17/4/1 remain local required evidence. C1/C2 verified. C2 census1963/zero refusals and planted control current. Coordinator82b46a05 boundary retained: fresh projectConfig admissions without provenance stay exact too; separate Tech debt owns propagation, not claimed fixed. NoncachedLinuxx64c8ams3 Node24.21/Nvim0.12.5; HeadlessShell1248/CfT156.0.8078.4. RemainingT3merge batch/restT4 and T4repetitions unexecuted; budgets report-only. Earlier failed13518715/batch33dcd1f7 and dirty epoch/provenance gaps retained; no old-head green reused. No Reviewer runtime/probes/edits.

Criteria: C1 verified, C2 verified.

### impl-2046 · 2026-11-21T11:21:01.180Z

Coordinator-authorized merge0a55e5aa: merged origin/dev411a30431 as8b6d33a2b, resolving only suite-runner conflict by keeping all T-1911 tests plus optional load-injection argument. Pinned snapshot_size change received precommit matching config-set/host-pools-config/executor-prepare-component and frozen CLI usage/help checks:93 pass, native0/null (candidate tree99a93a38430af7b910a34a38b55b84f8b4b31d18). Coordinator77c53678 then authorized merged interaction fix50d574568: run-suite delegates repetition defaults; load/Web owners sample at each child admission, explicit startupMs stays exact. Shared waitTimeoutMs accepts optional supplied environment; startup helper accepts omitted factor for current sampling and rejects invalid explicit numeric factors. All function consumers searched: suite-command preserves its finite explicit production setup factor; runner initial/repetition startup and load/Web fallbacks migrated; new until policy controls cover supplied env/current load/cap/overrides and converted missing factor rejection. Dev CLAND_TEST_LOAD_FACTOR readers searched by git grep: remaining production reader suite-command explicit suiteLoadFactor path, centralized policy reader, test injection/deletion/assertion controls, and docs. No new wire/config fields. Existing native/browser/timeout assertions retained. Final-head native files and all T1/static checks pending.

### rev-40 · 2026-11-21T11:30:21.002Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2046-merge-source
commit: 50d5745686ab27675e8bb8370a89915a5414f5c7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear; Standards0/Spec0 findings. Merge retains landed T-1911 cases and optional load-injection/native argv proof. Runner delegates repetition defaults; load/Web owners sample shared helper per child from supplied env, preserving explicitstartupMs and no-output cap. Optional env is backward compatible; invalid explicit factors refuse, production suite-command finite factor path unchanged. Two red/green interaction controls and raw-reader/consumer inventory checked; docs/provenance match. A-22474 current-head runner68/remote46/T1 2106/T2 78 plus lint/typecheck native0/null inspected, separate precommit rule33config/help93 proof scoped correctly. C2 reverified:1965report-onlycensus/0refusals. Prior82b46a05/T-2051 boundary retained. C1 final pending fresh same-head mode-free result, no current-headWeb/fullT3/T4 claimed. No Reviewer runtime/probes/edits.

Criteria: C2 verified.

### rev-40 · 2026-11-21T12:01:50.221Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-2046-final3
commit: 50d5745686ab27675e8bb8370a89915a5414f5c7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final clear; no findings. A-22483/1bd00799 matches source-clear head/canonical executable tree: T0/allT1/fallbackT2/sixselectedT3(151 identities)/mappedT4base/Web exit0,7451pass/1Mac-selector skip/0fail/cancel. Independently checked all151 selectedT3 finishes and exact supplied-env/default/refusal/explicit-timeout, repetition startup/cleanup/finalizer/normalWeb10of10, native argv, CJS/ESM and browser receipts. C1/C2 verified; current1965report-onlycensus/0refusals and planted base+5 passes. Current-head local merge proofs remain scopedA-22474; precommit rule33candidate evidence separate. NoncachedLinuxx64c8ams3 Node24.21/Nvim0.12.5, HeadlessShell1248/CfT156.0.8078.4. RemainingT3 merge batch/restT4 and T4repetitions unexecuted; budgets advisory, no measured latency/speedup claim.82b46a05/T-2051 admitted provenance exception unchanged, previous greens/failures keep their heads/outcomes. No Reviewer runtime/probes/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T12:55:31.810Z

Merged b793535d7e39dfb2f2f18bbfe113c3ca7fc88bc3 onto dev.
