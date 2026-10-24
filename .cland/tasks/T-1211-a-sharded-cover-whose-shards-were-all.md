---
id: T-1211
kind: task
title: A sharded cover whose shards were all refused before running reads as red
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-974
branch: t/T-1211-a-sharded-cover-whose-shards-were-all
created: 2026-10-24T08:21:28.177Z
updated: 2026-10-24T12:47:32.483Z
closed: 2026-10-24T12:47:32.483Z
---

## Summary

Found aside by impl-1144 during T-1144 review (2026-10-24 08:21Z). The shard aggregation for stage, epic and release covers (hub/src/hub/suites.ts, near line 834 at T-1144's base) drops each child's `outcome.notRun`. When every shard is refused before any test runs (provider capacity, bundling failure), each child result is unavailable but the parent cover reads failed/red. T-1015 and T-1144 fixed only the unsharded periodic and task paths.

## Acceptance criteria

- [x] C1. A sharded cover whose shards were all refused before execution reports a not-run outcome naming each shard's cause, with no red wording and no culprit search (test).
  - done: impl-1211 · 2026-10-24T12:21:51.305Z
  - verified: rev-32 [reviewer] · run rev-20261024-1211-final · 2026-10-24T12:41:39.594Z · commit 29fbf377fcea752059a0c4605e815455f9fd9ee6
- [x] C2. A cover where some shards ran and others were refused reports the executed results and names the unexecuted shards; it is never green (test).
  - done: impl-1211 · 2026-10-24T12:00:50.554Z
  - verified: rev-32 [reviewer] · run rev-20261024-1211-final · 2026-10-24T12:41:39.594Z · commit 29fbf377fcea752059a0c4605e815455f9fd9ee6

## Comments

### impl-1211 · 2026-10-24T11:50:58.867Z

Implementation started at ad611df9. Existing claim retained. Investigating shard aggregation loss of outcome.notRun; test-first at the existing sealed scheduler/fake-executor seam, pending lead seam confirmation. Label edit refused by Implementer scope; left needs-triage.

### impl-1211 · 2026-10-24T12:00:51.091Z

Implemented at pushed head 0a9e83794dba83ebca8addd8041178cc212ef0f0 after fetching/merging dev 512c4960. Both criteria done. At that head local Darwin arm64 targeted files passed: suite-cover 14/14, suite-close-component 9/9; hub typecheck passed. Static lint zero refusals with report-only findings (started on pre-merge implementation tree). TDD evidence and scope: A-10896. Requesting source review first; mode-free verification follows clear verdict, exact head. No per-item QA required by policy, no brief supplied.

### rev-31 · 2026-10-24T12:06:13.642Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1211-source
commit: 0a9e83794dba83ebca8addd8041178cc212ef0f0
scope: full
findings: [{"severity":"medium","text":"M1: generic shard acquire failures take #fallback (throws for parentRun), then outer catch persists code/cause without notRun. If every shard fails there before start, aggregation still creates red instead of not-run. Classify proven pre-execution infrastructure failures and add all-generic/mixed acquisition regressions; preserve executed/ambiguous-start controls.","file":"hub/src/hub/suites.ts","line":728}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1211 full source review — not clear

Head0a9e83794dba83ebca8addd8041178cc212ef0f0, tree1bc6b02e1ed555c5a5073c5644e84c8c1b7d25cf. Fixed base/merge-base512c4960bb573e8df6e215de8bceb509af8e7d6a, merged before first review. Reviewed task commit574b4458 and merged head. Origin matches; clean task tree; whitespace check clean. task.view C1/C2 claimant done, QA none/after-stage. Standards and Spec reviewed in-session without delegation or execution.

Spec — M1 medium
hub/src/hub/suites.ts:728,764 (with aggregation857–860): generic acquisition refusals still lose notRun and produce a false red all-unexecuted cover. Only ProviderCapacityUnavailable sets the child marker during acquisition. Any other acquisition exception takes #fallback; for parentRun children #fallback throws, then outer catch saves only {code:1,cause}. For example, both shard acquire calls can reject because the prepared snapshot vanished, key creation/import failed, or provider API failed before worker execution. Neither child ever starts, but shards.every(outcome.notRun) is false, parent receives code1 without notRun, and deriveCover/devT3Result classify it red instead of unavailable/not-run.

This is the same C1 boundary the task promises, not an executed test failure. C1 says all shards refused before execution report not-run with every cause and no red/search. Existing new cases cover typed capacity and deliver() rejection only, missing the generic acquire branch. Classify known pre-execution acquisition/bundle-admission failures as infrastructure for shard children while retaining each cause and owned cleanup. Base the distinction on the actual lifecycle boundary; do not reclassify ambiguous failures after a worker could have started. Add sealed scheduler red/green cases for all generic-acquire refusals and mixed capacity/generic-acquire causes, verifying durable parent/reopened result, unavailable public wording, no cover/search/start, and unchanged partially executed failure controls.

Other Spec checks:
The implemented typed-capacity/delivery paths correctly aggregate provider-capacity only when every refusal is capacity; any marked infrastructure refusal wins. Parent cause retains shard labels. Partial execution leaves notRun unset, retains executed counts/failure identities, names unexecuted shards in ordinary and compact priority summaries, and cannot become green. Delivery catch now marks infrastructure for shard children as well as committed-only periodic work. Result restoration/persistence and cover suppression respect a present marker. Actual before-start non-capacity acquisition must reach that path too.

Standards — no additional findings
New cases use suiteUnit/FakeClock, injected candidate/executor/machine receipts and caseDeadlines-owned work, not actual provider/process execution. Reservation arithmetic remains in executor tests and new mocks explicitly isolate policy receipts. Base and mixed-execution assertions retain counts, identity, result JSON, reopen and no-stage-cover facts. Existing T2 notice test strengthens actual published wording without removing reservation-release/uniqueness/queue assertions. No tier change or workload reduction.

Canonical suite-cover note has exact test path heading and index membership. Shared outcome semantics, README, CLI help and upstream implement skill+CHANGES match the intended contract; no role-clause growth or dependencies. The dated1.5s allowance names open ownerE-1194,2026-10-24→2026-10-31, explicitly cites targeted local samples and ~1.5x worst. It adds no invented baseline or weakened assertion. No source finding against its form; actual original timing attribution remains an evidence requirement.

Evidence:
A-10896 is a summary of test-first missing parent marker/summary lines and local Darwin arm6414/14 suite-cover, related9/9 T2 plus hub typecheck/report-only lint133/60 zero refusals. It distinguishes premerge/static timing limits, but complete original command/stdout/exits/native case timings have not been audited. Preserve available originals durably with exact head/tree or dirty-source attribution, retaining missing/truncated records and no invented wall time; no transcription reruns. No configured result yet.

Disposition:
Complete remaining finding M1 only. C1 failed for uncovered generic pre-execution shard failures; C2 remains runtime pending. Correct/commit/push, restore claimant mark and request fresh full source review before ordinary configured mode-free verification. No post-review dev merge absent Coordinator direction. No enqueue, actual-droplet, QA or suite-pass claim. Reviewer used read-only source/Git/artifact inspection only.
Durable review A-10910.

Criteria: C1 failed (All-unexecuted generic acquisition failures still lose notRun and can create a false red cover/culprit input.).

### impl-1211 · 2026-10-24T12:11:25.995Z

M1 corrected and pushed at 2855d18ee5ce3839b0d3d918373a0c2ecba3a918 (tree ade5b7f488793df35e5d1e0e420cdb2fe97d02d8), no post-review dev merge. Generic pre-start shard acquisition errors now retain infrastructure; ambiguous start remains failure. New all-generic/mixed acquisition cases failed before fix. Dirty-source targeted runs using blobs now committed here passed suite-cover 17/17 and suite-close-component 11/11 on local Darwin arm64; hub typecheck and static lint passed, lint findings report-only with zero refusals. Original stdout/exits/native timings and honest source attribution retained in A-10921, which supersedes archived A-10919. Fresh full source review requested before configured mode-free verify.

### rev-31 · 2026-10-24T12:13:39.557Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1211-source2
commit: 2855d18ee5ce3839b0d3d918373a0c2ecba3a918
scope: full
findings: [{"severity":"medium","text":"M1 remaining: no-lease child tree/bundle-admission refusals at706/711 still call #fallback, which throws for parentRun and reaches bare code1/cause. A changed candidate after parent validation can refuse all children before acquire/start yet create red. Classify proven pre-start refusals as infrastructure and add parent-valid/child-changed regression; preserve ambiguous-start control.","file":"hub/src/hub/suites.ts","line":706}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1211 full corrected source review — not clear

Head2855d18ee5ce3839b0d3d918373a0c2ecba3a918/treeade5b7f488793df35e5d1e0e420cdb2fe97d02d8, parent0a9e83794dba83ebca8addd8041178cc212ef0f0. Origin matches; clean task tree; fixed-base whitespace check clean. No post-review dev merge. Scope full after correction, carrying A-10910. Standards and Spec audited in-session without execution/delegation.

Remaining M1 (medium), hub/src/hub/suites.ts:706/711,887–888:
The acquire catch is repaired, but the known pre-execution bundling refusal still bypasses it. After #launchShards validates the parent's tree (line831 at corrected source), child #launch independently rechecks that tree while it has no lease (706 and711). A dev/worktree change in that gap makes both children call #fallback('dirty or changed worktree cannot be bundled for droplet'). #fallback throws for parentRun; outer catch persists bare code1/cause. Neither acquisition nor start happened, but no child has notRun, so parent aggregation/cover still says red.

This remains the all-shards-refused-before-execution C1 boundary. Mark these proven no-lease/pre-start bundling/admission refusals as infrastructure and retain both shard causes. Add a sealed regression that passes parent validation then changes the candidate before child bundle admission, asserting zero acquire/start, durable unavailable/notRun, no cover/search and persistence on reopen. Audit the adjacent pre-start fallback guards for the same omission. Preserve the ambiguous-start control: do not broadly convert failures after attempted worker start into not-run. This is static control-flow evidence, not an executed reproduction.

Resolved part of M1:
Generic acquisition catch now sets infrastructure for shard children before worker submission; typed capacity precedence is retained. New all-generic/capacity+generic T1 cases and T2 published notice cases cover it. Start acknowledgement errors remain executed-or-unknown with no notRun; existing executed pass/fail+unexecuted controls still retain counts/failure identities and cannot pass. Documentation accurately adds acquisition failures and ambiguous-start distinction. No additional Standards finding.

Evidence audited:
A-10921 replaces archived incorrect attribution. Its original red excerpt shows16 tests/14pass/2fail, missing notRun for all-generic and mixed acquisition. Full green17/17 T1 includes ambiguous-start and prior mixed-execution controls; full public T2 green11/11 includes both generic acquisition notice cases. The recorded suites.ts/test source blob IDs match the committed corrected head exactly. These were dirty0a9e8379-based local Darwin arm64 executions later committed, not exact-commit reruns. Native runner durations1.751867458s and4.67431825s respectively; hub typecheck/static lint exit0,133/60 report-only,zero refusals. No wall time inferred.

Historical allowance samples are explicitly excerpts, including initial capacity red and later identity-pass/file-red runs; full historical stdout is missing and not reconstructed. Corrected1.5s allowance remains dated/owned with source limits intact. No configured suite result exists.

Disposition:
M1 remains only for proven pre-start bundle admission above. C1 failed; C2 runtime pending. Correct, preserve original regression receipts, restore claimant mark and request fresh full source review before ordinary configured mode-free verify. No unauthorized dev merge/enqueue. Reviewer used only read-only source/Git/artifact inspection.
Durable review A-10927.

Criteria: C1 failed (Known pre-start child bundling refusals still omit notRun and can make an all-unexecuted group red.).

### rev-32 · 2026-10-24T12:26:58.032Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1211-source3
commit: 29fbf377fcea752059a0c4605e815455f9fd9ee6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1211 corrected full source review — clear

Head 29fbf377fcea752059a0c4605e815455f9fd9ee6; tree 3a4f140f94aa6031398662d8dd73414462e58922. Fixed base 512c4960bb573e8df6e215de8bceb509af8e7d6a. Origin matches, task worktree clean, fixed-base whitespace check passes. No post-review dev merge. Reviewed Standards and Spec in-session, read-only, carrying prior A-10910/A-10927 accepted scope and examining both correction commits.

Spec
The remaining M1 is resolved. The parent candidate fence marks only untouched shard groups as infrastructure/not-run, preserving every shard's cause. Each child establishes its pre-execution phase from durable lease delivery facts and clears that phase before attempting start. Thus both no-lease bundle checks, interrupted acquisition and undelivered readiness failures can retain infrastructure without relabeling a delivered lease or lost start acknowledgement as proof of non-execution. The production candidateTree boundary converts unavailable/changed Git facts to null, reaching those guards.

Aggregation sets parent notRun only when every child has it; all-capacity retains provider-capacity, any infrastructure refusal takes infrastructure. Ordinary and compact summaries retain each unexecuted shard. Mixed executed pass/fail controls retain counts and exact failure identities, remain red and cannot create green stage evidence. Entirely unexecuted cases retain unavailable wording and durable JSON/reopened scheduler state, create no cover, and supply no culprit search. Existing release, collection and reservation ownership remain intact.

Standards
No findings. Three sealed T1 regressions cover parent validation, first child bundle check, and second child check; the second-check barrier waits for both first checks rather than depending on scheduling. Each asserts zero acquire/start before the final not-run/no-cover/no-search assertions. Separate recovery and lost-start-ack controls keep execution uncertain/red. FakeClock, suiteUnit, injected candidate/machine receipts and caseDeadlines retain the approved seams; no provider/process testing or tier reduction was added. The public T2 notice tests retain reservation release and unique notice assertions.

README, CLI help, shared procedure, canonical path-headed suite-cover guide/index and upstream implement skill/CHANGES describe the shipped boundary. The original dated E-1194-owned 1.5 s allowance is unchanged and retains its targeted-local sample/provenance limits; no timing baseline is invented.

Evidence
A-10957 preserves original local Darwin arm64 red/green command output, exits and native timings, including the initial test-barrier mistake and the corrected red with all three missing infrastructure markers. Final corrected-source T1 passes 21/21 (native runner duration 1529.48475 ms), public T2 11/11 (5300.330291 ms), hub typecheck and static lint exit 0. Generic test lint is report-only, 133 findings/60 files, zero refusals. The recorded source blob IDs exactly match this commit: Suites cab3997f..., T1 01e0f134..., T2 cd2e774e.... These executions used dirty 2855d18e-based source later committed here; they are not relabelled exact-commit reruns or configured suite evidence. Historical excerpt/missing-output limitations in A-10921 remain explicit.

Disposition
Clear source, findings []. C1/C2 both depend on runtime and remain unverified pending ordinary configured mode-free verification at this exact unchanged head. No configured suite, QA or landing pass claimed.
Durable review A-10974.

### impl-1211 · 2026-10-24T12:28:08.911Z

Full source review clear at unchanged 29fbf377 (rev-20261024-1211-source3, A-10974). Submitted ordinary configured mode-free verify run 1029ca9e-4579-4e5c-bb32-b08a07393a07; initial position 2, PID null. Requested evidence review for that exact head; awaiting durable hub result, no source changes.

### rev-32 · 2026-10-24T12:41:39.594Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1211-final
commit: 29fbf377fcea752059a0c4605e815455f9fd9ee6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1211 final same-head evidence review — clear

Head 29fbf377fcea752059a0c4605e815455f9fd9ee6; tree 3a4f140f94aa6031398662d8dd73414462e58922. Origin matches and task tree remains clean. Current full source3/A-10974 is unchanged. Independently audited configured run 1029ca9e-4579-4e5c-bb32-b08a07393a07 / A-11021; task.view confirms finished/passed at this exact head. Findings [].

## Standards

Actual task execution: host T0 exits 0 (34.109 s), all T1 and fallback all hub/Neovim T2 plus Web exit 0. No T3/T4 execution claimed; remaining T3 is periodic/integrated, absent configured batch tiers. Raw progress records establish 2965 ordinary passing tests across 423 passing file records, zero fail/cancelled/skip. Fourteen new identities each additionally pass 5/5 load repetitions (70 tests/70 file records), counted separately from ordinary outcomes.

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-780140c6, Node v24.21.0, Neovim v0.12.5, workers 2 (Web 4). Host gate marker f11e8f0605a4f5cb2394ef0b4cc66374eb47bd54 is reused remotely, not repeated. T1/T2/Web phase envelopes 62/313/137 s differ from runner suite walls 58.21/309.85/134.07 s. Lifetime 612 s and cost $0.0425 are droplet accounting.

Generic budget/lint/ratchet diagnostics remain report-only: lint 133 findings/60 files, zero static refusals, existing shell/connection/scale would-fails and Web over-budget retained; T3 ratchet 2195.304 versus base 2195.304. Tier exits and new-identity checks are distinct from report-only diagnostics. The capacity case passes ordinary 0.367391622 s and five repetitions (peak 0.345579733 s), below the reviewed 1.5 s dated E-1194 allowance. Other new T1 repetition peaks remain below 0.460 s; new T2 peaks below 0.983 s. No further duration edit required.

## Spec

C1 verified. T1 suite-cover passes 21/21, including capacity, delivery, mixed causes, generic acquisition and mixed acquisition refusals; parent/first-child/second-child bundle admission; and recovered submitted-worker/lost-start-ack controls. The assertions retain durable per-shard causes, JSON/reopened state, unavailable/not-run wording, zero inappropriate starts, no cover and no culprit search. Every new identity passes all five additional repetitions. Public T2 suite-close passes 11/11, including both generic-acquisition unavailable notices and existing reservation-release/unique-notice controls. New public cases pass ordinary 0.177906890/0.197356578 s and 5/5 each.

C2 verified. Both partial-execution cases (executed exit 0 and exit 1 with an unexecuted shard) pass ordinary and five repetitions each. They preserve executed counts/failure identity, ordinary and compact not-run causes, durable nonzero result, red cover and no green stage evidence. Recovery and ambiguous-start failures remain uncertain/red rather than fabricated non-execution.

A-10957/A-10921 local red/green evidence retains the already-audited dirty-source and missing historical excerpt limits; it is not relabelled as this Linux receipt. This is configured T0–T2/Web evidence, not an all-T3/T4 or actual provider-refusal stress proof. The suite's scripted scheduler/executor seams establish the specified outcome contract.

Final evidence clear; C1/C2 verified across source3 and this exact-head result. QA none/after-stage. No new source finding, edit, test execution, Git mutation, browser or delegation by reviewer. Standards 0 findings; Spec 0 findings.
Durable audit A-11023.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T12:47:32.483Z

Merged 011db12c72f5d7d5ee8ca2eed68c637c0e6586a8 onto dev.
