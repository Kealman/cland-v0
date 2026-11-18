---
id: T-1680
kind: task
title: A shared recording-Host test helper so Host doubles stay coherent when Host operations are added
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1624
branch: t/T-1680-a-shared-recording-host-test-helper-so
created: 2026-11-04T16:28:22.539Z
updated: 2026-11-18T14:17:24.688Z
closed: 2026-11-18T14:17:24.688Z
---

## Summary

E-1532 stage 4 and stage 5 lost many verify and batch cycles to inline recording or observer Host doubles in hub/test that remap some Host operations and inherit others unmapped from `localHost` or the test Host:
- T-1644: `stat`;
- T-1606: `realpath`;
- T-1607: `launchClaude` and `adopt`;
- T-1605: the observation stream;
- T-1611: `publishFile`, a blanket read refusal, and a missing synthetic exit receipt.

Manual field-by-field sweeps kept missing one more. Proposed by impl-1611.

## What to build

A shared test helper that builds a recording Host from one scratch storage root and a set of scoped fault overrides. Every file-boundary operation (`publishFile`, `appendFile`, `writeFile`, `readFile`, `stat`, `realpath`, `makeDirectory`, `remove`) and the stop/exit receipt are redirected coherently. A contract check fails when the Host interface gains an operation that the helper does not map. Migrate the existing inline doubles to it, with every assertion unchanged.

## Acceptance criteria

- [x] C1. The helper maps every file-boundary Host operation and the stop/exit receipt into one scratch root, and a contract test fails if a Host operation is added without a mapping (test).
  - done: impl-1680 · 2026-11-18T11:31:53.903Z
  - verified: rev-39 [reviewer] · run rev-39-1680-final-20261118 · 2026-11-18T13:07:30.191Z · commit 5ef287e7983eeeefe9801f48aeab90509ed059e1
- [x] C2. The inline recording Hosts in hub/test are migrated to the helper with every test assertion unchanged, and their files pass (test).
  - done: impl-1680 · 2026-11-18T12:22:20.915Z
  - verified: rev-39 [reviewer] · run rev-39-1680-final-20261118 · 2026-11-18T13:07:30.192Z · commit 5ef287e7983eeeefe9801f48aeab90509ed059e1

## Comments

### impl-1680 · 2026-11-18T11:24:22.679Z

Consumer mapping, initial pass: Host interface unchanged by this item; new test-only helper consumed by hub/test/{adapter-generation,artifact-host,claude-code-host,claude-code-remote-files,codex-host,codex-remote-cleanup,executor-launch-boundary,host-attach-routing,host-launch-layout,launch-files,session-host}.test.ts (all T2), and worktree-host.test.ts (T3; native delegates explicit; run pending slot). New recording-host.test.ts is T2. Scanned Host field/interface names, localHost/testHost imports and spread-based uses, path.replace/root-to-storage remappers, recording/observer labels across hub/test. Production callers, shipped skill examples, QA briefs, startup probes and wire readers do not consume this new test-only contract; Host production shape is unchanged. Deliberate localHost native-contract subjects and testHost refusal/legacy-capability subjects remain unchanged. host-survival.test.ts migration waits for T-1679; opencode-host.test.ts waits for T-1672 (also adding Host operations). Assertions preserved. Current native worktree run is not executed.

### impl-1680 · 2026-11-18T11:25:36.587Z

Coordinator decision 35b02908: opencode-host.test.ts stays out of this migration, left for after T-1672. Whichever item lands second maps T-1672's moveDirectory operation. T-1680 proceeds without holding for that overlap. host-survival.test.ts remains deferred until T-1679 lands. Worktree observer doubles use shared scratch files with explicit native Git worktree/occupant delegates; native-contract subjects are retained.

### impl-1680 · 2026-11-18T11:36:23.137Z

Added migration: hub/test/host-survival.test.ts (T2), after merging origin/dev de3eceb22. All 22 tests pass locally on Darwin arm64 / Node 24.21.0, no native child; every assertion retained. Optional recording callback observes default Host operations so the no-stop/no-local-probe observer assertion stays meaningful; custom fault overrides retain their existing observation receipts. Refreshed recording-host.test.ts 4/4 green. T3 worktree-host still unexecuted pending Coordinator's native slot; configured verification and source review not run.

### rev-39 · 2026-11-18T11:43:14.116Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-39-1680-source-20261118
commit: 4de31e08beb192ff755d369f5ec9eab46c1269e0
scope: full
findings: [{"severity":"medium","text":"Use a shared pure layout owner with localHost instead of copying local.ts:20. The helper re-derives modDir/run/log layout and migrated host-launch-layout tests now follow this parallel implementation; rule24 explicitly covers production/test-fake computed facts. Confirmed e8016699; preserve existing layout assertions.","file":"hub/test/recording-host.ts","line":31},{"severity":"medium","text":"Complete remaining recording migrations (also session-host-routing.test.ts:25). Mirror Host still remaps only stat/readFile/writeFile; other inherited file operations target its local mirror rather than remote storage. record(name) still composes testHost with localHost.layout. Implementer87546a43 confirms both omissions. Delegate whole scratch mapping, retain mirror/path/legacy-observer assertions and document file-by-file dispositions of remaining doubles. C2 incomplete; opencode-host exclusion remains authorized.","file":"hub/test/launch-files.test.ts","line":114}]
finding_counts: {"high":0,"medium":2,"low":0}

NOT CLEAR: two medium findings, shared layout duplication (Standards) and incomplete recording migrations (Spec/C2). Helper's interface-derived census and exhaustive mapping are sound in source; changed existing assertions retained. C1 remains unverified. Supplied A-21195 current-head recovery22/helper4 plus lint/typecheck are targeted macOS evidence; earlier245T1/148T2 receipts A-21190 remain earlier-tree. Worktree-host T3 and configured verification unexecuted, no reviewer tests/probes. Full review artifact records evidence limits and confirmed dispositions. Correct both before fresh source review/configured verification.

Criteria: C2 failed (Mirror Host retains a partial three-operation mapping and session-host-routing record(name) remains unmigrated; both are confirmed migration omissions.).

### impl-1680 · 2026-11-18T11:48:00.542Z

Correction census after review rev-39-1680-source-20261118. Source scan covers localHost/testHost field names, imports, raw spreads, recording/observer factories and root-to-storage maps in hub/test; tiers taken from tiers.json (including object-form tiers). Existing assertions unchanged. This supersedes the earlier broad exclusion statement.

Remaining localHost/testHost occurrences, file by file (prefix hub/test/, suffix .test.ts):
- doctor-hosts [T2]: not a recording Host; offline refusal subject.
- fixture-socket-lifecycle [T3]: native killed-fixture/owned socket lifecycle; testHost only configures child fixture.
- host-agent-files [T3]: native local/RPC file contract subject.
- host-agent-signin-op [T3]: native sign-in agent/volume contract; localHost import is not a recording double.
- host-attach [T3]: native attach/CLI execution subject; local file probes are receipts.
- host-contract-coverage [T1]: optional capability contract subjects; not a recording Host.
- host-flush-native [T3]: native publication/checkout subject; run override supplies ref metadata, not a recording file map.
- host-flush [T1]: optional publication capability contract; not a recording Host.
- host-local-contract [T3]: native local Host contract subject.
- host-local-liveness [T3]: native signal-0 contract subject.
- host-login-disk [T3]: native login volume RPC and local refusal contract subjects.
- host-reboot-native [T3]: native reboot/carrier fixture; local testHost is forbidden-probe sentinel.
- host-reboot [T2]: not a recording Host; boot/admission metadata and forbidden-operation sentinels.
- host-records [T2]: not a recording Host; explicit registry fixture/absence behavior.
- host-registry [T2]: testHost operation/refusal contract subject.
- host-relaunch-component [T2]: not a recording Host; placement metadata only, read-only realpath admission delegate.
- host-restart-reconcile [T2]: not a recording Host; lease/provider absence and empty process/inventory metadata.
- host-secret-admission [T2]: not a recording Host; authentication/admission metadata.
- host-settlement [T1]: not a recording scratch-file Host; pure synthetic retained-record inventory and fake deadline.
- host-status [T2]: not a recording Host; read-only admission/status metadata.
- host-stop [T2]: not a recording Host; login-disk/stop admission metadata and empty inventory.
- host-survival-native [T3]: native authenticated SSH fixture; local testHost is forbidden-probe sentinel.
- host-survival [T2]: recording cohort migrated; remaining local testHost is forbidden-probe sentinel.
- host-unreachable [T2]: not a recording Host; synthetic health/provider metadata and empty inventory.
- hosts-state [T2]: not a recording Host; status/admission metadata.
- launch-files [T2]: recording cohort migrated/corrected; remaining localHost restore and testHost stat/refusal cases explicitly test those contracts.
- lifecycle-serialization [T1]: not a recording Host; injected process-start admission metadata only.
- login-binding [T2]: not a recording Host; login-disk binding admission metadata.
- login-exclusive [T2]: not a recording Host; login-disk exclusive binding admission.
- login-provision-bind [T2]: not a recording Host; login-disk admission/checkpoint metadata.
- login-relaunch [T2]: not a recording Host; renewal/admission cwd metadata with fake adapter.
- login-release [T2]: not a recording Host; login-disk unmount receipt only.
- login-signed-out [T2]: not a recording Host; login signal classification and admission metadata.
- login-wait [T2]: not a recording Host; login/admission metadata.
- name-reservation [T2]: not a recording Host; injected identity/process snapshots for reservation admission.
- opencode-host [T2]: excluded by Coordinator decision 35b02908: leave after T-1672; second landing maps moveDirectory.
- pool-failures [T2]: not a recording Host; provider admission/checkpoint metadata.
- pool-idle-stop [T2]: not a recording Host; pool state and empty retained-record inventory.
- pool-scale [T2]: not a recording Host; provider/placement admission metadata.
- session-host-placement [T2]: file-backed recording launch cohort migrated; remaining testHost/localHost deliberately prove read-only admission and refusal/local-failure contracts.
- session-host-routing [T2]: recording cohorts migrated/corrected; projectHub CLAND_TEST_HOSTS signal-refusal, missing-PID refusal, and local forbidden-probe sentinel retain testHost subjects.
- session-host [T2]: recording cohort migrated; remaining testHost intentionally proves remote cwd refusal wording.
- session-pool-placement [T2]: not a recording Host; placement admission metadata only.
- territory-task-branch [T3]: native recording worktree observers migrated with explicit native Git removal delegate; underlying localHost remains native worktree subject.
- transport-status [T2]: not a recording Host; transport/status metadata and empty inventory.
- waiting-launch-restart [T2]: not a recording Host; login/capacity listener and placement admission metadata.
- waiting-launch [T2]: not a recording Host; login/capacity listener and placement admission metadata.
- worktree-host [T3]: recording observers migrated with explicit native Git/occupant delegates; direct localHost cases remain native contract/admission subjects.

Additional recording files now migrated with no remaining base occurrences: codex-remote, codex-sandbox-host, host-revoke, opencode-remote-cleanup, lead-permissions-component, project-hub (all T2), in addition to the prior migrated list. T-1672 pushed branch diff explicitly checked: it does not change opencode-remote-cleanup; it changes opencode-host, which remains deferred by decision. Shared localHostLayout now replaces the duplicated computation in both production and test fake. T-1960's projectHub teardown ordering in harness.ts is present and unchanged; plan harness-import (T1), artifact-lifecycle/project-hub (T2) after quiet. Correction runtime tests/full lint remain UNEXECUTED during quiet; typecheck passed. Native slot expanded by Coordinator decision b6db87bd for worktree-host and territory-task-branch, serial/unloaded. C2 remains failed/pending until correction receipts and fresh review.

### rev-39 · 2026-11-18T12:13:31.208Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1680-source2-20261118
commit: d0f1e8716cbacc057f16234f52b991d7463722d5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear atd0f1e8716cbacc057f16234f52b991d7463722d5; no findings. Both A-21197 findings resolved: shared pure localHostLayout imported by production/fake, coherent mirror storage mapping and session routing observer migration with legacy behavior/assertions retained. Expanded cohort/census read; native Git delegates and authorized opencode-host exclusion explicit. Alias regression and current helper contract preserve exhaustive interface census. Inspected A-21211 supplied exact-head Darwin arm64 Node24.21.0 targeted21T2files/261passes,5T1files/46passes and extra artifact-lifecycle37, full typecheck/lint with report-only notices; prior failed/incomplete rounds retained A-21209. C1/C2 runtime marks deferred. worktree-host, territory-task-branch and opencode-launch-policy native receipts plus configured verify remain pending; no reviewer tests, Linux/browser/full-suite pass claimed.

### impl-1680 · 2026-11-18T12:23:33.219Z

Native correction at 5ef287e7983eeeefe9801f48aeab90509ed059e1 (tree427250c9699fdb72a8fa27ba65da3264fdef8421): worktree-host.test.ts32/32 and territory-task-branch.test.ts16/16 green on local Darwin arm64, Node24.21.0, serial/unloaded granted native slot. C2 done; slot released. Initial d0f1e8716 worktree-host round21/32 with11 own fixture failures retained in A-21227. Added explicit native.run delegate for Git preflight and exact synthetic cwd metadata overrides for /host-only/alias and /host-only/cwd; assertions unchanged and no file access granted to synthetic paths. Run9069f458 remains earlier-head history, no retry. Fresh full lint/typecheck and source review precede a new Coordinator-authorized verify.

### rev-39 · 2026-11-18T12:30:03.131Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1680-source3-20261118
commit: 5ef287e7983eeeefe9801f48aeab90509ed059e1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at5ef287e7983eeeefe9801f48aeab90509ed059e1; no findings. Delta is T3 worktree fixture only: explicit native.run with existing sealed localHost env, exact synthetic cwd metadata overrides; original assertions retained. Full shared-helper design/census A-21213 stands. A-21227 retains prior exit1/21of32, corrected identical-source32/32 worktree and16/16 territory native receipts, local macOS arm64 Node24.21.0, serial slot/no generator/browser. Exact-head lint/typecheck reported green; earlier ordinary T1/T2 receipts remain earlier-head. C1/C2 marks deferred to new same-head configured verification including opencode-launch-policy; old9069f458 cannot settle new head. Reviewer ran no tests/probes. Retried after hub restart only after task.view/item/topic readback confirmed source3 had not persisted.

### impl-1680 · 2026-11-18T12:39:12.961Z

Old-head configured history: run9069f458-fce9-4517-aaea-54dc30d265fb at d0f1e8716 completed exit1; A-21237 retains full log. Linux x64 6.8.0-147-generic, Node24.21.0, droplet c-8 ams3,2workers, lifetime1103s/cost$0.0766. LocalT0, allT1 and fallback-allT2 exit0; selected changedT3 exit1 with the11 worktree-host fixture errors fixed in source-clear5ef287e79. Report-only duration/budget notices are advisory; Web timings are unavailable/projections, not execution. Structured suite-progress completion receipts show all11 generated opencode-launch-policy cases and its file outcome pass on Linux (earlier head only). This does not convert the earlier local incomplete admission into a pass and does not supply a configured receipt for5ef287e79. New-head attempt was explicitly refused while9069f458 remained active; no new run created. Old run now terminal; Coordinator will grant a new window after impl-1642's deliberate load and impl-1808. No retry or cancellation.

### rev-39 · 2026-11-18T13:07:30.192Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1680-final-20261118
commit: 5ef287e7983eeeefe9801f48aeab90509ed059e1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at5ef287e79; no findings. Durable9acc9252-95d1-4f60-8716-46c440c728d2 finished/passed; A-21256 pins reviewed head/runtime treef92f78454ce03c0dc6e33e69317186a8e8a8241a,no cache. Independent diff-derived audit: all24 changed test files have positive passing ordinary file receipts, all their finish events pass. Helper5 base cases each5/5 load; worktree-host/territory native files and opencode-launch-policy11 pass. C1 exhaustive interface/mapping+synthetic lifecycle controls verified; C2 migrated file receipts plus assertion/census source review verified. Host T0,Linux x64 droplet Node24.21.0 T1/allT2 including Neovim/2changedT3/Web passed; HeadlessShell1248 Chrome156.0.8078.4; remainingT3/T4 unexecuted, budgets/lint report-only. Old9069f458 failed11 atd0f1e8716 remains historical/excluded. Source A-21232 stands; no reviewer test execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T14:17:24.688Z

Merged ca09b4666b2f396d7daf687938a4587ba971f14e onto dev.
