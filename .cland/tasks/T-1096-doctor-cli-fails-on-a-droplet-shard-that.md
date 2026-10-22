---
id: T-1096
kind: task
title: doctor-cli fails on a droplet shard that never builds the web bundle
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-839
branch: t/T-1096-doctor-cli-fails-on-a-droplet-shard-that
created: 2026-10-22T07:20:08.870Z
updated: 2026-10-22T08:38:48.635Z
---

## Summary

The E-416 stage cover 5be1db36 (A-9000, shard-1 log A-9001, dev 90c54f5a, Linux droplet) failed four tests in `hub/test/doctor-cli.test.ts` "doctor CLI renders healthy text and JSON with exit 0": actual `warn web bundle: web/dist build stamp missing or invalid — npm run build in the cland installation`, expected no warnings (`23 ok, 1 warn` vs `24 ok, 0 warn`). The droplet checkout removes `web/dist/`, and `hub/test/run-suite.ts` builds the bundle before workers only when the shard runs Web tests or `hub/test/web-auth.test.ts` (`bundleScan`). After the 6e797f08 baseline refresh re-partitioned the shards, doctor-cli ran on a shard with neither, so the bundle was never built. At db122ec9 (918951c2) the same shard also ran web-auth and passed.

## Acceptance criteria

- [x] C1. A hub-only shard whose selection contains `hub/test/doctor-cli.test.ts` but neither Web tests nor `web-auth.test.ts` builds the web bundle before its workers start; a suite-runner test proves it the way "a hub-only shard builds the bundle before its secret-scan worker starts" does (test).
  - done: impl-1096 · 2026-10-22T08:16:37.163Z
  - verified: rev-23 [reviewer] · run rev-20261022-1096-final · 2026-10-22T08:27:21.591Z · commit 34650f114ea4adcd190ce75dcb9c1b758f3b15c9
  - verified: rev-23 [reviewer] · run rev-20261022-1096-final-2 · 2026-10-22T08:38:48.200Z · commit 67a2f0650f96f1116afd783d410040390a8f632d
- [x] C2. Every other hub test that reads the built bundle or its stamp is either in the same build condition or independent of the checkout's `web/dist`, and the list is in the item topic from a search of hub/test (test).
  - done: impl-1096 · 2026-10-22T07:25:18.893Z
  - verified: rev-23 [reviewer] · run rev-20261022-1096-source · 2026-10-22T07:29:31.249Z · commit 7c1469bc81d0a724dc87d64eeebb919e4116ec37
  - verified: rev-23 [reviewer] · run rev-20261022-1096-source-2 · 2026-10-22T08:17:20.361Z · commit 34650f114ea4adcd190ce75dcb9c1b758f3b15c9
  - verified: rev-23 [reviewer] · run rev-20261022-1096-final · 2026-10-22T08:27:21.591Z · commit 34650f114ea4adcd190ce75dcb9c1b758f3b15c9
  - verified: rev-23 [reviewer] · run rev-20261022-1096-source-3 · 2026-10-22T08:29:24.751Z · commit 67a2f0650f96f1116afd783d410040390a8f632d
  - verified: rev-23 [reviewer] · run rev-20261022-1096-final-2 · 2026-10-22T08:38:48.200Z · commit 67a2f0650f96f1116afd783d410040390a8f632d

## Comments

### impl-1096 · 2026-10-22T07:23:49.396Z

Added the requested synthetic doctor-only shard regression before fixing runSuite; red on 90c54f5a plus test: ENOENT web/dist/index.html, existing secret scan green (A-9004). Both cases pass with the named installedBundleReaders prerequisite (A-9005), local Darwin arm64 targeted T3, no suite/gate. C2 reader audit is in topic-839. Updated hub README, tests guide and implement skill; role clauses untouched at reserve. Fetched and merged origin/dev before first source review (74175ef9). Full targeted runner file and typecheck pending.

### rev-23 · 2026-10-22T07:29:31.249Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1096-source
commit: 7c1469bc81d0a724dc87d64eeebb919e4116ec37
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0 findings. A-9013 records the independent bundle-reader audit and isolated T3 regression review; C2 verified. Original local targeted A-9004 red, A-9005 green, A-9007 45/45 are supporting evidence, not a configured gate. C1 final settlement remains pending ordinary mode-free same-head verification. QA none.

Criteria: C2 verified.

### impl-1096 · 2026-10-22T07:39:01.688Z

Source clear at 7c1469bc (rev-20261022-1096-source); C2 independently verified. Mode-free verify 7be3f149 (A-9016), Linux x64 droplet c-8 lon1, exit 1: T1 and all-T2 fallback passed; Web failed `web/test/palette.test.ts` 1024×600 with `Error: PageDown reveals open-other: not within 6000 ms`, plus its parent failure. 2412 total / 2410 pass / 2 fail. No T3 run; local targeted runner evidence remains A-9007. Typecheck host gate reused, not repeated; tier/budget diagnostics report-only. Shared-defect candidate reported to lead T-1096; holding diagnosis and head changes for Coordinator. Final readiness pending.

### rev-23 · 2026-10-22T07:39:26.752Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1096-evidence-1
commit: 7c1469bc81d0a724dc87d64eeebb919e4116ec37
scope: evidence
findings: [{"severity":"medium","text":"Same-head A-9016 fails 1024×600: 'PageDown reveals open-other: not within 6000 ms'; parent also fails and trips enforced 8.494s > 5s duration gate. Untouched task source: shared-defect candidate requiring lead/Coordinator disposition; allowance alone cannot fix the assertion.","file":"web/test/palette.test.ts","line":212}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9019 records original-log audit. Evidence not clear: T1/T2 pass, actual Web fails, 2410 passes/2 test failures (subcase plus parent), overall exit1. No remote T3/T4/load evidence. Source A-9013 and C2 audit retained; no new implementation defect established. Route shared candidate to Coordinator before retry or unrelated edits.

Criteria: C1 failed (Final configured evidence blocked: A-9016 exits 1 on viewport PageDown assertion plus 8.494s > 5s gate; runner regression itself not disproven.).

### rev-23 · 2026-10-22T07:50:00.729Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1096-evidence-2
commit: 7c1469bc81d0a724dc87d64eeebb919e4116ec37
scope: evidence
findings: [{"severity":"medium","text":"A-9031 at unchanged reviewed head fails 'PageDown reveals fold-open: not within 6000 ms' in1280×720 plus parent/enforced8.806s>5s. Same shared palette blocker; Coordinator7684f7cb requires waiting for T-1097 cherry-pick, not clearance on this failed retry.","file":"web/test/palette.test.ts","line":212}]
finding_counts: {"high":0,"medium":1,"low":0}

Original A-9031 lines13374–13383 and task.view confirm exact reviewed head7c1469bc, retry615a5c7f failed. T1/allT2 exit0; actualWeb exit1;2410pass/2fail(subcase+parent); T3 absent. Linuxc8lon1 cland-v0-92451801,544s/$0.0378,hostb48e0ca0 reused/not repeated; report-only diagnostics distinct from enforced5s gate. Source/C2 audit retained. No additional retry requested; wait for posted T-1097 fix and delta review under latest Coordinator decision.

Criteria: C1 failed (Authorized retry A-9031 remains red: 1280×720 PageDown reveals fold-open timeout plus 8.806s > 5s gate; await T-1097 shared fix per Coordinator7684f7cb.).

### impl-1096 · 2026-10-22T07:50:20.070Z

Coordinator-authorized unchanged-head retry 615a5c7f (A-9031), Linux x64 droplet c-8 lon1, failed only the T-1097 palette test: 1280×720 `PageDown reveals fold-open: not within 6000 ms`, plus parent 8.806 s > 5 s enforced gate. T1/all-T2 fallback passed; Web failed; 2412 tests / 2410 pass / 2 fail; no T3. Prior A-9016 failed same test at 1024×600/open-other. Latest Coordinator disposition: hold 7c1469bc and claim for posted T-1097 cherry-pick, delta review, then mode-free verify. Source/C2 retained; C1/final evidence remains blocked. No further retry.

### impl-1096 · 2026-10-22T08:17:06.176Z

Coordinator decision d4096542 authorized exactly shared fix e2233f5e. Cherry-picked without conflict onto 7c1469bc, producing 34650f114ea4adcd190ce75dcb9c1b758f3b15c9, pushed to origin. Only palette.test.ts and durations.json changed; no dev merge. C1 re-marked done; delta source review requested from reviewer in topic-839 before mode-free verification.

### rev-23 · 2026-10-22T08:17:20.361Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1096-source-2
commit: 34650f114ea4adcd190ce75dcb9c1b758f3b15c9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear under Coordinator d4096542: exactly posted shared fix e2233f5e, only palette test and exact 7.5s dated E-880 allowance. Test blob46dbe218 identical to reviewed T-1097; original bundle implementation/test/docs unchanged. C2 audit refreshed. Historical failed task receipts retained; C1 final evidence awaits ordinary mode-free configured run at this exact head. QA none.

Criteria: C2 verified.

### impl-1096 · 2026-10-22T08:26:51.977Z

Mode-free verify fa8f555e at exact delta-reviewed 34650f114ea4adcd190ce75dcb9c1b758f3b15c9 passed (A-9051): Linux x64 droplet c-8 lon1, 2412/2412 pass, T1/all-T2 fallback across hub and Neovim/actual Web exit 0. T3 absent, deferred to periodic/integrated occasions (absent configured batch tiers). Budget/tripwire diagnostics report-only; host typecheck gate 2a4876c7 reused, not repeated. Lifetime 498 s, cost $0.0346. Asked Reviewer to settle C1/final evidence; head unchanged, claim retained, no merge.

### rev-23 · 2026-10-22T08:27:21.591Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1096-final
commit: 34650f114ea4adcd190ce75dcb9c1b758f3b15c9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear: original A-9051 / fa8f555e matches reviewed head; independently audited 2412 ordinary passes / 366 file passes, actual T1/all-T2/Web exit0, no load-scoped finishes. Former palette blocker passes both sizes, parent4.762626766s. C1 completed with unchanged-source local T3 runner proof A-9004/A-9005/A-9007 plus green configured task gate; explicitly no remote suite-runner/T3 execution. C2 source audit retained. Linux498s/$0.0346; host2a4876c7 reused, report-only diagnostics retained. C1/C2 verified; QA none.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-22T08:29:24.751Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1096-source-3
commit: 67a2f0650f96f1116afd783d410040390a8f632d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear under e84d4f53. Metadata conflict preserves T-1096/T-1054/T-1059 provenance; task diff versus incoming dev remains six files44+/9-. Runner and regression blobs identical to prior final source, C2 reader audit refreshed. A-9053 original post-merge local T3 cases2/2 supports C1; no configured/Linux gate inferred. C1/final evidence pending ordinary mode-free exact-head receipt; prior A-9051 historical. QA none.

Criteria: C2 verified.

### impl-1096 · 2026-10-22T08:38:25.931Z

Coordinator-authorized origin/dev merge 92dc7144 produced 67a2f065; sole skill metadata conflict resolved preserving both sides. Local post-merge shard regressions 2/2 green A-9053. Reviewer delta source clear rev-20261022-1096-source-3. Mode-free ee41e5ab at exact 67a2f065 passed: A-9059, Linux x64 droplet c-8 lon1, 2425/2425 pass, T1/all-T2 fallback/actual Web exit 0. T3 absent; host check 7339b3a reused/not repeated; report-only diagnostics retained. Lifetime 476 s, $0.0330. Final evidence settlement requested; no merge performed.

### rev-23 · 2026-10-22T08:38:48.200Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1096-final-2
commit: 67a2f0650f96f1116afd783d410040390a8f632d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head clear: original A-9059 / ee41e5ab matches exact reviewed67a2f065; independently audited2425 ordinary passes/370 file passes, actual T1/all-T2/Web exit0, no load-scoped finishes. C1 uses accepted source plus local post-merge A-9053 2/2 and prior A-9007 45/45; zero remote runner/T3 finishes, explicitly not LinuxT3 proof. C2 audit retained. Linux476s/$0.0330; host7339b3a reused; report-only warnings/four missing baselines retained. C1/C2 verified; QA none.

Criteria: C1 verified, C2 verified.
