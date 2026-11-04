---
id: T-1674
kind: task
title: claude-code-remote 'adopted Claude settles one descendant born between stop capture and commit' fails intermittently on Linux under load with 'process identity cannot be verified'
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1607
topic: topic-1378
branch: t/T-1674-claude-code-remote-adopted-claude
created: 2026-11-04T11:50:19.383Z
updated: 2026-11-04T13:15:51.941Z
closed: 2026-11-04T13:15:51.941Z
---

## Summary

The E-1532 stage-4 Linux cover 712761f4 at df642451 (log A-16558, shard-2, Linux x64 c-8) failed `hub/test/claude-code-remote.test.ts` "adopted Claude settles one descendant born between stop capture and commit before any signal" in one load-gate repetition: `AssertionError: could not stop "worker": its process identity cannot be verified; it is still watched` after 5.66 s. The base phase passed, and 4 of the 5 load-gate repetitions passed. It is the same symptom as T-1607's earlier positive-churn failures, which T-1607 fixed with the settled-exit rule, the fixture join for turn-end hooks and the shared per-admission recapture budget. Under load a second change is still sometimes seen.

## What to build

Find what the second change is, from the actual extra processes: command line, birth and parent at both captures. Then do one of the following.
- If it is a legitimate process covered by the settled-exit rule (a pinned member that exited) or by the fixture's hook join, fix the gap in the product or the fixture.
- If it is a real new unpinned descendant, the refusal is correct: fix the fixture so the test's precondition (exactly one injected descendant) holds deterministically.

Never loosen the one-recapture bound or the second-churn means incomplete rule without coord's decision.

## Acceptance criteria

- [x] C1. The extra process in the failing repetition is identified from a deterministic reproduction or from captured process records (evidence).
  - done: impl-1674 · 2026-11-04T12:10:33.270Z
  - verified: rev-35 [reviewer] · run rev-35-1674-final-1 · 2026-11-04T12:36:28.902Z · commit cc046fef7e94788eb6b275fa0829e3d69437f824
- [x] C2. The case passes 20/20 under load on an isolated local Linux container (arm64, labelled as such), with its assertions unchanged (evidence).
  - done: impl-1674 · 2026-11-04T12:10:33.518Z
  - verified: rev-35 [reviewer] · run rev-35-1674-final-1 · 2026-11-04T12:36:28.902Z · commit cc046fef7e94788eb6b275fa0829e3d69437f824
- [x] C3. The one-recapture bound and the second-churn rule are unchanged, and the existing claude-stop controls pass unedited (test).
  - done: impl-1674 · 2026-11-04T12:13:45.847Z
  - verified: rev-35 [reviewer] · run rev-35-1674-final-1 · 2026-11-04T12:36:28.902Z · commit cc046fef7e94788eb6b275fa0829e3d69437f824

## Comments

### impl-1674 · 2026-11-04T11:53:54.145Z

Source-only checkpoint: A-16558 exact identity refusal quoted; no process birth/parent/command records in failing log, so C1 remains open. Read T-1607 settled-exit/shared-budget/terminal-settlement decisions and native fixture ordering. Ranked fixture snapshot join vs pinned-exit vs extra native topology hypotheses in topic artifact. No tests/typecheck/probes/containers/verify or source edits during Coordinator quiet. Next step requires release notice, then bounded capture diagnostics in disposable Linux reproduction; no recapture-policy change.

### impl-1674 · 2026-11-04T12:05:02.382Z

Before-edit consumer inventory: searched ProcessHooks/afterCapture/targetVersion/claudePinnedTargets and capture/stop paths across hub/src, hub/test, nvim/test, web/src, qa, skills and docs. Internal ProcessHooks consumers: AgentProcesses constructor, AgentOptions.processHooks in server.ts, host-agent.test.ts faultFixture; new optional afterCapture hook only schedules deterministic reconciliation in new native test. No wire, persisted shape, permission, credential or admission-policy change. Production current/settled identity-set change stays inside AgentProcesses.#capture; approved-set comparison, shared admission budget, Claude helper and existing tests remain untouched. Coordinator decisions 2fe6bc69 + 9d95e51e approve exact current==settled mapping and controls.

### impl-1674 · 2026-11-04T12:10:45.858Z

Pushed5d57fd532, clean/current origin/dev, source review routed to reviewer (resolved rev-35). C1–C3 marked done; evidence A-16563 native identity/capture race and deterministic red→green, A-16564 declared raw Linux arm64 four production load-gate5/5 rounds (20/20) alongside concurrent native targeted phase, six unedited preservation files164 distinct cases +3 deterministic controls, source hashes and explicit invalid-driver exclusions. Final new-case Linux samples0.170/0.281/0.276s; no >=4s new case. Hub typecheck, child-env/tier/closed-wording lint green in sealed macOS copy. Exact-head x64 verification follows clear source verdict; no overall/queued/browser/QA pass claimed.

### rev-35 · 2026-11-04T12:12:49.710Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1674-source-1
commit: 5d57fd5321f58be5a0c373304fe3dbef6e73219d
scope: full
findings: [{"severity":"medium","text":"Regenerate the runtime projection after processes.ts changed: committed SHA2566335c0a8… differs from actual pinned bytes a6ea7ebd…, so agentBundle rejects the capture fix as a stale closure and deployment/T1 closure validation is blocked.","file":"hub/src/host/agent/closure.json","line":69}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear: one medium stale runtime manifest. Independently hashed all projection entries; only processes.ts mismatches. code-delivery.ts20 would throw 'agent closure stale: regenerate host-agent closure'; static source inference, no Reviewer run. Guard correction otherwise matches approved current==settled PID/native-birth mapping, leaving approved-set comparison/one shared recapture budget/final second-churn refusal unchanged. Native three-control source and docs/tier/index reviewed. A-16563 native command/parent/birth race records and old-guard false!==true red/green diagnosis read. A-16564 four production5/5 arm64 LinuxNode24.21 targeted load receipts/164 unedited preservation+3 new controls are qualified supplements; invalid reporter rounds/import failure excluded, not x64/full suite/QA evidence. Detail A-16565 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16565-t-1674-source-review-refresh-runtime-closure-for-capture-fix.md. C3 failed for packaged integration, C1/C2 unverified, not a claim that recapture policy changed. Regenerate committed projection and fresh source review before verify; after-stage QA separate. No Reviewer runtime/probe/browser/edits/Git mutation/delegation.

Criteria: C3 failed (Integration verification blocked: generated agent closure does not match the shipping capture implementation; runtime bundle validation refuses this head.).

### impl-1674 · 2026-11-04T12:13:39.517Z

Addressed A-16565 at cc046fef7e94788eb6b275fa0829e3d69437f824: committed generator refreshes only processes.ts SHA256 in runtime closure.json. Supplemental macOS Node24.21 sealed-copy host-agent-closure4/4 and host-agent-boundary2/2, native exits0, files unedited. Prior A-16564 Linux arm64 targeted20/20/preservation evidence is explicitly previous-head over unchanged runtime/test bytes; manifest itself corrected only now. No dev merge since first review; new head pushed, clean tree; fresh source review requested before verify.

### rev-35 · 2026-11-04T12:14:25.578Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1674-source-2
commit: cc046fef7e94788eb6b275fa0829e3d69437f824
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, sole A-16565 finding resolved. Only correction is generated processes.ts hash; independently verified all27 projection hashes and all eight A-16564 tested-source hashes against this head. Guard current==settled PID/birth comparison, outer approved capture/one recapture/second-churn refusal, internal optional fault hook and native controls/docs/tier/index unchanged and reviewed. No runtime/test/budget/authority edits or dev merge after first review. A-16563 diagnosis and A-16564 isolated Linuxarm64 Node24.21 targeted20/20 production load+164 unchanged preservation+3new controls remain prior-head byte-identical evidence, not current-head queued/x64/full-suite proof; invalid driver/import attempts excluded. Supplemental correction macOS sealed-copy closure4/boundary2 native0 reported. Detail A-16567 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16567-t-1674-source-clear-capture-guard-and-refreshed-runtime-projection.md. C1–C3 unverified pending configured evidence settlement; exact-head x64 mode-free verify may proceed. After-stage QA separate. No Reviewer execution/probes/browser/edits/Git mutations/delegation.

### impl-1674 · 2026-11-04T12:35:46.100Z

Exact reviewed-head verification51c13fc4 passed at cc046fef7; A-16570 read. Linuxx64 c8nyc1 droplet Node24.21.0/Nvim0.12.5; Chrome Headless Shell156.0.8078.4 build1248. T0/T1/fallback allT2/changedT3 duration file/Web exit0; reported5016pass, zero failures/cancellations/skips. Exact generated native cases all pass: same birth0.544473762s, different capture0.833749858s, second descendant0.666663416s, all below4s. File observed2.045s; selected-phase added wall3.174s excludes machine wait, not droplet lifetime1165s/$0.0809. Broader T3/T4 and x64 load repetitions deferred to merge batch; report-only missing baselines/ratchet/owner-unavailable notices are not gates. Reviewer already receives result and owns final settlement. No edits, no head movement, claim retained.

### rev-35 · 2026-11-04T12:36:28.902Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1674-final-1
commit: cc046fef7e94788eb6b275fa0829e3d69437f824
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C3 verified. Exact-head uncached51c13fc4/A-16570 exit0,5016pass/zero fail,cancel,skip,todo; T0/allT1/fallback allT2/changedT3 once/Web complete, remainingT3 batch deferred/T4 unexecuted. Independently streamed same-birth/different-capture/second-descendant3 passes, unchanged claude-stop19/agent-launch13/closure4/boundary2. Linuxx64 6.8.0-142-generic c-8nyc1 Node24.21/Nvim0.12.5, tree97c46de84c16d751f286dfa04df2ad3f07f80730, isolated HeadlessShell1248 ChromeForTesting156.0.8078.4/cache+occasionnull/skips[]/skip-reason report missing0.1165s/$0.0809 billing not suite wall; report-only budgets/lint/ratchet/projections not enforce passes/execution. C1 A-16563 captured native command/parent/birth and exact old-guard red/current green diagnosis, not unavailable original failure records. C2 A-16564 independently parsed20 scope load-gate test finish/pass receipts/four5-of5 rounds phase0 plus native exits on isolated Linuxarm64 Node24.21 targeted parallel load; invalid reporter/import rounds excluded, no x64/full-suite/latency claim. C3 source budget/second-churn logic unchanged; six preservation files independently unchanged, eight evidence source hashes match reviewed head;164 arm64 native preservation+3 controls kept platform-qualified. Detail A-16571 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16571-t-1674-final-evidence-clear-x64-suite-and-arm64-20-repeat-proof.md. Remaining merge-batch coverage/repetitions and affected after-stage QA separate. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-04T13:15:51.941Z

Merged 441b129ce39db3953093bf9d18b35e26387bad7b onto dev.
