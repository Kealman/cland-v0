---
id: T-1869
kind: task
title: Host destroy returns before its watchdog's exit is joined (watchdog alive ~10 s after destroyed)
state: open
status: review
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: topic-1591
branch: t/T-1869-host-destroy-returns-before-its-watchdog
created: 2026-11-15T11:15:22.624Z
updated: 2026-11-17T06:23:27.060Z
---

## Summary

In E-1537's epic demo (2026-11-15), both scratch hosts reached `destroyed` with their absence receipts confirmed at 11:13:12Z, and `cland host stop <id>` with the hub up returned exit 0. About 9 s later, at 11:13:23.6Z, a host watchdog process (PID 55011) was still alive. By the next read, about a minute later, it had exited on its own. The destroy path calls `retireHostWatchdog`, which stops the recorded watchdog (`hub/src/host/provision-host.ts` around lines 172 and 251), so the CLI appears to return before the watchdog's exit is joined. The surviving PID's argv and birth weren't captured, so which host it belonged to is unknown. The impact is small: no spend and no leak, since the process exited by itself. But a caller that checks for survivors right after destroy sees a live watchdog.

## What to build

Confirm whether `retireHostWatchdog` and `stopHostWatchdog` join the watchdog's actual exit before destroy returns. If they don't, join it within a bounded wait with a typed incomplete outcome, as T-1855 did for prune.

## Acceptance criteria

- [x] C1. After `host stop`/`destroy` returns `destroyed`, no watchdog for that host is alive, or the command reports a typed "watchdog stop incomplete" outcome (test with a native watchdog).
  - done: impl-1869 · 2026-11-17T06:21:24.823Z

## Comments

### impl-1869 · 2026-11-17T05:54:29.631Z

Consumer audit before additive failure code: searched ProvisionRecord/publicProvision, host.destroy/host.stop, stopHostWatchdog/retireHostWatchdog, watchdog stop unconfirmed and cleanup-unavailable across hub/src, web/src, nvim, shared, all hub/test tiers, docs and shipped skills. ProvisionRecord persisted JSON/public provision/list rows carry optional failure unchanged; existing cleanup-unavailable pool-runtime comparison is code-specific and unaffected. CLI host destroy/stop uses state/reason, web host cards and Neovim clients use existing state/reason; no reply fields removed. Existing old-shaped rows remain accepted. Native destroy fixtures and watchdog identity/loop tests retain their existing absence and birth assertions. New case proves positive non-acquisition path skipped retirement; existing acquired-machine path already joins. New optional failure code watchdog-stop-incomplete preserves unknown stop instead of catch erasure.

### impl-1869 · 2026-11-17T05:58:03.267Z

Implementation pushed for source review at 28481c7da2ba72c54ed3203dd6cbb5e3046b611d. A-20672 contains selected native red/green evidence. Final local macOS arm64 Node 24.21.0: T2 host-destroy 12/12 passed including unknown-stop retry clearing; T1 watchdog identity 16/16 passed; hub typecheck exit 0; test lint 0 refusals (report-only census); closed-item wording 808 documents/1932 tracker items, 0 findings. Full task verification and full changed T3 file pending source clear and granted verify window. QA policy none; no QA brief or QA request.

### rev-35 · 2026-11-17T06:05:31.391Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1869-source-1
commit: 28481c7da2ba72c54ed3203dd6cbb5e3046b611d
scope: full
findings: [{"severity":"medium","text":"The new native callback and T2 case at host-destroy.test.ts:37 lack a whole-body owner before setup. Later child/destroy/store cleanup hooks do not fence or join setup/body continuations or adopt late acquisitions before storage/root removal (rule 12).","file":"hub/test/host-destroy-native.test.ts","line":27},{"severity":"medium","text":"HOST_USAGE changes at lines 50/54 leave commands.json:2 at the old bytes, contradicting frozenUsage exact equality in cli-usage-compatibility and cli-help. Migrate the intended bytes and retain/run the existing assertions (rules 16/20).","file":"hub/src/cli/usage.ts","line":50}]
finding_counts: {"high":0,"medium":2,"low":0}

Full exact-head source pass, tree e9be8c5d39a028a79736c4fe47df5170766b382d; A-20682 records Standards/Spec and evidence limits. Two medium Standards findings; no separate nominal production algorithm defect identified. Lead confirms both, Coordinator confirms help migration requirement. C1 failed; no criteria verified. A-20672/A-20680 selected working-source native 1/1 plus T2 12/12/T1 16/16 are qualified local macOS evidence, not full changed native file or configured verification. No Reviewer run/probe/edit. Fresh source review after consolidated correction before configured verification.

Criteria: C1 failed (Required new watchdog/typed-incomplete regressions lack callback-lifetime ownership before acquisition and cannot safely establish the criterion under cancellation.).

### impl-1869 · 2026-11-17T06:10:44.199Z

Consolidated A-20682 corrections pushed at 14c83b355eb3fb7d6774772d67651f75d4069299 (tree 45635008053c65d79dde47c9d7048450a9bc447c), fresh review requested. Both new callbacks use shared caseDeadlines ownership before acquisition; frozen HOST_USAGE consumers migrated exactly two lines, equality assertions retained. A-20687 holds selected local receipts: native T3 1/1, T2 destroy 12/12, CLI compatibility T1 1/1, CLI help T2 9/9, hub typecheck exit 0, lint 0 refusals (report census), wording 0 findings. Full verify/changed T3 file remain deferred until source clear and granted window. No slots held.

### rev-35 · 2026-11-17T06:15:01.796Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1869-source-2
commit: 14c83b355eb3fb7d6774772d67651f75d4069299
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source pass after A-20682, source tree 45635008053c65d79dde47c9d7048450a9bc447c; A-20693. Both findings corrected: shared caseDeadlines enrolls before acquisition and joins/fences the complete native/T2 callbacks, captures roots/resources, releases held child and drains work before storage/root teardown; frozen HOST_USAGE matches exactly the two intended source changes with equality assertions unchanged. Production algorithm unchanged from prior pass; no new findings. C1 source-correct but unverified pending same-head configured native evidence; no verified marks in this pass. A-20687 selected local working-source T3 1/1, T2 12/12 and compatibility/help/static checks are qualified, not full changed T3 file or configured proof. No Reviewer run/probe/edit. Follow Coordinator verify-window policy.

### rev-35 · 2026-11-17T06:20:55.527Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1869-final-1
commit: 14c83b355eb3fb7d6774772d67651f75d4069299
scope: evidence
findings: [{"severity":"medium","text":"Configured T0 rejects the new spawn environment expression: 'spawn requires a sealed fixture builder with explicit extras; intentional seams need // cland-allow-child-env: reason'. Satisfy the shared environment guard and obtain fresh source review before another configured run; no credential exposure is inferred.","file":"hub/test/host-destroy-native.test.ts","line":40}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20698 reconciles failed A-20695 at exact submitted 14c83b355. T0 npm run check: typecheck/build completed, test:static failed child-environment guard, later check stages unexecuted. T0 exit1; no droplet or runtime tiers. Counts unavailable, planned rows/projections are not coverage; platform/browser null. Normalized verification tree c426cb49f34457c3d3fa803cf4e2a62303a08dc6, uncached. Prior selected local checks/source clearance remain qualified, not configured proof. C1 failed/incomplete, no verified marks. Lead's existing dirty correction is outside this evidence pass; continue that authorized fix and request fresh exact-head source review before another submission. No Reviewer run/probe/edit.

Criteria: C1 failed (Configured run 49b649b0 failed T0; no native runtime case or remote tier executed, so required watchdog evidence is incomplete.).

### impl-1869 · 2026-11-17T06:22:01.856Z

Corrective head 2f72ea2643d978d583b00ae90e71d95c05348297 pushed for fresh source review. One-line final native spawn env uses fixtureEnvironment(f.root,env,{}) with explicit extras. A-20700 records direct child-environment lint red at old expression, green at fix, then full npm run test:lint exit 0/zero refusals. Earlier lint-tests.ts direct run was a subset and omitted test:static. Old configured run 49b649b0 remains T0 failed/no droplet/runtime; no configured resubmission. Waiting clear source then new Coordinator window; C1 done, verification incomplete.

### rev-35 · 2026-11-17T06:23:27.060Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1869-source-3
commit: 2f72ea2643d978d583b00ae90e71d95c05348297
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear at tree70e41d03d8158b70ca6407306039fb7dd6ec97c2; A-20702. Single-line correction since prior full source: native spawn now seals its final environment with shared fixtureEnvironment(f.root,env,{}) and no post-overlay/exemption. IPC child needs no removed fixture metadata; production/ownership/native assertions/help equality unchanged. No findings. A-20700 retains direct child-env lint red/green plus full npm run test:lint exit0/zero refusals, with report-only advisories qualified. Earlier direct lint-tests was a subset, not full script. C1 remains unverified until new unchanged-head configured native evidence. Old run49b649b0 stays failed/no runtime; earlier selected runtime evidence not promoted to this head. No Reviewer test/probe/edit. Follow Coordinator's new verify-window policy.
