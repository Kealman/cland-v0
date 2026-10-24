---
id: T-1202
kind: task
title: Merge batches whose candidate touches web/ also run the Web tier
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-948
branch: t/T-1202-merge-batches-whose-candidate-touches
created: 2026-10-24T06:46:04.922Z
updated: 2026-10-24T09:37:49.950Z
---

## Summary

Batches run T1 only; a Web regression from two members green alone could land red (T-1136 with T-1111 in v0.2). Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. A batch whose candidate has a web/ path runs the Web tier after T1, and is red and bisected when Web fails, shown with two members green alone and red together (test).
  - done: impl-1202 · 2026-10-24T09:20:40.734Z
- [x] C2. The batch result names the Web step and its duration (test).
  - done: impl-1202 · 2026-10-24T09:14:17.426Z

## Comments

### impl-1202 · 2026-10-24T09:11:16.743Z

TDD progress: real repository admission initially failed because Web was absent for a candidate diff touching web/. Extended occasion selection and pinned plans, then passed the 15-test file. Controller regression initially failed to admit Web bisection; now proves two individual green Web steps, red combined repeat, unresolved refusal and Web duration. Added missing/conflicting Web receipt tests: both initially landed incorrectly, now hold across reopen. All tests use supplied T1 fake executor seams; no Git/compiler/browser process in fixtures.

### rev-23 · 2026-10-24T09:18:48.981Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1202-source
commit: 4c682aaf85e6088d129dc215f65188d20b8c1622
scope: full
findings: [{"severity":"medium","text":"M1: green failing-file diagnosis after T1 fails before planned Web can land without any Web receipt; require the original pinned full-plan confirmation whenever the original plan includes Web, including unique-omission and passing-repeat paths.","file":"hub/src/hub/merge-batches.ts","line":178}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1202 full source review — not clear

Head4c682aaf85e6088d129dc215f65188d20b8c1622; treeb49acbf39f703bb8bf6af6e0abbb567d2043780a. Fixed incorporated dev basea9a76af40386e214cdcc30efb7b7109cc5ba6b01; git diff a9a76af4...4c682aaf. Origin task head matched at audit.23 files164 additions/55 removals. Run rev-20261024-1202-source, scope full. Both axes reviewed in-session under Reviewer crew policy.

## Standards

No separate standards finding. Tests extend the supplied T1 MergeBatches/Suites semantic seam with FakeClock, candidate facts, real admission/selection transport and package planning; they launch no Git/compiler/worker/browser. Missing/conflicting successful Web proof holds across reopen, full Web diagnostics are selected, and two green-alone/red-combined members are refused. Existing T0/no-web controls and pinned confirmation across configuration reload/reopen remain. Semantic durations are explicitly fixture data, not observed browser measurements. Existing identity keys are renamed in durations.json without changing historical timing values/caps. Exact-path test notes, help, shared tests/hub/Web README, implement/merge/QA skills and default/project Implementer clauses change together; existing clause line is compacted without growth. Upstream implement CHANGES retained; local merge/QA skills have no upstream provenance requirement. No unrelated role grant/config default or workload change. Whitespace check passes.

## Spec

M1 (medium), hub/src/hub/merge-batches.ts:178: the original batch plan can contain check,T1,Web but fail in T1 before Web runs. batchFailures records failing hub identities with steps=[] (only failed check/Web become diagnostic steps). A green unique-removal or passing-repeat file diagnosis then skips the full-confirmation branch because it tests only batch.diagnosis.steps.length, and proceeds directly to landing. No Web receipt exists for the selected tree. The original red result bypasses successful-original requiredSteps checks. C1 requires Web coverage for this web-touching candidate; passing only a failed T1 file cannot supply it.

Require the original pinned full-plan confirmation, including Web, after successful diagnosis whenever the original plan includes Web, regardless of which earlier step failed. Add public regressions for both unique omission and passing repeat with original T1 red/no Web receipt, keeping no-web file-diagnosis behavior and final no-landing assertions. Align merge/shared guidance which presently permits a green file-only repeat to land without qualifying the Web-plan case. Implementer independently reproduced premature T-2/both-member landings and is preparing a replacement committed-head request; that correction is not part of this named-head verdict.

Other requirements reviewed: occasion selection checks candidate web/ paths, retains no-web command plans, inserts Web after T1 (after configured tiers if T1 absent) only for candidates supporting Web. Failed Web becomes a whole-step diagnostic rather than an invalid explicit web-file rerun; transport selects the entire Web tier without load repetitions. Exit-zero original results require a nonconflicting passing planned Web receipt. Failed Web step diagnoses retain full pinned commands/selection for later confirmation. Existing report parsing names Web and measured duration; C2's test asserts the semantic Web exit1/duration7s line. No other source finding.

## Evidence and limits

A-10626 summarizes local Darwin arm64 T1 results at the implementation tree: merge-batches53/53, verification-commands15/15, web-phase8/8, roles-clauses39/39 with byte/growth reserves; npm check reported passed with report-only lint133/60files and zero refusals. Raw original command/stdout/native exit/chunk and source attribution requested for durable preservation without transcription reruns. Summary timing values are not independently audited raw receipts yet. No configured receipt, Linux run, actual live batch Web policy or QA pass exists at this head.

C1 failed for M1; C2 final runtime evidence remains pending. Complete source finding set: M1 only. Correct/commit/push and request fresh source review before configured mode-free verification. Any new source head requires that review; keep prior receipts attributed. Live batch policy requires landing/restart before dependent live runs under rule19, separate from candidate semantic tests. QA none/after-stage. Reviewer ran static source/Git/artifact inspection only, no tests/probes/edits/GUI/merge/delegation. Standards zero findings; Spec one medium finding.
Durable review A-10631.

Criteria: C1 failed (A Web-planned batch failing T1 can land after only green file diagnostics without ever executing Web on the selected candidate.).

### rev-23 · 2026-10-24T09:22:15.153Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1202-source2
commit: 49b74365f88a472ea05cee2416b923f5b33e0445
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1202 corrected source review — clear

Head49b74365f88a472ea05cee2416b923f5b33e0445; treef3f012ad3e7068792ee38e5810c8703038893c9a. Fixed incorporated dev basea9a76af40386e214cdcc30efb7b7109cc5ba6b01; full comparison git diff a9a76af4...49b74365, correction comparison4c682aaf...49b74365. No dev merge after first review. Origin task ref matches. Run rev-20261024-1202-source2; full scope as requested, carrying full audit A-10631 and reviewing all correction hunks. Both axes in-session; findings [].

## Standards

Clear. Two public T1 controller/Suites regressions exercise original T1 failure before Web starts, then unique omission or passing repeat. They assert original failing-file diagnosis with no step, no premature landing, exact selected head/tree, original check/T1/Web confirmation plan, then final expected member landings only after successful full receipts. Fixture manifest now includes the real selected hub test in addition to Web. Existing no-Web direct file-diagnosis controls are unchanged. FakeClock/candidate/executor seam remains; no native Git/compiler/browser, waits or process ownership added.

Shared tests, hub README and merge guidance now qualify file-only recovery: original Web-containing plans require full confirmation, and direct green file-only landing remains limited to plans without Web. Existing help/skills/clauses, byte/growth controls, historical duration key rename and tests from A-10631 carry unchanged. Whitespace check passes.

## Spec

M1 resolved: #tick requires confirmation when diagnosis.steps is nonempty OR requiredSteps includes Web. requiredSteps comes from the original job's pinned commands, so T1 failure/no Web receipt cannot bypass confirmation. Both unique-removal and repeat return a candidate for the original pinned full plan through planFrom; the previously reviewed config/reopen safeguards and exact candidate checks remain. No-Web plans retain existing behavior. Conditional Web admission, named timed result, whole-Web bisection, combined-red refusal and missing/conflicting original passing-proof holds remain accepted. No further source finding.

## Evidence

A-10638 retains23 original native process envelopes, commands/stdout/exits/chunks without transcription reruns. It includes original admission/Web-step/missing-proof red-green pairs, initial53/53 merge-batches and15/15 verification-commands,8/8 web-phase,39/39 clauses, plus initial failed check for stale identity keys and subsequent successful check. M1's correct targeted red shows premature member landing; corrected2/2 exit0. Full corrected merge-batches55/55 native6790.544333ms, exit0, and final correction-tree check exit0 with report-only lint133/60files/zero refusals. Source attribution is to the correction tree committed as76075740;49b74365 adds prose only. These are local Darwin arm64 T1/static receipts, not a configured exact-head suite or live browser/merge policy execution. Semantic Web durations in tests remain fixture data.

C1/C2 final runtime settlement awaits the fresh configured same-head receipt. Source clearance allows configured mode-free submission at exactly49b74365 unchanged. Live policy requires landing/restart under rule19, separate from these in-process proofs; QA none/after-stage. Reviewer performed static source/Git/artifact inspection only, no tests/probes/edits/GUI/merge/delegation. Standards zero remaining findings; Spec zero remaining findings.
Durable review A-10643.

### rev-23 · 2026-10-24T09:34:23.600Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1202-evidence1
commit: 49b74365f88a472ea05cee2416b923f5b33e0445
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1202 same-head configured evidence audit — clear receipt, integration pending

Head49b74365f88a472ea05cee2416b923f5b33e0445/treef3f012ad3e7068792ee38e5810c8703038893c9a. Source2 A-10643/M1 fix remains accepted. Run rev-20261024-1202-evidence1; scope evidence; findings []. This is receipt settlement at this head, not final readiness after the authorized integration below.

Configured5bcc907b-2477-438c-801f-697770e6f9e3/A-10662 finishes exit0 at the reviewed head. Native ordinary records:2874 tests/419files all pass, no failure/cancellation/skip.50 additional actual load-gate tests/files pass: five repetitions of each of nine new Web-batch controller identities plus the inherited test-docs identity. T1, all fallback hub/Neovim T2 and complete Web44files/223tests completed exit0. No T3/T4 executed; queued batch/deferred notices are not task process receipts.

Linux x64 6.8.0-142-generic droplet c-8lon1 cland-v0-db013ee0, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime580s/$0.0403. Host check stdout preserved, gatee8081fa482b4282f141ad1d3db7e600e28a90d25 independently tree object, reused not repeated remotely. Native suite walls54.77/295.53/128.13s; phase envelopes58/300/132s and projections differ. Web shard128.04s. Lint133/60files, two missing baselines, Web wall, unrelated duration and incomplete ratchet-base diagnostics are report-only. No affected merge-batches/verification-commands/web-phase/roles-clauses tier mismatch found.

C1 runtime proof present: combined-Web-red case passes0.161319622s; missing/conflicting proof holds and both Web diagnosis/confirmation paths pass. M1 T1-before-Web unique omission and passing repeat cases pass0.142010982/0.210815644s plus5/5 each, retaining no premature landing and exact original full-plan confirmation. C2 proof present: combined-red regression retains report Web exit1/duration7s semantic fixture assertion; actual runner command/selection planning tests pass. This is in-process policy proof with semantic executor durations, not a live restarted batch running the new policy.

New ordinary Web-batch T1 identities max0.231685984s; loaded samples are higher, maximum0.600898692s (Web passing repeat later-tier-exit1). Do not claim all passing samples below0.4s or an enforcing-tier-budget pass. Raw loaded timings remain report-mode evidence. No Web test identity was added by this item.

Post-result read-only merge-tree against origin/dev0a57d8bf reports four conflicts in implement/QA skills, shared tests docs and roles-clauses test; head unchanged/clean, no Reviewer merge. Coordinator9f30c71e explicitly directs waiting for T-542/T-422 to land, merging once, preserving mapped-T4/T0/conditional-Web policies, fresh delta review and fresh mode-free verification before ready. Implementer23394baa is following that order. Therefore final criterion marks/readiness wait for the resulting head; this green receipt stays attributed to49b74365 and must not be reused as changed-head final evidence.

QA none/after-stage; live policy needs landing/restart. Reviewer performed static source/Git/artifact reads only, no tests/probes/edits/GUI/merge/delegation. Standards/evidence clear; Spec/evidence clear at this head, final integration pending.
Durable review A-10667.

### rev-23 · 2026-10-24T09:37:49.950Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1202-source3
commit: 71a36775279633ff8aed34afb7498f26f17a7d42
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1202 authorized merge delta source review — clear

Head71a36775279633ff8aed34afb7498f26f17a7d42/tree615851ce8f2bed185fc0148e2b5da245c1b69b62. Parents reviewed49b74365f88a472ea05cee2416b923f5b33e0445 and dev69b3dc7d. Coordinator9f30c71e explicitly requested this single integration after T-542/T-422 landing. Run rev-20261024-1202-source3; scope delta; findings []. Read-only parent diffs and combined merge diff inspected; origin task ref matches. Both axes in-session.

## Standards

Clear. Resolutions retain T-1203 changed T3/T4 and mapped T4 guards once, T-1018 T0 batch guidance, T-1202 conditional Web, T-542 root install warning/safe shared-reader routing and T-422 sealed-ledger fixture guidance. Implement/QA skills, shared tests table/procedure, CLI help and roles-clauses assertions describe the combined behavior; default/project clauses and reserve checks remain aligned. Upstream implement CHANGES entries retained alongside T-1202. No conflict markers or whitespace errors.

T-1202 controller and verification-commands/web-phase assertions are unchanged from source-clear49b74365. The overlapping FIFO fixture now supplies immutable diff-tree landed paths through its existing Git port and adds assertion diagnostics, matching upstream T-542; FIFO, receipt and closed-item assertions remain. No new native process/browser, timing cap or workload change.

## Spec

Clear. Conditional candidate web/ selection, Web-after-T1 plan, whole-Web diagnosis, missing/conflicting successful step proof, combined-red refusal and M1's full pinned confirmation after either T1 file recovery remain intact. merge-batches.ts, verification-plan.ts and verification-occasion.ts are byte-unchanged from49b74365. Suites' three-line Web admission hunk is preserved atop upstream host-check dependency hint logic; that addition does not change batch command/selection pinning. Upstream mapped-guard selection removes duration metadata for batch occasions as before; it does not replace the conditional Web path. No changed public contract beyond reviewed upstream policies.

A-10668 retains original post-merge native output/exits from local Darwin arm64, source tree committed unchanged by this merge: merge-batches55/55 (7489.701167ms), clauses39/39 (120.679959ms), verification-commands15/15 (537.411750ms), web-phase8/8 (312.193958ms),117 T1 tests across four files, no failures/skips; check exit0 with report-only lint133/60files/zero refusals. No reruns for transcription. These are local source-equivalent merge-tree receipts, not the fresh configured merged-head Linux result.

Prior5bcc907b/A-10662 and evidence audit A-10667 remain green at parent49b74365 only, including report-mode loaded max0.600898692s. They are not merged-head final evidence. C1/C2 final runtime marks await a fresh configured mode-free result at exactly71a36775. Source clearance permits that submission, unchanged head, reporting to Reviewer/item lead. Live batch policy still needs landing/restart under rule19; QA none/after-stage. Reviewer static source/Git/artifact inspection only; no tests/probes/edits/GUI/merge/delegation. Standards zero findings; Spec zero findings.
Durable review A-10670.
