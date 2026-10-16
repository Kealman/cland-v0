---
id: T-527
kind: task
title: "territory-lock test: a fixed 100 ms sleep races the first lock holder (Linux)"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-334
branch: t/T-527-territory-lock-test-a-fixed-100-ms-sleep
created: 2026-10-15T19:50:59.979Z
updated: 2026-10-16T03:44:56.456Z
closed: 2026-10-16T03:44:56.456Z
---

## Problem

`hub/test/territory-lock.test.ts:41–42` sleeps a fixed 100 ms before its lock assertions. On Linux under load it saw 'could not take guard' where 'another territory operation holds the lock' was expected, in T-502's droplet verify f23a4f38 (A-3310:4128–4151). The fixed sleep races the first holder taking the lock.

## Acceptance criteria

- [x] C1. The case observes the first holder actually holding the lock (a file or receipt signal) instead of sleeping 100 ms, then asserts the second operation's refusal message. Every assertion stays.
  - done: impl-527 · 2026-10-15T23:31:58.794Z
  - verified: rev-30 [reviewer] · run rev-20261015-527-source · 2026-10-15T23:32:46.061Z · commit d2d184f52a1f94eb5ac83bd68174f5194f9af6d8
  - verified: rev-30 [reviewer] · run rev-20261015-527-shared-544-delta · 2026-10-15T23:57:41.452Z · commit 5b89aa37ca4b8c58cd928bc248b6535a43663b31
  - verified: rev-30 [reviewer] · run rev-20261016-527-manifest-delta · 2026-10-16T01:21:48.097Z · commit b6a657563d23f92ff58daa211458f1aae773e0e1
  - verified: rev-30 [reviewer] · run rev-20261016-527-final · 2026-10-16T03:44:34.542Z · commit b6a657563d23f92ff58daa211458f1aae773e0e1
- [x] C2. territory-lock.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-527 · 2026-10-15T23:55:36.435Z
  - verified: rev-30 [reviewer] · run rev-20261016-527-final · 2026-10-16T03:44:34.542Z · commit b6a657563d23f92ff58daa211458f1aae773e0e1

## Comments

### impl-527 · 2026-10-15T22:29:13.087Z

Read T-527, E-482 decisions and R-294/spec. Implementing a first-holder acquisition receipt in the existing territory-lock test; all refusal, completion, stale-recovery and rejection assertions stay. Mac baseline is waiting for the single-file test window (load 3.74; another test was detected).

### impl-527 · 2026-10-15T23:31:53.698Z

Implementation cc400e87 replaces the fixed sleep with a bounded callback-entry receipt and preserves all assertions; finally releases/awaits the holder on failures. Five serial quiet Mac whole-file passes: 85/85, 0 failures/skips, all exit 0; A-3459 contains all five logs and per-pass admission loads (3.04–3.92, local none/pgrep free). Before first review merged origin/dev without conflicts and pushed d2d184f52a1f94eb5ac83bd68174f5194f9af6d8; task diff remains only territory-lock.test.ts. Typecheck green on that merged head. No QA required by policy. Linux evidence awaits source review.

### rev-30 · 2026-10-15T23:32:46.062Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-527-source
commit: d2d184f52a1f94eb5ac83bd68174f5194f9af6d8
scope: full

Source review T-527 clear at d2d184f52a1f94eb5ac83bd68174f5194f9af6d8, merged pre-review dev c015fbe3302a6e393905c5ca3cab845f771043ee. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

C1 verified: the fixed 100ms acquisition sleep is replaced by a bounded eventually observation of callback entry. Immutable withTerritoryLockAsync (territory.ts:73–88) awaits acquireLockAsync before invoking its operation through withCleanupAsync. Thus entered=true proves first acquisition completed; the callback then awaits the unresolved pending promise, keeping the lock held while BOTH synchronous and async second-operation refusal assertions run. Finally resolves the holder and awaits first before subsequent completion/stale/rejection checks and fixture teardown. Every one of the file's57 assertion lines is preserved (indentation normalized), including exact refusal message, completion value, reverse exclusion, stale recovery and primary rejection identity. No production implementation or deadline change.

Standards: first-holder state comes from the public operation callback, not internal lock mutation or elapsed time. Cleanup follows release→join with concurrency assertions before release. No new test identity, environment mutation, shared fixture or manifest change. Own diff against the merged dev parent is one test file,12 additions/7 deletions. Whitespace check clear; merged-head typecheck reported green.

C2 remains UNVERIFIED pending the actual droplet file pass and acceptable overall task gate. Mac portion is established by A-3459's five full serial quiet file passes at cc400e875b9a0d3f66f123fcc673128b081f7d86:17/17 each,85 total, zero failures/cancellations/skips, full durations3.563/2.673/2.014/2.097/1.671s. Admission local:none/free and load3.92/3.35/3.24/3.05/3.04 are disclosed. The territory-lock.test.ts Git blob is byte-identical at that evidence head and the requested merged head (da03d09a55854b36faf0a7ac818d195b038b7bcd); no intervening territory.ts, lock.ts or harness.ts commit is present. These are valid unchanged-source file repetitions, not exact merged-head suite evidence.

One exact-head no-mode/no-executor cland verify may follow source clearance under current Coordinator admission rules. Preserve actual executor/platform; a local fallback does not fulfill C2's explicit droplet requirement. No per-item QA criteria. No Reviewer tests, compiler/binary execution, edits, signals, merges or provider actions.

Evidence A-3459 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3459-t-527-five-serial-quiet-mac-whole-file-passes/README.md and adjacent mac-pass-1..5 logs. Standards:0 findings; Spec:0 findings, Linux runtime evidence pending.

Review artifact A-3460 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3460-t-527-source-clear-at-d2d184f5-observed-acquisition-with-failure-safe-release-an.md.

Criteria: C1 verified.

### rev-30 · 2026-10-15T23:57:41.452Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-527-shared-544-delta
commit: 5b89aa37ca4b8c58cd928bc248b6535a43663b31
scope: delta

Delta source review T-527 clear at 5b89aa37ca4b8c58cd928bc248b6535a43663b31, direct parent d2d184f52a1f94eb5ac83bd68174f5194f9af6d8.

Standards: no high, medium or low findings. Spec: no findings in this source delta. Read immutable parent-to-head diff and commit parent. The entire delta is one assertion line in hub/test/session-model.test.ts:108, sorting usage.subagents by agentId before the existing five-field mapping and deep equality. This preserves row count, duplicates, identities and all compared fields; it only removes nondeterministic row arrival order. No production code, task fixture, bounds, manifest or dependency changes. All three independently requested shared picks have exactly the same raw diff SHA-256 as posted 08f09c7c49f9dcaf5912d1701af5a99c9492b405: 9759e96446c9eb311eb6ae3bc06d5437e48b75480273609c6eadf13981f26e6f.

Accepted upstream evidence: T-544 A-3420 five Mac whole files and A-3441 actual green Linux receipt, final review A-3442 / rev-20261015-544-final. Shared test-only pick needs no additional local run under Coordinator rule 11.

A-3476 / f524f59b is the first actual Linux receipt: 1847 pass, 2 fail, 3 platform skips; all territory-lock cases pass, changed case 0.1345s. Outside failures are T-493 recent-poll count and T-544 reversed usage rows. Neovim smoke not reached. A-3459 five Mac files and A-3460 source review remain applicable. C2 final settlement awaits the second qualifying receipt. Coordinator 6d227ab4 specifically authorizes only this shared pick; it also explicitly allows a second known-only T-493 red to qualify the pair.

Only C1 is reverified by this source delta. This is not the final task evidence verdict and does not assert the earlier red receipt is green. Verification submission waits for explicit Coordinator 'hold lifted'; no local tests during hold. No Reviewer tests, compiler/binary execution, edits, installs, merges or provider actions. One verdict post, no item read-back, under overload guidance.

Review artifact A-3479 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3479-t-527-shared-t-544-delta-source-clear-at-5b89aa37.md.

Criteria: C1 verified.

### rev-30 · 2026-10-16T01:21:48.097Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-527-manifest-delta
commit: b6a657563d23f92ff58daa211458f1aae773e0e1
scope: delta

Delta source review T-527 clear at b6a657563d23f92ff58daa211458f1aae773e0e1, direct parent/source-reviewed 5b89aa37ca4b8c58cd928bc248b6535a43663b31. Standards: no findings. Spec: no findings in this data-only delta.

Independent immutable audit: only hub/test/durations.json changes. Conflict resolution matches Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e byte for byte. Strict JSON parsing rejects duplicate keys; root keys remain version/source/budget/files/tests/allow. All non-allow fields equal the posted payload, including2177 baseline test identities; all229 shared allowance keys and values/reasons remain, with zero drops or changed common values. No extra task allowances. No production code, test cases, bounds or dependencies changed; no dev merge. Immutable diff whitespace checks clear.

Shared evidence A-3493/c0c04df1 is the full integrated cover at a06020a3478184c604165d70d0d0e81b30a956a7, exit0, hub and Neovim completed. It supports this Coordinator-directed baseline refresh; it is not a task-head verification. No additional local rerun requested for this shared data-only pick under launch rules.

A-3540 remains a 50-minute timeout, not a qualifying second receipt. Coordinator9cf06209 classifies its unrelated load-gate failures as stale-manifest artifacts and directs this pick/delta/one droplet sequence; ordinary default-subscriptions:266 session.launch timeout still needs its new-ticket classification. Own territory-lock ordinary17/17 changed0.188s plus A-3459 Mac5/5 remain supporting evidence. C2 final gate pending.

Only source-established criteria C1 reverified here. No final evidence/merge readiness claimed. Any subsequent source/head change needs delta review; verification follows the lead's stated prerequisites/admission sequence. No per-item QA change. Read task files/earlier review chain; no task.view full-journal scan. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Review artifact A-3553 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3553-t-527-shared-manifest-delta-clear-at-b6a65756.md.

Criteria: C1 verified.

### rev-30 · 2026-10-16T03:44:34.542Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-527-final
commit: b6a657563d23f92ff58daa211458f1aae773e0e1
scope: evidence

Final evidence review T-527 clear at unchanged source-clearedb6a657563d23f92ff58daa211458f1aae773e0e1. Standards/Spec: no new findings. C1 source chain A-3460, sharedT-544 delta and A-3553 baseline delta remain applicable; current origin task ref independently matches this SHA.

Primary Coordinator e3b2c101-8dc4-402f-899a-2c9d26654f43 read in topic-334 expressly accepts the named pair when own cases are green and second reds are only T-556/T-566/T-555/T-565; typo-correction1bde3a93 confirms first receipt a679d54c/A-3633. Coordinator51769c1f separately confirms T-566 is the load-dependent gate, with T-538/T-539 query-cost work separate. This is an explicit pair disposition even though the two sets share T-556; not an invented general rule.

A-3633/a679d54c at current head: actual Linux c-8 workers4,1848pass/1fail/3skip, exit1. All17 territory-lock cases completed green; changed callback-entry observation case.136s. Outside ordinary planned-stage:249 failure was landing10334queries against retained<10000, with64 unrelated items/8plans, now classifiedT-566. Other red is suite-runner dynamic timestamp identity0/5, knownT-556. No hard duration-budget failure.

A-3653/bad39df8-80eb-4c88-92d6-ecbd5858f251 at same head: actual Linux c-8 lon1 6.8.0-142-generic, Node24.21.0/Neovim0.12.5, workers4, lifetime1276s/$0.0886. Raw completed free38/38 and machine1814tests/1811pass/0fail/3skip; total1849pass/0fail/3skip, no cancellation. All17 territory-lock identities again have positive completion/timing records; changed case.157575941s. Sole red line is knownT-556 current-timestamp identity0/5. Suite1203.89s, peak14.69, exit1. Duration regression notices are diagnostics on known entries, with no hard budget error. Neovim smoke did not execute after hub red; task has no nvim diff, and this pair disposition establishes the requested own-file/Linux gate rather than a full green Neovim claim.

Mac A-3459 raw five whole-file logs inspected:17/17 each,85/85, zero fail/skip/cancel, exit0, serial quiet/alone admission recorded. Their buildcc400e87 territory-lock source is byte-identical to current head by immutable comparison; later reviewed changes only concern shared test fixes/baseline. C1's original replacement of100ms sleep with bounded callback-entry observation and retained exclusion/cleanup assertions is unchanged.

C2 verified from five complete Mac files and actual same-head Linux file completions under the explicit accepted pair; C1 reverified/current across unchanged source. All criteria checked. Earlier cancelled/zero-lifetime/timeout admission attempts supply no extra green evidence and are not needed for this pair. No additional verify/pick/edit or per-item QA required. No Reviewer tests/compiler/binary execution, edits, installs, signals, commits, merges, provider actions, task.view journal scan or subagents.

Review artifact A-3656 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3656-t-527-final-evidence-clear-under-exact-accepted-linux-pair.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T03:44:56.456Z

Merged b214d3d3e05b83dd9aff5cdc1984169867835adc onto dev.
