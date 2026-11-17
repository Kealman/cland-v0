---
id: T-1688
kind: task
title: Host agent treats /proc ENOENT as exit; a hidepid or foreign-namespace /proc can make a live process read as exited
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1684
topic: topic-1597
branch: t/T-1688-host-agent-treats-proc-enoent-as-exit-a
created: 2026-11-05T11:59:40.426Z
updated: 2026-11-17T09:11:34.526Z
---

## Summary

T-1684 made the host agent's native observation (`hub/src/host/agent/native.ts`) treat ENOENT on `/proc/<pid>/stat` as positive proof that the process exited. On a host whose `/proc` is mounted with `hidepid=1/2`, inside some containers, or across a PID namespace, a live process of another user or namespace can read as ENOENT. The agent could then settle a live process as exited: it would skip a stop, release a generation, or delete its private files. Hub-local identity deliberately keeps ENOENT unknown and falls back to `kill(0)` (coord decision on T-1687, 2026-11-05). Reported by impl-1687.

## What to build

Decide the agent's ENOENT policy for restricted `/proc` mounts. Options:
- detect `hidepid` or a foreign namespace at agent start and refuse positive-ENOENT there, falling back to `kill(0)` with the existing birth check;
- or keep positive-ENOENT only for PIDs the agent itself spawned and still parents.

Never let observation grant signal or deletion authority.

## Acceptance criteria

- [x] C1. With `/proc` behaving as hidepid for a live child, the agent never reports it exited and never deletes its files (test, simulated mount).
  - done: impl-1688 · 2026-11-17T08:20:15.544Z
- [ ] C2. On an ordinary `/proc`, T-1684's exit-race behaviour is unchanged (test).
  - failed: rev-35 [reviewer] · 2026-11-17T09:11:34.526Z · note Exceptional cleanup can release signal/process/filesystem mocks and native guard while original corrected-consumer callbacks are still pending.

## Comments

### impl-1688 · 2026-11-17T07:54:15.012Z

Consumer audit: observeLinuxProcess is used by native.observeProcesses and the T2 host-ref-watch-recovery exit-race regression. observeProcesses consumers include agent/processes, ref-push, supervisor, and tests (host-agent, host-agent-restart); isCapturedOrExited feeds stop capture. Observation wire shape remains unchanged; only unsafe ENOENT->ended classification changes. T1 host-stop-observation expectations remain valid. Will extend the instructed fake /proc seam in the T2 ref-push owner regression to prove unknown preserves private receipts; existing visible exit-race paths remain covered.

### impl-1688 · 2026-11-17T07:55:40.706Z

Red/green receipt (macOS arm64, local Node v24.21.0, working tree): node --test hub/test/host-ref-watch-recovery.test.ts initially 23/27 pass, four hidden-child cases fail with actual {identity:null,ended:true}, expected ended:false; after fix 27/27 pass. Fake /proc and signal-zero probes only, no native launches, network or remount. Exit-race absent/replaced/live/unobservable controls preserved. Full suites not yet run. Complete name search also finds native callers bootstrap/server/processes/ref-push/claude/claude-stop/restart/entry/supervisor.sh and fixtures harness/fake-host; tests host-agent/restart/supervisor/push-on-ref-move/revoke-native/login-disk/session-resume-component/claude-code-remote/stop-observation. All consume unchanged Observation/identity shape; unknown remains existing fence. Only direct scripted ENOENT consumer in ref-watch-recovery migrated to explicit independent ESRCH.

### rev-36 · 2026-11-17T08:07:49.495Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1688-source-1
commit: 2091633a1669ebe3a4d729b802ee3679c2d584c8
scope: full
findings: [{"severity":"medium","text":"Four new hidden-proc callbacks acquire fixture(t) and then await mkdir/write/observe/read as an unowned caller sequence. fixture only registers ownDirectory after acquisition; normal-path awaits do not join/fence continuations before timeout/signal root cleanup. Enroll shared whole-case ownership before acquisition, adopt the root and defer fixture cleanup until the complete callback joins (rule12). Claimant e9d4f3a5 confirms no earlier owner.","file":"hub/test/host-ref-watch-recovery.test.ts","line":193},{"severity":"medium","text":"The committed delivery manifest still records native.ts SHA256388b2802ecdd18204727d9bfe0476081e1111963c3883c23269dccc4556994c2, while this head's source hashes7d2b6b95f16ec760267740c4e6e55c175a033bf78a2c3bcf67fc4e0a05cdba2f. agentBundle at code-delivery.ts:20 rejects the stale closure before delivery; The other 46 entries in the 47-entry manifest match. Regenerate and commit the closure projection for the changed source, retaining the exact guard. Claimant e9d4f3a5 confirms this was missed, with no approved disposition.","file":"hub/src/host/agent/closure.json","line":77}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards1medium/Spec-delivery1medium. A-20764 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20764-t-1688-restricted-proc-source-findings-and-complete-consumer-inventory.md pins 2091633a/tree42045b44 vs e248bca6. Four new callbacks use raw fixture(t)/FS/observe/read continuations; ownDirectory cleanup does not join/fence the caller before normal/signal root removal. Committed closure.json native.ts hash388b2802 differs from actual7d2b6b95; other46/47 entries match, code-delivery.ts:20 rejects stale bytes. Claimant e9d4f3a5 confirms both omissions/no approved disposition. C1failed, C2unverified. Conservative ENOENT+independent signal-zero ESRCH policy, unchanged observation wire shape/three-argument callers, bounded stat-ESRCH retry, birth/replacement/live/unknown and no-signal/no-delete guards inspected. All104 observation/deletion/closure/default/QA paths retained with tiers/dispositions. A-20759 original transcript excerpts preserve dirty-candidate red23/27 then green27/27, lint/typecheck0 and missing raw/native/tree/receipt limits; no exact-head configured/Linux/remount/native/Web/QA proof. Consolidate both fixes and request fresh clean-head source review before Coordinator window; no Reviewer runtime/generator/test/compiler/lint/probe/edit/merge/retry.

Criteria: C1 failed (New hidden-proc tests lack a pre-acquisition whole-case owner, and the stale native.ts hash in the committed agent closure prevents delivery of the fix.).

### rev-36 · 2026-11-17T08:23:27.257Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1688-source-2
commit: 749a5fa4ee5cba7c092b4586c54fd46dce271e81
scope: full
findings: [{"severity":"low","text":"ownedFixtureCase now owns and joins root acquisition, but step(() => fixture(...)) has no separately named setup deadline. The initial mkdtemp/mkdir/watch-start work is not bounded by owner.wait; step/run enforce lifetime ownership only. Add a named fixture setup wait while keeping the root guard and whole-case join. Claimant d36b96de confirms; both prior medium findings are resolved.","file":"hub/test/host-ref-watch-recovery.test.ts","line":197}]
finding_counts: {"high":0,"medium":0,"low":1}

Standards1low/Spec0. A-20781 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20781-t-1688-corrected-closure-and-fixture-ownership-source-clearance.md covers clean749a5fa4/treed82d14ad, direct child2091633a/no dev merge. Both mediums resolved: ownedFixtureCase enrolls shared normal/signal owner before acquisition, adopts mkdtemp root immediately and fences/joins full callback before captured directory teardown; all assertions retained. Closure changes only native.ts hash; fresh read-only audit all47entries match exact delivery guard. Original production policy/wire/authority bytes unchanged; full106consumer inventory retained. Remaining low at recovery.test.ts:197 is missing named owner.wait fixture setup bound; lifetime ownership fixed, claimant d36b96de confirms. C1/C2 done marks restored but neither verified: require completed same-head configured recovery/closure and exact8named controls after any further source clearance. A-20765 corrected-candidate precommit T2 27/27 and T1closure5/5 retained with original output/raw/native/tree limits; artifact root checks pending at creation, later request reports lint/typecheck0, no independently captured exact-head completion invented. No configured/nativeLinux/remount/T3/T4/Web/browser/QA proof. Claimant plans low fix: any head change needs fresh source review before Coordinator window. Prior not-clear history retained. No Reviewer runtime/generator/test/compiler/lint/probe/edit/merge/retry.

### rev-35 · 2026-11-17T08:35:40.991Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1688-source-3
commit: 0a450667f23210b08808786af282d92efc75bd2a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, tree58e143657b852b5b9eea7224153c027f8ebe398e; A-20786. Hub-assigned delta uses rev-36 A-20781/source2 full basis; peer confirms no duplicate review. Sole code line wraps fixture acquisition in named owner.wait('fixture setup') within existing step/sequence. Complete Clock/default30s bound retains original pending work for join; root adoption/guards/callback assertions unchanged. Guide updated. Runtime/closure/tiers/shared helpers unchanged by byte comparison; prior47-entry closure and106consumer source dispositions retained, not rerun. New rules38-43 assessed only against pending delta, cleared predecessor basis preserved. A-20782 candidate T2 27/27, lint/typecheck0/refusals0/122report findings59files remain copied-output/pre-run-pin/raw/signal qualified; old5/5closure not new-head execution. No findings; C1/C2 unverified pending same-head configured recovery/closure and exact8hidden/ordinary control receipts. No nativeLinux/remount/T3/T4/Web/QA claim. No Reviewer runtime/probe/edit/submission. Follow Coordinator window.

### impl-1688 · 2026-11-17T09:01:08.220Z

Coordinator attributed run584204c0 Linux replacement failure to missed native-probe fake consumer. A-20795 supplements complete reader census with every production observeProcesses/observeClaudeProcesses/claudePinnedTargets call path, raw process.kill mock consumers and dispositions; retains original run failure, local fake-proc replacement red, failed guard attempt and green5/5. Root cause: component process.kill fake ignored signal0 and returned success for absent synthetic pid; corrected fake emits ESRCH on absent pid without weakening production unknown fences. New explicit Linux observer controls run on macOS for hidden-live and exited-captured child. No retry of failed configured run; fresh source review/window required.

### rev-35 · 2026-11-17T09:03:09.439Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1688-final-1
commit: 0a450667f23210b08808786af282d92efc75bd2a
scope: evidence
findings: [{"severity":"medium","text":"Failed Linux run exposes a missed observation consumer: process.kill fake ignores signal0, destructively removes present rows and reports success for absent synthetic PIDs. New ENOENT policy therefore cannot obtain ESRCH and stop remains authority-unknown. Coordinator95866fbc attributes to this item; fix fake semantics/add fake-proc replacement regression and complete reader census, without weakening production visibility policy.","file":"hub/test/claude-stop-owner-component.test.ts","line":43}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20797: same-head A-20794 run584204c0 FAILED at0a450667, normalizedtree6c3ba53ba5bda59a6db278a98af6f5cbb5713432. Structured ordinary5873pass/2fail (nested replacement+parent),608pass/1fail files;230 load passes separate. T0/T1exit0,T2exit1,actual Finishedexit1. All224T1 pass; T2 completed384pass+1fail/429selected,44no completed envelope. Web/T3/T4 unexecuted,browsernull. Eight task controls ordinary pass; four hidden identities each5load passes+proofs, component-only. These positives do not clear the full failed run. T1935pair28550–51 is known fixture text; verdict rests on structured failures/hub result/terminal1. C1 not newly verified,C2failed. No retry of this round; Coordinator-authorized661b3b83 fresh source review is separate. No Reviewer runtime/probe/edit.

Criteria: C2 failed (Same-head configured run584204c0 failed in the missed Linux signal-zero fake consumer; ordinary-exit integration is not preserved by this fixture.).

### rev-35 · 2026-11-17T09:05:14.809Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1688-source-4
commit: 661b3b83d468857009967dfdb1cacb3d72ccb5b9
scope: full
findings: [{"severity":"medium","text":"Only parent scope.run is owned; t.test can settle on cancellation before its original nested async callback finishes. scope.wait owns root acquisition only, not late write/load/stop/drain. Admit/join each entire nested callback before global restoration/root removal and fence subsequent steps. Lead89177d60 confirms no other join (rule12).","file":"hub/test/claude-stop-owner-component.test.ts","line":74},{"severity":"medium","text":"Throwing spawn/exec guard lacks attempt counter/final zero assertion and low-level ChildProcess.prototype.spawn trap. Swallowed attempts or captured/custom launchers are not made test failures. Keep positive callback/custom controls and assert zero non-control delegation after full cleanup; lead confirms gap (rule38). No final-candidate native escape is claimed.","file":"hub/test/claude-stop-owner-component.test.ts","line":47}]
finding_counts: {"high":0,"medium":2,"low":0}

A-20799: full reworked-test source pass, treec4fc82694e1e270a851433dad68e120786219611. Standards2M/Spec0new algorithm findings. Signal-zero fake semantic fix is correct and original replacement/unowned/unknown/deadline assertions remain; new direct Linux observer controls prove hidden-live versus absent on every platform. Production/closure/tier unchanged. A-20795 preserves regression red5/3/2, failed guard shell round, corrected5/5, lint failures; final request reports lint0/refusals0/126report60files and typecheck0. Candidate/local only, provenance limits retained; failed584204c0 remains failed perA-20797. C1 unverified,C2failed. Consolidate both findings then fresh pushed-head source review/new Coordinator window; no retry of old round. No Reviewer runtime/probe/edit.

Criteria: C2 failed (Corrected Linux consumer regression still lacks complete nested-callback ownership and a guard that detects all native delegation attempts.).

### rev-35 · 2026-11-17T09:11:34.526Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1688-source-5
commit: 6183e1a909862b403337075d14c99f7c579df681
scope: full
findings: [{"severity":"medium","text":"afterCleanup unconditionally restores globals/guard even when caseDeadlines.close rejected its30s bound with original callbacks pending. cleanupSteps catches join errors and still runs checks; root guards retain directories but not these mocks. Require positive original setup/body/drain join before restoration, including automatic context mock restoration. Lead d750ba2f confirms gap (rules12/38); no observed final-candidate escape claimed.","file":"hub/test/claude-stop-owner-component.test.ts","line":47}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20803 full reworked-test pass, treebc5a30529c6087e98ff3276ae0019be74a83a0a3. Standards1M/Spec0 new findings. Original nested callback ownership and counted/prototype guard corrections check out for normal completion; exceptional release remains. Signal-zero semantics/product assertions/production/closure/tiers unchanged. A-20801 retains candidate5/5, initial typecheck failures then final0; request final lint0/refusals0/126report60files. Raw/immutable invocation pins/native signals absent; no cancellation experiment/configured/Linux/browser claim. Earlier failed584204c0 remains failed. C1 unverified,C2failed. Consolidate lifetime correction and request fresh pushed-head review before new Coordinator window. No Reviewer runtime/probe/edit.

Criteria: C2 failed (Exceptional cleanup can release signal/process/filesystem mocks and native guard while original corrected-consumer callbacks are still pending.).
