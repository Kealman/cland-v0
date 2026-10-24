---
id: T-1105
kind: task
title: Normalize legacy id-less criteria through task.criterion
state: open
status: review
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
updated: 2026-10-24T10:15:33.489Z
---

## Summary

Items created before criterion ids existed show their criteria with `id: null` in `task.view` (with `criterion_seq` as the high-water mark), and `task.criterion` has no normalization-only operation: the first write to such an item assigns ids above the mark. T-1078's web criteria editor therefore shows id-less rows read-only until an ordinary add or a CLI criterion write persists ids (impl-1078, review A-9090 M2, 2026-10-22). A normalization action lets any client give an item's legacy criteria stable ids without changing their text or marks.

## Acceptance criteria

- [x] C1. `task.criterion` (and the `cland task criterion` CLI) offers a normalize operation that assigns ids to every id-less criterion of an item in order, above `criterion_seq`, keeps text and marks unchanged, and is a no-op on an item whose criteria all have ids (test).
  - done: oc-1105 · 2026-10-24T10:15:33.489Z
- [x] C2. After normalization the web card's criteria become editable without an add (Web test), and hub/README.md and the CLI help describe the operation (doc).
  - done: oc-1105 · 2026-10-24T10:03:06.444Z

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
