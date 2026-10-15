---
id: T-496
kind: task
title: Droplet bundle refuses an integrated dev run when the hub's own tracker writes leave .cland/tasks dirty
state: closed
status: done
size: S
rank: 3100
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-308
branch: t/T-496-droplet-bundle-refuses-an-integrated-dev
created: 2026-10-15T13:23:12.263Z
updated: 2026-10-15T16:59:59.105Z
closed: 2026-10-15T16:59:59.105Z
---

## Problem

An integrated droplet run of `dev` refuses with "dirty or changed worktree cannot be bundled for droplet" whenever `.cland/tasks` has uncommitted changes. The hub writes those files itself on every claim, criterion mark and verdict. On 2026-10-15 at 13:21Z the E-423 stage-1 close cover d967409c failed that way, and the root was dirty again within a minute of the Coordinator's tracker commit. So an integrated droplet run works only by luck of timing.

## Acceptance criteria

- [x] C1. A droplet bundle of the root takes the committed HEAD tree and ignores uncommitted changes under `.cland/tasks`, the same way that run identity treats tracker-only changes. Uncommitted changes anywhere else still refuse, naming the files.
  - done: impl-496 · 2026-10-15T16:31:21.153Z
  - verified: rev-30 [reviewer] · run rev-20261015-496-source · 2026-10-15T16:32:40.060Z · commit ef1a4a0d08920a3483989807ed65a6c8d51c7f91
  - verified: rev-30 [reviewer] · run rev-20261015-496-final · 2026-10-15T16:58:48.093Z · commit ef1a4a0d08920a3483989807ed65a6c8d51c7f91
- [x] C2. A test dirties `.cland/tasks` in a fake root between submit and bundle, and the run still bundles HEAD. A dirty source file still refuses.
  - done: impl-496 · 2026-10-15T16:31:23.270Z
  - verified: rev-30 [reviewer] · run rev-20261015-496-final · 2026-10-15T16:58:48.093Z · commit ef1a4a0d08920a3483989807ed65a6c8d51c7f91
- [x] C3. An integrated occasion run (verify all --occasion stage) from the root bundles committed HEAD for every shard while .cland/tasks is dirty, and a test proves it end to end against the fake droplet executor.
  - done: impl-496 · 2026-10-15T16:31:24.492Z
  - verified: rev-30 [reviewer] · run rev-20261015-496-final · 2026-10-15T16:58:48.093Z · commit ef1a4a0d08920a3483989807ed65a6c8d51c7f91

## Comments

### coord · 2026-10-15T13:27:13.625Z

Workaround until this lands: submit the integrated droplet run from a clean detached worktree at dev, not from the root. Cover ab5bddd4 bundled fine that way on 2026-10-15 at 13:24Z, after two root attempts failed on the dirty .cland/tasks/T-458 file.

### coord · 2026-10-15T16:22:43.116Z

Now blocking: integrated occasion runs (`cland verify all --occasion stage|epic|release`) must run from the root on dev, and a detached worktree is refused ("occasion requires an integrated dev full request ... with fresh origin/dev fetch proof"). Both shards of the E-387 stage-1 close run e08a7659 at 1868193c (A-3152, 2026-10-15 16:21Z) failed with "dirty or changed worktree cannot be bundled for droplet": the hub's own .cland/tasks writes landed during the 88 s typecheck. So until this lands, no stage, epic or release close can shard. Priority: top of E-425. Add a C3: an occasion run bundles committed HEAD while .cland/tasks is dirty, and a test proves it.

### impl-496 · 2026-10-15T16:26:20.081Z

Red reproduction: both new executor-run delivery regressions failed on the previous code (tracker write refused; dirty-source diagnostic lacked its path). Delivery now excludes only .cland/tasks before and after bundle creation, while bundling the submitted committed head and reporting refused dirty paths. Occasion regression checks committed tracker bytes and exact head on both fake droplets. Targeted green runs pending the Mac test window.

### impl-496 · 2026-10-15T16:31:48.540Z

Implementation pushed as ef1a4a0d08920a3483989807ed65a6c8d51c7f91 after fetching/merging origin/dev. C1–C3 done. Mac targeted whole-file runs passed: executor-run 20/20 A-3166 and suite-close 6/6 A-3167, including dirty tracker committed-state evidence for both occasion shards. Typecheck and shard lint passed. Source review requested through reviewer role; same-head verify follows a clear source verdict.

### rev-30 · 2026-10-15T16:32:40.060Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-496-source
commit: ef1a4a0d08920a3483989807ed65a6c8d51c7f91
scope: full

Source review clear at ef1a4a0d08920a3483989807ed65a6c8d51c7f91, fixed point ff06732ffecddebafc08da588c86c90b1fa04672. No high, medium or low findings. Both review axes performed directly under no-delegation role.

Standards: the shared delivery check reuses the exact porcelain/untracked/pathspec exclusion already used by candidateTree, before and after bundling. No new staging operation, working-tree copy, broad ignore or checkout mutation is introduced. Existing same-head ref creation/reuse checks, cleanup in finally, remote detached exact-head checkout and clean-tree checks remain. Changed diagnostics include refused porcelain paths or explicit HEAD change. README documents the narrow exception; new test allowances have measured seconds and lifecycle reasons. Whitespace check passes; requester reports typecheck and shard lint green.

Spec: C1 verified from source. Only .cland/tasks is excluded from host dirty checks. Bundle creation remains rooted at refs/cland/suites/<id> constrained to the submitted run.head, so unstaged/staged tracker bytes never enter it. Other dirty paths and changed HEAD refuse before delivery. The post-bundle check retains the same rule. This matches existing candidate identity's tracker-only exception.

Test review: C2 regression dirties/stages the committed tracker file in provider beforeCreate, after submission/host gate and before bundle; it checks remote exact head, committed tracker bytes, clean remote tree and unchanged dirty host bytes. Separate variant stages a source edit, requires its named refusal, no remote npm test and provider cleanup. C3 expands the actual integrated occasion fake-executor flow, retaining authorization/cap/timing/single-report assertions and checking exact head/committed tracker bytes/clean status on both machine directories while the host tracker remains dirty.

Evidence read: A-3162 reproduces both prior failures on old source. A-3166 whole executor-run file passes 20/20 including nested tests (new cases 8.666/4.713 s); A-3167 whole suite-close file passes 6/6, including two-droplet occasion case 10.343 s. Zero failures/cancellations/skips in both green files, labelled admission loads 10.69/14.34. C2/C3 run-dependent final verification stays pending the same-head post-source gate. No QA criteria.

Proceed with one no-mode cland verify at this exact reviewed head, reporting in topic-308. No Reviewer tests, edits or provider calls.

Criteria: C1 verified.

### impl-496 · 2026-10-15T16:58:26.468Z

Same-head verification 10033869 passed at ef1a4a0d08920a3483989807ed65a6c8d51c7f91: 1798/1798, no failures, including touched executor-run and suite-close regressions. Executor local darwin arm64 after hub remote-capacity fallback; log A-3192. Source unchanged; Reviewer receives this run directly to settle C2/C3 and final verdict.

### rev-30 · 2026-10-15T16:58:48.093Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-496-final
commit: ef1a4a0d08920a3483989807ed65a6c8d51c7f91
scope: evidence

Final evidence review T-496 at unchanged ef1a4a0d08920a3483989807ed65a6c8d51c7f91.
Standards: no new findings; source verdict rev-20261015-496-source remains current.
Spec: no high, medium or low findings. A-3192 / 10033869-7b57-486a-8ed3-93830f6db284 names that exact head and completes with exit 0: typecheck, hub free/machine and Neovim smoke, 1798 passed / 0 failed / 0 cancelled / 0 skipped. Executor is local Darwin after capacity fallback, not a Linux receipt. T-496 has no Linux-only criterion; its remote bundle/occasion behavior is exercised end to end against the fake droplet executor as specified.
C1: source-established committed-head bundle and narrow tracker-only dirty exception remain unchanged; other dirty paths are named and refused.
C2: remote delivery bundles committed tracker state despite later tracker writes passes at A-3192:4429 (7.584s); source-change named refusal passes at :4430 (4.149s). Source review established that the tracker edit is staged between submit and bundle, remote bytes are committed bytes, host dirt remains, and source dirt prevents remote test execution.
C3: integrated Coordinator two-droplet occasion passes at A-3192:5176 (9.817s), retaining both shards' exact-head/committed tracker bytes and clean remote trees while root tracker remains dirty. All six suite-close cases pass; all eleven executor-run top-level cases pass (nested cases included in the suite count).
The source gate plus this exact-head green run establish all three criteria. Duration regression notices are informational; no hard duration budget failure. No Reviewer tests, edits or provider calls.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-15T16:59:59.105Z

Merged 66754eda75efeafb3e96a41a8f64ea254ebf8ad4 onto dev.
