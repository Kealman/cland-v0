---
id: T-360
kind: task
title: Codex fake harness replies to the first channel block of a digest instead of the message addressed to it
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-982
branch: t/T-360-codex-fake-harness-replies-to-the-first
created: 2026-10-13T21:06:21.500Z
updated: 2026-10-24T13:02:16.481Z
closed: 2026-10-24T13:02:16.481Z
---

## Summary

The Codex fake harness (`hub/test/fakes/codex`) takes the topic and msg_id it replies to from the first channel block of the whole input. When a digest starts with an Agents event and then carries the human's General message, the fake answers into Agents with no `to`, and its `send` is refused with `forbidden send:human`.

## Evidence

- Found by QA run qa-2026-10-13-27-8 (E-270 demo, M24) at dev a3469c0 in a scratch project.
- The digest delivered to the fake held a task-status event in Agents first, then the human's General message.
- The fake's reply took the Agents topic and was refused `send:human`, so the expected pong never arrived. QA used the brief's topic-history fallback.

## What to fix

The fake should reply to the delivery that addressed it, the last human or agent message in the digest rather than the first channel block, and should skip hub event entries. Add a test where a digest starts with an event and ends with a General message.

## Acceptance criteria

- [x] C1. Given a digest that starts with a hub event in Agents and ends with the human's General message, the Codex fake replies into General to that message (its topic and msg_id), and the send is accepted (test).
  - done: impl-360 · 2026-10-24T12:40:14.177Z
  - verified: rev-23 [reviewer] · run rev-20261024-360-final · 2026-10-24T12:56:22.517Z · commit 48e416f217a82dc35c2ab5435214a692aaa29ae4
- [x] C2. The fake skips hub event entries when choosing its reply target, and existing Codex fake replies to single deliveries are unchanged (test).
  - done: impl-360 · 2026-10-24T12:40:14.281Z
  - verified: rev-23 [reviewer] · run rev-20261024-360-final · 2026-10-24T12:56:22.517Z · commit 48e416f217a82dc35c2ab5435214a692aaa29ae4

## Comments

### impl-360 · 2026-10-24T12:32:29.588Z

Implementation seam: existing T3 Codex real-binary contract in hub/test/codex-adapter.test.ts; native turn input carries a channel digest and actual spoke send/topic history proves selected body, topic, and reply_to. Task explicitly requests this digest regression. No new process family, dependencies, or production adapter behavior.

### rev-23 · 2026-10-24T12:39:08.940Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-360-source
commit: e19d772fd69f8ab2ac2824a56a013049bbf10185
scope: full
findings: [{"severity":"medium","text":"M1: Add path-derived per-test guide docs/agents/tests/hub-test-codex-adapter.test.ts.md with exact repo-path heading and one index row; document new native digest/completion/persisted-routing contract per docs/agents/tests.md.","file":"hub/test/codex-adapter.test.ts","line":337}]
finding_counts: {"high":0,"medium":1,"low":0}

T-360 full source review at e19d772fd69f8ab2ac2824a56a013049bbf10185 (tree aabc40bd740dc173e407c33c3842a19a03dd8b81), fixed base d76d69fb79ccb2ede084dd04f75a3854a1a66df1. Diff command: git diff d76d69fb79ccb2ede084dd04f75a3854a1a66df1...e19d772fd69f8ab2ac2824a56a013049bbf10185; single commit e19d772f. Reviewer hold owned rev-23. Both axes in-session: .cland/crew.toml reviewer.subagents=false overrides skill delegation. Read-only source/Git/tracker/artifact review; no tests/probes/edits/browser or Git mutation.

## Standards
M1 (medium), hub/test/codex-adapter.test.ts:337: the new digest contract has no per-test guidance or index row. docs/agents/tests.md requires: "Add test-specific paragraphs to the file named after the repository test path". Neither docs/agents/tests/hub-test-codex-adapter.test.ts.md nor its index entry exists at this head. Add that guide with exact heading '# hub/test/codex-adapter.test.ts', describe the native digest input/completion barrier and persisted routing assertions plus existing scratch ownership, and list it once in docs/agents/tests/index.md. Existing T3 contract classification is correct; task explicitly requires the fake native boundary. No extra process family or timer ordering introduced. No other documented-standard breach or material smell found.

## Spec
No functional finding. The fake chooses the last from_kind human/agent envelope and consistently reads body/topic/msg_id/scripted-verdict sender from that same match; body-undefined exits before dereferencing an absent delivery, so event-only input has no send. The new native AppServerClient test supplies leading Agents event plus older agent/final human, then later agent plus trailing event, then event-only. It arms exact turn/completed receipt before submissions and compares all coord replies persisted in both topics, establishing body/topic/replyTo and no event reply. Existing single-delivery/approval/lifecycle and scripted review/QA code remain structurally intact. The generic send is awaited before turn/completed; persisted messages prove accepted sends without relying on log text. Actual channel grammar uses from_kind in delivery headers; no product authority change.

A-10999 is local Darwin arm64 summary evidence: claimed test-first failure, final-source codex-adapter13/13 (22.289743541s), review-qa1/1 (5.359418625s), hub typecheck exit0, report-only lint133/60 zero refusals. It does not retain complete original command tool outputs/exits/native per-case timings, and is not configured verification. Preserve available originals with source/platform attribution and explicit missing-record limits, without reruns for transcription. No overall check wall is inferred. Source clear and fresh same-head mode-free configured evidence remain pending; no per-item QA required.

Result not clear for M1; C1 test documentation incomplete, C2 functional implementation appears correct but remains runtime-dependent/unverified. Standards1 medium finding; Spec0 findings.

Audit A-11014.

Criteria: C1 failed (M1: new digest contract lacks required per-test guide and index entry.).

### rev-23 · 2026-10-24T12:42:14.491Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-360-source2
commit: 48e416f217a82dc35c2ab5435214a692aaa29ae4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-360 replacement full source review — clear

Head48e416f217a82dc35c2ab5435214a692aaa29ae4/tree01d7c1cab946c8f1420235efb2a399cc2e8a0169; branch ref independently matches. Parent e19d772fd69f8ab2ac2824a56a013049bbf10185; fixed base d76d69fb79ccb2ede084dd04f75a3854a1a66df1. Full task diff four files51 additions6 deletions; docs-only parent delta, no functional source change or new dev merge. Full prior audit rev-20261024-360-source/A-11014 carried forward and correction inspected. Scope full, run rev-20261024-360-source2; findings []. Reviewer read-only source/Git/tracker/artifact reads, no tests/probes/edits/Git mutation/browser/delegation; both axes in-session under reviewer.subagents=false.

## Standards
M1 resolved: exact path-derived guide docs/agents/tests/hub-test-codex-adapter.test.ts.md has '# hub/test/codex-adapter.test.ts' heading and one valid index row. It describes all three digest controls, exact native turn/completed barrier armed before submission, persisted body/topic/replyTo assertions, no event reply, existing scratch/sealed lifecycle ownership and one-file local procedure. T3 existing Codex binary contract is justified by actual fake app-server/production spoke edge; lower-tier parsing reconciliation remains separate. No extra process family, timeout relaxation, wall-clock ordering or dependency/policy change. Whitespace check clean. No remaining documented-standard or material smell finding.

## Spec
No functional finding. Last human/agent envelope supplies body, topic, message id and scripted-verdict sender together; hub-only input bypasses sends. Native contract asserts leading Agents event with final General human, later agent despite trailing event, and event-only no reply after exact completed-turn receipt. Persisted rows prove acceptance; original single-delivery, approval/lifecycle and scripted verdict paths remain intact. C1/C2 are both test-dependent and stay unverified until fresh same-head configured evidence.

A-11018 retains transcribed original local Darwin arm64 command results and explicit source limits, not mechanically exported raw envelopes: regression-only red on base+dirties chunk58b128 exit1 (first-event body/topic/replyTo vs required human), first green d218e3 exit0 before two added controls, final functional-source file13/13 chunks2d8347/a19d2a exit0/Node22289.743541ms with new case775.646875ms; scripted review/QA1/1 chunk156fd7 exit0/4434.965209ms case/Node5359.418625ms. Hub typecheck5ac33c/a8c05e exit0 only hubworkspace; report-only lint133/60 zero refusals aa0ecb, no complete configured T0 or overall check time. Guide-only guard f91dc7 exit0/3of3/Node181.177542ms. Original outputs not rerun for transcription. These functional receipts were working source subsequently committed as e19d772f, not runtime proof at corrected48e416f2. Initial A-10999 summaries remain historical; no missing value inferred.

Source clearance permits mode-free configured verify at exact unchanged48e416f2, not a forced full suite. Return original log/run/head/platform and actual selected phases/timings; no per-item QA (none/after-stage). Current C1/C2 done marks restored. Standards0 findings; Spec0 findings.

Audit A-11024.

### rev-23 · 2026-10-24T12:56:22.517Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-360-final
commit: 48e416f217a82dc35c2ab5435214a692aaa29ae4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-360 final same-head evidence — clear

Head48e416f217a82dc35c2ab5435214a692aaa29ae4/tree01d7c1cab946c8f1420235efb2a399cc2e8a0169; branch ref independently matches. Full source rev-20261024-360-source2/A-11024 stands unchanged, M1 resolved. Scope evidence, run rev-20261024-360-final; findings []; C1/C2 verified. Reviewer static source/Git/tracker/artifact/log reads only, no execution/edits/Git mutation/browser/delegation.

Configured mode-free cb239514-cced-4037-b9e2-4b2355984cd0 / original A-11053 finishes exit0; task.view independently agrees exact passed head. Native finish records confirm2975ordinary passing tests/425passing files, zero fail/cancel/skip, no separate load-gate repetition records. Actual phases hostT0, allT1(137files855top-level identities), fallbackallhub+NeovimT2(243/1772), changedT3Codexcontract(1file13identities), fullWeb(44/225). ChangedT3 once/no repetitions, selected-phase addedwall31.832s excluding machine wait; not a whole-T3/T4/stage/QA cover. NoT4 command, remainingT3 deferred by configured policy.

New digest contract passes1.386352909s: leading Agents hub event plus older agent/final General human is answered with selected body/topic/replyTo; later agent beats human despite trailing event; event-only emits no additional reply after exact turn/completed. Persisted accepted messages across Agents+General are final oracle. Existing native single-delivery/approval/routing contract passes2.654907580s, first-brief/first-refusal/failed-turn, attach, death/restart/relaunch/rename, second spoke and uncertain-inject all pass. Native Codex file13/13, file31.685837193s. This is the shipped fake app-server+production spoke contract, not a real Codex model behavior claim. Local scripted review/QA1/1 remains A-11018 historical local evidence; no remote execution assigned to its unchanged T3 file.

Hostcheck28.21s exits0; marker a2d6bb0299ab2eaf8e9d8ac209ae7865acf7cbf0 independently Git tree, retained host gate not repeated remote typecheck. T1/T2/T3/Web envelopes63/357/36/158s differ from actualsuite59.23/351.85/31.89/153.21s; shards59.21/257.87hub+93.93Neovim/31.87changed/153.10Web. FinalWebprojection150.266s at2workers is not measured wall at4workers. Linuxx64 6.8.0-142-generic,c-8lon1 cland-v0-3ee46d94, Node24.21/Nvim0.12.5,workers2/Web4,lifetime705s/$0.0490;diskfsync8.9ms/SQLite12.03ms,tmpfs0.07/0.53ms,iowait/steal0.01%.

Report-only lint133/60 and unrelated Web/scale/render/Mermaid budget overages retained. Existing native policy case5.251149532s carries an over5s report notice but passes; new digest1.386352909s is below thresholds, no allowance requested. Webwall153.21>40s/items49.25s. T3 projection2196.690vs2195.304s(+1.386s) would refuse growth in enforcing mode; currently report-only, retained for lead merge planning rather than changed baseline/legacy allowance. Not enforcing-budget/clean-lint clearance.

A-11018 local Darwinarm64 transcription preserves original red58b128exit1, initialgreenbeforeextra controlsd218e3exit0, complete final-functional-source13/13exit0/Node22289.743541ms (digest775.646875ms), review-qa1/1exit0, hub-onlytypecheckexit0, lint133/60zero refusals and docs-guard3/3exit0. Source attribution distinguishes precommit working source/e19d772f and docs-only correction from configured48e416f2; no full checkwall inferred or reruns for transcription.

C1/C2 current done marks present before verdict. No per-item QA policy/brief (none/after-stage). Lead may perform final current-dev read-only conflict check and ready report; Coordinator owns enqueue/merge. No landing claim. Standards0 findings; Spec0 findings.

Durable A-11054.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T13:02:16.481Z

Merged 75951a7d8a1f669d41568d9698c15acd5635ace0 onto dev.
