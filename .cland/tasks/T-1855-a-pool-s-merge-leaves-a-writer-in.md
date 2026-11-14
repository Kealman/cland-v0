---
id: T-1855
kind: task
title: A pool's merge leaves a writer in territory.git at teardown (ENOTEMPTY in session-native-lifecycle)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1508
branch: t/T-1855-a-pool-s-merge-leaves-a-writer-in
created: 2026-11-14T09:54:49.415Z
updated: 2026-11-14T12:22:31.247Z
closed: 2026-11-14T12:22:31.247Z
---

## Summary

`hub/test/session-native-lifecycle.test.ts` "an Implementer pool moves to the next task worktree after merge (opencode, keep_context=true)" failed in the E-1537 stage-2 macOS cover 4a852872 at dev 5757ea8dd (log A-19327, darwin arm64, 1 worker, peak 1-minute load 8.43) during fixture teardown: `ENOTEMPTY: directory not empty, rmdir '/private/tmp/cland-suite-…/cland-proj-…/.cland/territory.git'` (4.8 s). Something still wrote into the fixture's territory repository while the root was removed: a git process from the merge, a hub-owned writer, or a child not yet joined.

## What to build

Find which process writes into territory.git after the case's assertions complete. The candidates are the merge's git processes, the territory sync, a spoke, or the opencode fake. Then make teardown join it first, through the existing process-cleanup ownership, rather than retrying the rmdir. If a product component keeps writing after the hub reports the merge complete, name it as a product finding.

## Acceptance criteria

- [x] C1. The writer still active at teardown is named on this item, and teardown joins it before removing the fixture root; a forced delayed writer reproduces the ENOTEMPTY failure before the fix and passes after it (test).
  - done: impl-1855 · 2026-11-14T11:00:09.437Z
  - verified: rev-36 [reviewer] · run rev-36-1855-final-1 · 2026-11-14T11:25:16.648Z · commit 79d4eb5dd42b4b2bd5277ea570e7f1cbd2bece00
- [x] C2. The case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify (test).
  - done: impl-1855 · 2026-11-14T11:00:09.688Z
  - verified: rev-36 [reviewer] · run rev-36-1855-final-1 · 2026-11-14T11:25:16.648Z · commit 79d4eb5dd42b4b2bd5277ea570e7f1cbd2bece00

## Comments

### coord · 2026-11-14T09:56:25.335Z

Moved into R-1530 by ask d641172c (human, 2026-11-14 09:56Z): fix before rerunning the E-1537 stage-2 cover pair on a new tip.

### impl-1855 · 2026-11-14T10:03:15.014Z

Writer: TaskMerges background prune retry; native worktree disappearance precedes remaining territory branch/config writes. stop previously cancelled only pending timers. Forced 400ms territory writer at prune boundary reproduced ENOTEMPTY in territory.git plus unfinished-writer teardown assertion on macOS, Node v24.21.0. Rule-20 consumers: Dispatcher.close (awaited by serveProject.stop before tracker/store teardown), merge-component-support awaited stop, plan-stage-fixture promise-returning owner, merge-batches promise-returning t.after and explicit cleanup (migrated to await). No wire/persisted API change. Native and component fixtures retain original lifecycle assertions.

### rev-36 · 2026-11-14T10:10:00.037Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1855-source-1
commit: fd98253cee82586ae937ce81c9db42ed36d76542
scope: full
findings: [{"severity":"high","text":"35s race rejects while prune writers remain live; Dispatcher/daemon and shared fixture cleanup continue tracker/root/lock disposal. No whole-prune bound or cancellation/join owner exists. Retain ownership and fence/close native work before disposal; test actual shutdown beyond deadline.","file":"hub/src/hub/merge.ts","line":34},{"severity":"medium","text":"Promise.all can end the join when one retry/error logger rejects, leaving other writers active; deadline logger can throw before reject and escape the timer. Make outcome delivery independent of logging and join every admitted writer, with throwing-log/mixed-writer controls.","file":"hub/src/hub/merge.ts","line":39},{"severity":"medium","text":"Entry assertion precedes held-writer try/finally; native injected writer likewise has no independent join if hub stop fails and only asserts before root deletion. Register/join writer owners before admission, including early failure; shared cleanup continues disposal after errors.","file":"hub/test/merge-recovery.test.ts","line":31}]
finding_counts: {"high":1,"medium":2,"low":0}

Source not clear. A-19336 records Standards2 medium / Spec1 high and confirmed missing owners. Normal retry-drain/callsite migration is sound, but incomplete outcomes do not yet protect tracker/root/lock lifetime. Consolidate bounded owned cancellation, all-writer joining independent of logs, and early-failure fixture cleanup with docs/controls; request fresh source review before verify. Raw original logs were not retained; publish honest existing tool excerpts/launcher/inventory with linkage limits, no provenance-only rerun. C2 final configured evidence pending. No reviewer execution/delegation.

Criteria: C1 failed (Timeout, logging rejection and early-fixture-failure paths still permit unjoined territory writers or incomplete shutdown; owner-safe bounded cancellation and failure-path proof required.).

### impl-1855 · 2026-11-14T10:17:38.108Z

Coordinator approved retained-owner scope (7fde3b0e): no native cancellation in T-1855. At 35s stop returns typed incomplete carrying the same settlement. Dispatcher/daemon preserve tracker/storage/discovery/lock; fixture owners join settlement and retry shutdown before root deletion. Accepted limitation: a hung prune Git child may outlive hub process exit; native cancellation is tracked separately as T-1856. Consumer migration now covers TaskMerges fixture owners, Dispatcher.close, createHub.close ordering, serveProject.stop retention, CLI nonzero-exit flag, and projectHub root-removal guard. No new wire or persisted schema.

### impl-1855 · 2026-11-14T10:25:13.439Z

Additional rule-20 supervisor sweep: hub start detaches serve and observes its exit only during startup; no post-start respawn callback. Workbench socket autostart follows failed-connect streaks and 30s deliberate-stop grace, not serve exit 0 vs 1. Stdio routes all native exit codes through the same lost/retry path. UI :restart replaces Neovim and reattaches; it does not restart the hub. hub status only inspects/displays; no restart. There is no hub restart subcommand; explicit stop/start uses existing lock checks. No launchd/launchctl/SuccessfulExit/KeepAlive job script exists in current docs, skills, nvim or hub (word-boundary search). Exit 1 adds no exit-code-specific immediate respawn behavior in shipped supervisors. After process exit, any remaining orphan prune vs stale-lock recovery remains the explicitly accepted T-1856 limitation, not newly prevented here. No supervisor code changed.

### impl-1855 · 2026-11-14T10:26:22.192Z

External supervisor correction, approved decision0e1377ab: the operator-owned launchctl submit job is not shipped. It may respawn serve after exit1. A live holder refuses a new serve, but after serve exits1 the lock PID is dead; a respawned serve can reclaim hub.lock, and territory.lock can likewise be reclaimed while an orphan prune still writes. Retained lock files do not prove post-exit protection. This accepted post-exit stale-lock/respawn risk belongs to T-1856; no scope expansion or supervisor change in T-1855.

### rev-36 · 2026-11-14T10:27:07.820Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1855-source-2
commit: b9d1596af70a5845fef58b7c169898e7d24bcb24
scope: full
findings: [{"severity":"medium","text":"HUB_USAGE golden retains old bytes while production help adds two shutdown lines. cli-usage-compatibility.test.ts:7 deep-equals all exports with this fixture, so configured T1 must fail. Migrate the intended HUB_USAGE block and retain compatibility assertions; author confirmed omission.","file":"hub/test/fixtures/cli-usage/commands.json","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear for one medium help-golden omission; A-19341. Prior ownership/logging/early-fixture findings addressed in source under Coordinator7fde3b0e retained-owner decision. No native cancellation required; accepted hung-prune/post-exit stale-PID respawn risk belongs T-1856 per0e1377ab and must be stated precisely in docs. Retained A-19338 lists equal15625 names and A-19339 original excerpts/capture gaps inspected; not current-head native proof. Replacement component/native Mac5+pair and configured run still pending; no current-head test pass claimed. Correct golden/docs, restore implementation marks and request committed fresh source review before verify. Standards0 / Spec1. No reviewer execution/delegation.

Criteria: C2 failed (Current help export and frozen HUB_USAGE differ; required configured T1 compatibility case cannot pass until golden migration and fresh source review.).

### rev-36 · 2026-11-14T10:29:18.376Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1855-source-3
commit: ae6d89f769deacaf41d994f91601db7f11189a39
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0 / Spec0. A-19343 confirms only intended HUB_USAGE golden migration plus precise accepted-limit docs; decoded help/golden bytes exactly equal, compatibility assertions unchanged. Retained-owner implementation unchanged from pass2; structural ownership/logging/early-fixture fixes remain resolved under Coordinator7fde3b0e/0e1377ab. A-19342 explicit stop/fixture/CLI lower/native consumer dispositions read. Post-exit stale-lock/respawn risk expressly deferred to T-1856, no cancellation required here. C1/C2 final verification withheld pending replacement component/native Mac5+pair and exact-head mode-free positive receipts. Historical A-19338/39 provenance is not current-head proof. Proceed assigned-slot targeted evidence and configured verification at unchanged head; no Reviewer execution/delegation or provenance-only rerun.

### rev-36 · 2026-11-14T10:51:38.087Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1855-evidence-1
commit: ae6d89f769deacaf41d994f91601db7f11189a39
scope: evidence
findings: [{"severity":"medium","text":"Required OpenCode keep-context case fails with SyntaxError: Unexpected end of JSON input in final fake-session record JSON.parse. Observe the complete parsed record with expected directory using a bounded receipt predicate, retaining final equality and lifecycle assertions; do not classify this failed configured run as pass.","file":"hub/test/session-native-lifecycle.test.ts","line":233}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-19349. Exact failure read: SyntaxError Unexpected end of JSON input at session-native-lifecycle.test.ts233:26, native finish4.311383042s fail. T0/T1/all fallback T2 pass, changedT3 8/9, Web unexecuted;5920base passes/1fail and155separate load passes. All six new component identities have base+5 pass. No ENOTEMPTY/drain assertion failure; report-only advisories not cause. Retained exact-source Mac5 and7/7 pair A-19345 and equal15909-name inventory A-19346 checked with capture limits, but cannot replace failed configured result. No browser/Linux/fullT3/T4/QA pass. Await lead scope decision, narrow repair then fresh source review before retry; no Reviewer execution.

Criteria: C2 failed (Same-head configured7df82038/A-19348 exited1: required OpenCode keep-context native case failed parsing its session record; Web unexecuted.).

### impl-1855 · 2026-11-14T10:54:03.301Z

Atomic fake-session write consumer sweep: all five writeFileSync(sessionFile(...)) sites now call shared writeSessionRecord; fake GET /api/session filters shared isSessionRecord so temporary records cannot be listed. Hub production OpenCode adapter consumes HTTP session APIs, no sessions/<id>.json disk parser. Explicit-path fake consumers remain unchanged: session-native-lifecycle role receipt/final directory assertion; opencode-adapter missing-conversation/instructions controls; scenarios/crew-launch native location. None enumerates fake OpenCode temporary files. Claude sessions and host private-session directories are unrelated stores. T1 injected partial-write control red/green captured; final native reader/assert kept unchanged.

### rev-36 · 2026-11-14T10:56:26.903Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1855-source-4
commit: 95360b7ff81c235f9ad3dda4f37acd4782d80bf9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0 / Spec0. A-19351 records approved125ef736 fake-only atomic publication: all five session writers share unique same-directory temp+rename, listing filters .tmp, session/HTTP shapes unchanged. T1 injected half-write positive control preserves old complete final bytes before publication and new bytes after rename; source/guide/index reviewed. Production consumes HTTP, no fake-session disk parser found; native explicit readers inventoried. Original session-native-lifecycle final JSON.parse/directory assertion unchanged, no reader retry. A-19350 red/green3 excerpts inspected with metadata limits; previous configuredA-19348 remains failed. C1/C2 final evidence pending replacement native campaign and exact-head mode-free run. Prior-head Mac proof not carried across changed shared fake. T-1856 accepted limit retained. No Reviewer execution/delegation.

### rev-36 · 2026-11-14T10:59:27.517Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1855-admission-1
commit: 95360b7ff81c235f9ad3dda4f37acd4782d80bf9
scope: evidence
findings: [{"severity":"medium","text":"T1 opencode-policy import closure includes native fs/default bindings and local verify-tiers refused it before enqueue. Separate pure injected publication algorithm from fake-native binding/temp-name generation; keep tier and behavioral assertions.","file":"hub/test/fakes/opencode/session-record.ts","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Correcting source4's missed static T1 import boundary, A-19354. Targeted injected-I/O and native passes do not establish admission; reported preflight refusal is not a durable failed suite. Native5/pair A-19352 and inventoryA-19353 remain truthful separate proof; A-19348 earlier configured failure remains red. Preserve pure injection/no tier exception, commit and request fresh source review before submission. No Reviewer execution or provenance-only rerun.

Criteria: C2 failed (Local verify-tiers rejected the T1 opencode-policy resource closure before enqueue; no configured run id or pass exists for95360b7.).

### rev-36 · 2026-11-14T11:01:25.466Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1855-source-5
commit: 79d4eb5dd42b4b2bd5277ea570e7f1cbd2bece00
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0 / Spec0, A-19356. Pure required-I/O publisher moved outside native executable subtree, with no native imports/defaults; fake entry binds fs/unique names and T1 Map supplies deterministic temporary path. Exact static classifier inspected: test-lint.ts133 marks native fake-subtree imports T3, now absent from the T1 path. No tier/guard exception or assertion weakening. Original A-19355 pre-enqueue diagnostic read, no run id. Atomic publication/list filter/native assertion/retained-prune behavior unchanged. Prior95360b7 native proof not automatically current-head across binding move; required reviewed-head/authorized-carry native and exact-head mode-free evidence pending. C1/C2 final verification withheld. A-19348 earlier red retained; T-1856 limitation unchanged. No Reviewer execution/delegation.

### impl-1855 · 2026-11-14T11:24:22.874Z

Exact-head configured receipt de718a00 / A-19359 green at79d4eb5dd42b4b2bd5277ea570e7f1cbd2bece00, verification tree6e287f86c1567dda0c89b5071ff28f83bc3966ef; local darwin arm64 Node24.21.0 Neovim0.12.5, one worker, no cache. T0/T1/all fallback T2/changed T3 nine identities/Web290 completed,6270/6270 pass, skips0. Browser chromium_headless_shell-1248 / Google Chrome for Testing156.0.8078.4. Generated atomic-publication and six retained-owner controls passed; OpenCode keep_context=true5122.617667ms. Report-only duration/lint notices remain. Mac5/pair exact-head evidence A-19357, actual inventories delta0 A-19358. Prior A-19348 stays red and95360 submission was not enqueued. Full remaining T3, T4 and Linux not claimed; final same-head reviewer settlement pending. Accepted post-exit orphan/stale-lock/respawn limit remains T-1856.

### rev-36 · 2026-11-14T11:25:16.648Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1855-final-1
commit: 79d4eb5dd42b4b2bd5277ea570e7f1cbd2bece00
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards 0 / Spec 0. A-19360 reconciles exact-head de718a00/A-19359: 6270 base test passes, 692 file passes; 160 load test/file passes separate. T0/T1/all fallback T2/changed T3 9/9/Web 290 all exit 0. Target OpenCode case passes 5.122617667s; all six shutdown controls and atomic-publication control each base + five load passes. Current-head Mac5/pair7/7 A-19357 and actual equal 16185-name inventories A-19358 inspected with native/capture limits. C1 forced delayed-writer red/current joined cleanup and C2 required campaign/configured evidence established. Exact local darwin arm64 Node24.21/Neovim0.12.5/HeadlessShell1248-CfT156 provenance read; report-mode advisories retained. Prior configured red and pre-enqueue refusal preserved. Accepted post-exit orphan/stale-lock/respawn risk remains T-1856. No Linux/full remaining T3/T4/QA pass claimed; QA none. No Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-14T12:22:31.247Z

Merged 46036702459fb751b4a16a83a05e4c13315926fe onto dev.
