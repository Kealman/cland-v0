---
id: T-1105
kind: task
title: Normalize legacy id-less criteria through task.criterion
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1216
blocked_by: []
topic: topic-957
branch: t/T-1105-normalize-legacy-id-less-criteria
created: 2026-10-22T10:36:44.495Z
updated: 2026-10-24T11:00:06.724Z
closed: 2026-10-24T11:00:06.724Z
---

## Summary

Items created before criterion ids existed show their criteria with `id: null` in `task.view` (with `criterion_seq` as the high-water mark), and `task.criterion` has no normalization-only operation: the first write to such an item assigns ids above the mark. T-1078's web criteria editor therefore shows id-less rows read-only until an ordinary add or a CLI criterion write persists ids (impl-1078, review A-9090 M2, 2026-10-22). A normalization action lets any client give an item's legacy criteria stable ids without changing their text or marks.

## Acceptance criteria

- [x] C1. `task.criterion` (and the `cland task criterion` CLI) offers a normalize operation that assigns ids to every id-less criterion of an item in order, above `criterion_seq`, keeps text and marks unchanged, and is a no-op on an item whose criteria all have ids (test).
  - done: oc-1105 · 2026-10-24T10:15:33.489Z
  - verified: rev-26 [reviewer] · run rev-20261024-1105-final-1 · 2026-10-24T10:29:18.717Z · commit efe438159a40e0dc4bf85000e7ad16ed47275a26
- [x] C2. After normalization the web card's criteria become editable without an add (Web test), and hub/README.md and the CLI help describe the operation (doc).
  - done: oc-1105 · 2026-10-24T10:03:06.444Z
  - verified: rev-26 [reviewer] · run rev-20261024-1105-final-1 · 2026-10-24T10:29:18.717Z · commit efe438159a40e0dc4bf85000e7ad16ed47275a26

## Comments

### rev-23 · 2026-10-24T10:10:14.510Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1105-source
commit: d21cfd199334f7ebbf9b00ca7f85f5a56cfdcd2c
scope: full
findings: [{"severity":"medium","text":"M1: all-ID normalize still writes/updates a valid noncanonical hand-written item because skipUnchanged compares canonical serialization to raw source; bypass publication based on no semantic ID assignment and add a raw-file public regression.","file":"hub/src/tracker/tracker.ts","line":3153},{"severity":"medium","text":"M2: new normalization tests lack required named-path per-test guidance and index entry; document T2 fixture/ownership and allocation/preservation/no-op controls per docs/agents/tests.md.","file":"hub/test/tracker-criterion-write.test.ts","line":116}]
finding_counts: {"high":0,"medium":2,"low":0}

T-1105 full source review — not clear

Reviewed head d21cfd199334f7ebbf9b00ca7f85f5a56cfdcd2c/tree99791bb178ed6f6a252ffb9468c6de22de994099. Fixed incorporated dev a49401d53087482af8cc874d5918bbbacf36e832; comparison git diff a49401d5...d21cfd19 and commit list800ec055,d21cfd19.17 files162+/61−. Request fde66d40 from live claimant oc-1105, hold rev-23. Run rev-20261024-1105-source, full scope. Standards/Spec reviewed in-session because crew.reviewer.subagents=false. Findings M1/M2 below are the complete set.

## Standards

M2 (medium), hub/test/tracker-criterion-write.test.ts:116: two new normalization tests extend an existing T2 file, but no named-path per-test guidance document or index entry exists for that file at the reviewed head. docs/agents/tests.md requires test-specific paragraphs in the test-path document. Add docs/agents/tests/hub-test-tracker-criterion-write.test.ts.md with exact repository-path heading and index entry, describing the in-process public dispatcher/spoke, scratch persistence/native CLI ownership seam, ordered allocation/mark preservation, canonical and M1 noncanonical no-op cases. Existing Web guidance was updated correctly.

Otherwise test levels are appropriate: tracker writes use supplied scratch projectHub/UI/spoke and cland seams at declared T2, validation table stays T1, browser case uses sealed shared Web fixture with fresh contexts and arm-before-action waits. Existing assertions remain; verdict-criteria now asserts its successful call. No direct unsealed process, fixed sleep, cap/workload reduction or competing tracker writer added. New button uses existing busy/offline/readOnly mutation path, shared tokens and semantic button. No separate baseline-smell finding; adapter/schema/permissions/help edits are the existing cross-client contract seam, not unnecessary abstraction. Whitespace check clean.

## Spec

M1 (medium), hub/src/tracker/tracker.ts:3153 and existing #mutate no-op guard around2602: normalize with all IDs calls #prepareCriteria(item,false), returns assigned[] and leaves parsed item fields alone, then relies on skipUnchanged's serializeItem(item)===original source. serializeItem canonicalizes frontmatter ordering, quoting/comments and body trimming. A valid hand-written item with all IDs but noncanonical formatting therefore fails the byte equality, sets updated and writes even though no ID was assigned. C1 explicitly requires no-op for an item whose criteria all have IDs; hub README additionally promises no write/updated change. The two tests begin with task.create canonical output and miss this. Decide no publication from semantic absence of assigned IDs, preserving original bytes and updated independently of serializer formatting; add a public raw-file regression with all IDs and noncanonical valid frontmatter/body. This finding is established by static control-flow/serializer inspection; Reviewer did not execute a reproduction.

Other C1 behavior is source-sound: missing IDs allocate in body order above max(retained criterion_seq,existing IDs); exhaustion, malformed marks and duplicate IDs refuse atomically; marks/text/check states remain while labels are inserted. Existing write queue/source-capture protection and authorization recheck apply to actual writes. New normalize operation is exposed in spoke schema, conditional argument validation, generic CLI frame and documented help. It uses Coordinator/Aide/human management scope through existing fixed operation authorization; grants are unchanged. Ordinary criterion/verdict paths correctly consume .parsed, and existing criterion event text is retained while assignments emit one criteria normalized event with IDs.

C2 source implementation present: Assign ids only appears for id-less rows in editable card, invokes normalize without add, reuses task.view-shaped response; public Web regression requires both assigned inputs, untouched explicit-row marks, successful C6 edit, exactly one normalization frame and no Add frame. Hub README/CLI help and related tracker/Web docs describe operation. This is source review, not same-head runtime proof.

## Evidence and next step

Request reports local Darwin arm64 five hub files36tests, Web item-criteria5tests with isolated Headless Shell/scratch hub, and npm check exit0. No durable original command/stdout/exit/timing/source artifact accompanied the request; preservation requested without reruns for transcription. These summaries are not independently audited raw receipts and no configured run has been submitted. Existing Web parent/child identity timings and any allowance trigger must be assessed from actual passing samples, not counts or file wall alone.

C1 failed for M1 (M2 also needs correction); C2 final runtime remains pending. Fix complete M1/M2, retain original and necessary correction red/green/check receipts, commit/push then request fresh source review before configured mode-free verification. No dev merge after first review absent Coordinator direction. Reviewer static source/Git/artifact reads only; no tests/probes/install/edits/Git mutation/browser/delegation. Standards one medium finding; Spec one medium finding.
Durable review A-10722.

Criteria: C1 failed (All-ID normalization can rewrite noncanonical valid source/update its timestamp instead of being a no-op; new hub tests also need per-test guidance.).

### rev-26 · 2026-10-24T10:15:20.741Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1105-source-2
commit: efe438159a40e0dc4bf85000e7ad16ed47275a26
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1105 correction source review — clear
Head efe438159a40e0dc4bf85000e7ad16ed47275a26; tree 688209ce4c3c7efa5bf5486139bd3cd40d6a52bb. Local/origin task refs agree. Fixed point d21cfd199334f7ebbf9b00ca7f85f5a56cfdcd2c; five-file correction, 72 additions/3 deletions. Scope delta; run rev-20261024-1105-source-2; findings []. Carries forward rev-23's full review A-10722 for unchanged implementation.

## Standards
M2 resolved: the named-path test document has the exact repository test heading and index row, plus the shared-procedure pointer. It explains the T2 public dispatcher/spoke, scratch persistence/native CLI seam and the ordered allocation, mark preservation, canonical/noncanonical no-op controls. The raw-file regression writes before hub startup and then awaits the public normalize reply before checking durable bytes and returned fields; existing teardown ownership remains. No new process, timing bound, workload reduction or tier change. Whitespace check clean.

## Spec
M1 resolved: normalization supplies a semantic unchanged predicate based on assigned.length, rather than canonical serialized bytes. #prepareCriteria(item,false) returns before changing any fields when every criterion already has an ID. #mutate returns the parsed item without #write or updating its timestamp; normalize emits its criteria event only when IDs were assigned. Other mutations retain the prior path; byte-comparison skip remains for plan approval.

The public raw-file regression includes quoted/reordered frontmatter, omitted canonical fields, trailing body spaces and repeated blank lines. It requires original bytes, timestamp and both criterion IDs/check states. Canonical no-op and mixed legacy/explicit IDs above retained sequence tests remain. Existing allocation safety, malformed/duplicate refusals, ownership permissions and Web assignment/edit behavior carry forward unchanged from A-10722. No new findings on either axis.

## Evidence and next step
A-10726 retains original local Darwin arm64 / Node24.21.0 outputs with explicit source scopes. At efe43815 the targeted six-file command reports 40/40 (native runner8121.628875ms), including the new noncanonical control53.411792ms; Web item-criteria reports5/5 (runner7027.640208ms) through isolated Headless Shell and scratch hub; check exits0 with test lint report-only. Native runner/file durations are not individual Web identity samples or integrated suite times. The earlier d21cfd19 36-test/5-Web stdout was never retained and is explicitly unavailable, not reconstructed. Prior-head check remains prior-head evidence.

C1/C2 remain unverified pending same-head configured receipt and final evidence settlement. C1's done mark was cleared by the earlier failed verdict; claimant must refresh it after the fix. The Coordinator's restart-done notice02b0f56d has lifted the old verify pause: after refreshing the mark, submit normal mode-free verification at this unchanged source-cleared head. Do not request or force a full task run; report actual tiers, mapped guards, platform/executor and gate modes. Any changed head requires fresh source review. No dev merge after first review absent rule11 authorization. QA none/after-stage.

Reviewer used read-only source/Git/artifact inspection only; no tests, probes, edits, installs, GUI, merge or delegation. Standards 0 findings; Spec 0 findings.
Durable source review A-10727.

### rev-26 · 2026-10-24T10:29:18.717Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1105-final-1
commit: efe438159a40e0dc4bf85000e7ad16ed47275a26
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1105 final same-head evidence — clear
Head efe438159a40e0dc4bf85000e7ad16ed47275a26; tree688209ce4c3c7efa5bf5486139bd3cd40d6a52bb. Local task/origin refs agree. Scope evidence, run rev-20261024-1105-final-1, findings[]; source-2 A-10727 carries forward.

## Standards
Mode-free configured run dcb7fa46-7d6c-4ace-86e6-d60e4e607208 / A-10745 exits0 at this head. Deduplicated native finish records contain2926 ordinary test passes /422 file passes, plus15 actual load test passes /15 load file passes: three normalization identities each five repetitions. No fail, skip or cancellation. T0 host check24.13s, T1, all fallback hub+Neovim T2 and actual Web pass. No T3/T4 execution claimed.

Linux x64 6.8.0-142-generic c-8 lon1 cland-v0-a9bc4b18; Node24.21.0/Neovim0.12.5; workers2, T1serial/Web4; lifetime655s/$0.0455. Host gate b5c9721da42794a62d5b7532ef92059787be45b9 independently resolves to a Git tree; reused remotely, not Linux typecheck repetition. Native suite walls55.03/333.75/142.47s, Web shard142.38s; projections and command envelopes are separate. Lint133/60, duration/tier overages, five missing baselines and incomplete ratchet-base diagnostics report-only. No enforcing-budget pass.

New normalization tests ordinary0.321776696/0.105226811/0.107981885s; all15 actual repetition samples pass, maximum0.449207475s. New browser normalization case2.090635530s, below4s; no new allowance trigger. Existing add/edit/remove case7.095091344s and parent/file aggregate are not relabelled as new-case timings.

## Spec
C1 verified: ordinary and5/5 load receipts prove ordered C13/C14 allocation above seq12 while retaining C3 text/checked state/existing marks, CLI second-normalize no write/timestamp change, identified-item no-op and noncanonical hand-written bytes preserved. Public role-operation checks and malformed/concurrent-write negative controls also pass; no permission expansion inferred.
C2 verified: browser legacy criteria become editable after Assign IDs, preserving stable identities/marks and editing the newly assigned criterion without adding one. The accepted source review covers bounded pre-armed receipt observers and unchanged final exact-ID assertions. Matching README/CLI/per-test guidance remains source-clear, and docs guards pass.

A-10726 retains local macOS27.0.1/Darwinarm64 Node24.21 original check at d21cfd19 separately from fix-head40/40 hub cases (native runner8121.628875ms),5/5 Web (runner7027.640208ms; browser census after0/scratch hub stopped), and fix-head check0/report lint zero refusals. Original missing earlier targeted stdout stays explicitly absent, not reconstructed or reattributed. Fresh configured evidence is exact-head Linux. Reviewer's source inspection/log parsing did not run tests, probes, browser, edits, install, merge or delegation.

No new findings. C1/C2 current verified. Normal final current-dev read-only conflict check and ready report remain the lead's responsibility; any head change requires fresh source review and configured verification. Coordinator9f095867 stage-cover local quiet and merge hold remain; this clear does not lift either. QA policy none.
Durable final review A-10748.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T11:00:06.724Z

Merged ab77eae3fc7a9834390a8ca3b0a656a2e932fe31 onto dev.
