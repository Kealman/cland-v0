---
id: T-1207
kind: task
title: Merge queue warns when a candidate touches files of an epic under demo
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-967
branch: t/T-1207-merge-queue-warns-when-a-candidate
created: 2026-10-24T06:46:05.607Z
updated: 2026-10-24T13:02:00.297Z
---

## Summary

Landing a file an epic's demo covers makes the demo stale (demo freshness); the Coordinator held such merges by hand in v0.2. Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. Enqueueing a candidate whose diff touches files merged by an epic with an active demo lease or unrecorded demo posts a warning naming the epic and files (test).
  - done: impl-1207 · 2026-10-24T13:02:00.201Z

## Comments

### impl-1207 · 2026-10-24T11:51:14.611Z

Implementation inspection: queue admission is in TaskMerges.merge, with existing lane predecessor holds using epicMergeFiles. Proposed T2 seam is sealed projectHub public merge/topic.history frames with injected Git history; seam and unrecorded-demo scope questions sent to supervising lead before tests. No source changes yet.

### impl-1207 · 2026-10-24T11:58:53.569Z

Implemented advisory merge-demo-warning on successful queue admission, routing to Coordinator/item lead in candidate topic (Agents fallback), preserving existing follows hold and reply shape. TDD seam confirmed by Coordinator. Due definition confirmed: all task children closed, last landed on dev, no hub QA demo verdict; active unexpired lease also warns. Targeted local macOS T2 enqueue tests now pass including stage-only verdict, recorded-demo active lease, expiry/release and quiet controls. Hub typecheck and static/test lint completed (report-only lint, 0 refusals). Final targeted file and role byte-reserve checks follow before source review.

### impl-1207 · 2026-10-24T12:05:49.666Z

Source-review M1 accepted: advisory lease/history lookup errors blocked enqueue. Test-first controls reproduced actual failures "invalid droplet lease", "Git could not read epic demo surfaces", "Malformed Git history commit" and "fixture Git read failed". Scoped best-effort handling only around those diagnostic reads now preserves enqueue plus an unavailable-warning notice; tracker/authorization/lane/freshness checks remain outside catches. Dirty ebb51f7c-based repair: local macOS merge-queue T2 28/28 and hub typecheck pass. Awaiting consolidated source findings before committing/pushing repair and requesting fresh source review; no verification submitted.

### rev-32 · 2026-10-24T12:05:51.685Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-1207-source
commit: ebb51f7caf5aee12794aff6e9d9338352d6d1d60
scope: full
findings: [{"severity":"medium","text":"M1: advisory lease/history reads throw before queue insertion, making damaged/unavailable diagnostic evidence refuse an otherwise valid enqueue; isolate those reads, publish unavailable diagnostics and retain real authorization/lane/freshness refusals.","file":"hub/src/hub/merge-queue.ts","line":118}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1207 full source review — not clear

Headebb51f7caf5aee12794aff6e9d9338352d6d1d60; treea87e6abda9f019ed4c51a08e9087c69f0da6ce56. Parents6b531a1ae90acddef34bd64f59040b71883bf3a1 and512c4960bb573e8df6e215de8bceb509af8e7d6a. Task/origin refs agree. Fixed incorporated dev512c4960; ten task-diff files141+/10-. Whitespace check exit0. Scope full; complete finding set M1.

## Standards

Public T2 seam is appropriate: projectHub with complete FakeClock, injected Git/history, disposable root, seeded tracker/durable receipts before serving, no real Git/child/browser. Warning publication is synchronous before the successful merge reply; reading topic.history afterwards is a durable boundary without sleeps. Tests retain response shape, positive queue membership, exact epic/path text, Coordinator and claimant routing. Scenario matrix distinguishes active/due, stage-only QA, building, recorded, recorded-active, expired/released, closed, unlanded and unrelated epics.

Matching --help, hubREADME, shared and per-test docs, project-owned merge skill and existing Coordinator role-clause line describe advisory behavior and unchanged follows refusal. Merge skill has no kept-upstream provenance requirement. No additional smell finding, tier downgrade, dependency or authority expansion.

## Spec

M1 medium, hub/src/hub/merge-queue.ts:118/131 and hub/src/hub/merge.ts:184: advisory evidence collection can block enqueue. demoWarnings awaits readLeases and epicMergeFiles before the queue insertion. readLeases throws for malformed JSON/invalid lease fields/unreadable files, including unrelated old leases; epicMergeFiles throws for null Git reads or malformed history framing. Those errors propagate through TaskMerges before store.enqueueMerge, so a candidate that otherwise passes review/authorization/lane/freshness gets refused because optional warning evidence was unavailable. This violates Coordinatorf7b39eed's explicit “warning is advisory: enqueue still succeeds.” Isolate these diagnostic reads and retain successful enqueue with a useful unavailable-warning diagnostic. Do not catch/relax authorization, existing follows hold, candidate freshness or real merge errors. Add public enqueue controls for damaged lease evidence and unavailable/malformed history at the approved T2 seam, keeping final success/queue assertions. The implementer accepted this finding and is preparing a test-first fix.

Otherwise source follows the confirmed scope. Planning containers are selected through configured tracker semantics. Active requires lease stateactive and deadline strictly after injected clocknow. Due reuses followStatus: task descendants allclosed and last-closed ticket has mergeReceipt.base dev; no stage-less hub QA verdict by QA. Active lease still warns after recorded QA; stage verdict is separate. Closed/normal-build/recorded-without-active cases remain quiet.

Overlap uses exact candidate paths against Item-trailer-attributed landed task surfaces at the pinned integration commit, deduplicated/sorted. Existing laneHold is prepared before warning lookup and validated alongside final authorize/gate/branch/base checks; no removal of the follows refusal. Warning routing uses candidate topic or Agents and hub alias resolution for Coordinator/lead. Successful response shape remains item/queued. No additional functional finding.

C1 failed for M1; no verified mark. Coordinator decisions d8478597/f7b39eed independently read: sealed public merge/topic history seam and running/due definition are authoritative. Correct the advisory read failures, commit/push and request source review before mode-free verify. No dev merge after first review unless Coordinator/shared-fix or actual conflict permits it.

A-10893 is an implementation summary: exact-head Darwin/macOS targeted merge-queue24/24 and hub typecheckpass; premerge role-clauses39/39, test lint report-only133findings60files/zero refusals and tier lintpass. It reports initial red actualundefined vs expected warning, but is not full original stdout/exit evidence. Original receipts requested without transcription reruns; new fix receipts should be captured directly. No configured/Linux/full-suite or enforcing budget pass claimed. QA none/after-stage.

Reviewer completed Standards and Spec personally with read-only Git/source/docs/topic/artifact inspection, no tests, probes, edits, browser or delegation. Standards0 independent findings; Spec1medium M1.

Durable audit A-10909.

Criteria: C1 failed (M1: malformed lease or unavailable/malformed Git history turns the advisory warning scan into an enqueue refusal.).

### rev-32 · 2026-10-24T12:09:36.026Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1207-source-2
commit: 769b33c7fcee74069cb1d73b8d3eabb6c4a47a60
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1207 corrected full source review — clear

Head769b33c7fcee74069cb1d73b8d3eabb6c4a47a60; tree58218bc6a2846ca4f6552dc5dc1ccec6bed0e065; parentebb51f7caf5aee12794aff6e9d9338352d6d1d60 (ebb51f7c). Task/origin refs match. One corrective commit/no dev merge. Scope full, carrying accepted portions of A-10909. Whitespace check exit0; findings[].

## Standards

M1 fixed: only the promises from readLeases and epicMergeFiles catch read/parsing failures into null evidence. Tracker listing/view, resumed guard callbacks, due classification, overlap publication and all TaskMerges lane/authorize/gate/final branch/base checks remain outside those catches. A lease failure produces demo leases unavailable while valid due/history warnings can still be collected; a per-epic history failure names that epic's landed files unavailable and continues. No raw Git/lease error details or credentials enter the notice.

The discriminated warning union routes unavailable versus overlap notices through the same Coordinator/item-lead/candidate-topic-or-Agents callback after durable queue insertion. Existing item/queued reply shape and follows refusal remain. No broad admission catch or hard-error relaxation.

Four new public T2 controls fault invalid lease data, null Git history, malformed history and throwing Git history; each asserts exact successful enqueue reply, one durable queue entry and exact merge-demo-warning-unavailable text. They reuse injected Git, FakeClock, sealed disposable roots/Tracker and history receipt after merge response. No process or time-delay test added. Existing active/due/quiet/routing assertions are unchanged. Help/hubREADME/shared/per-test guide/project-owned merge skill explicitly describe best-effort diagnostics and preserved refusals. No new independent smell finding.

## Spec

C1 source contract is repaired: valid evidence warns with epic and exact landed file intersection; unavailable optional evidence reports its limitation while enqueue succeeds. Active/unexpired versus due/no hub demo verdict, stage exclusion, closed/building/completed/expired/released controls remain as Coordinator d8478597/f7b39eed specified. Genuine lane/authorization/freshness refusals still run beside final enqueue.

A-10915 is direct original corrected-head local macOS receipt: merge-queue28/28, zero failures/skips, exit0, Node6.305254s; new fault cases0.081861–0.114584s; normal overlap/routing case0.375237s. Hub typecheck exit0. Per-tool polling waits are not total typecheck elapsed time. This is targeted T2/typecheck, no enforcing duration gate or configured/Linux claim.

A-10914 retains24 original tool-result blocks with enclosing inputs, source/platform labels and missing_chunks[]: original red/green, premerge clauses/lint/tiers, prior exact-head queue/typecheck and dirty-tree M1 red/green/follows. Original M1 red contains invalid droplet lease, Git could not read epic demo surfaces, Malformed Git history commit and fixture Git read failed; repaired precommit follows9/9 remains separately attributed. Uncaptured dirty tree hashes and original truncation are disclosed. No evidence-only rerun or fabricated committed-head claim.

No source findings remain. C1 is done but runtime verification is left pending fresh unchanged-head mode-free verification with Reviewer/item-lead result routing. Original source-not-clear A-10909 remains historical. Any head change requires new source review. QA none/after-stage; no per-item QA brief or stage pass.

Reviewer personally completed Standards/Spec via read-only Git/source/docs/artifact reads; no tests, probes, edits, browser or delegation. Standards0 findings; Spec0 findings.

Durable audit A-10917.

### impl-1207 · 2026-10-24T12:27:35.587Z

Verification 74746609 at reviewed 769b33c7 returned exit 1 with a retained interruption record (A-10972). Linux droplet c-8 lon1; T0/T1/T2 exited 0, Web exited 1; budgets report-only. Actual failure: web/test/asks.test.ts offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft: AssertionError [ERR_ASSERTION]: fake-clock hub reconnect is Live; false !== true (web/test/harness.ts:53, asks.test.ts:307). Coordinator confirms shared-defect candidate and orders diagnosis held while isolated dev 5/5 runs; wait for unchanged-rerun authorization or posted shared fix. No local diagnosis/test rerun or head change. Final evidence review pending usable runtime receipt.

### rev-32 · 2026-10-24T12:28:24.347Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-1207-evidence-1
commit: 769b33c7fcee74069cb1d73b8d3eabb6c4a47a60
scope: evidence
findings: [{"severity":"medium","text":"Configured run 74746609/A-10972 exits 1: offline asks reconnect assertion is false at harness.ts:53 (asks.test.ts:307). Final evidence cannot clear; Coordinator 2e3ef901 owns shared-defect disposition, with no independent diagnosis or retry yet.","file":"web/test/harness.ts","line":53}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1207 configured evidence review — not clear

Exact reviewed head 769b33c7fcee74069cb1d73b8d3eabb6c4a47a60, tree 58218bc6a2846ca4f6552dc5dc1ccec6bed0e065; origin matches. Source audit rev-20261024-1207-source-2 / A-10917 remains the accepted implementation assessment. This pass audits only configured receipt 74746609-d2b9-4a44-95d8-2a1d29f134a4 / A-10972.

Spec — medium evidence blocker
web/test/harness.ts:53, called from web/test/asks.test.ts:307: the configured run fails “offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft”. Original output at A-10972 lines 17130–17147: “AssertionError [ERR_ASSERTION]: fake-clock hub reconnect is Live”, “false !== true”, reconnectUntilLive at harness.ts:53. This is a failed Web assertion, not a report-only budget warning. The run cannot establish final C1 readiness.

Actual execution
Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-4b5c9e81, Node v24.21.0, Neovim v0.12.5, workers 2 (Web 4). Host T0 exits 0 (43.7 s), all T1 exits 0, fallback all hub/Neovim T2 exits 0, Web exits 1; no T3/T4 completion claimed. Phase envelopes 67/392/175 s differ from runner suite walls 62.06/388.02/170.74 s. Lifetime 744 s and $0.0516 describe the droplet, not suite wall.

Raw progress records show 2966 ordinary tests: 2965 pass/1 fail, plus 75 passing load-gate repetitions. Thus the interruption footer's 3041 completed/3040 passing includes those repetitions; it is not 3041 distinct base tests. No skips/cancellations in completed ordinary records. The log retains its interruption footer and overall exit 1.

The changed merge-queue file passes all 28 ordinary tests, including all diagnostic-fault controls and warning cases. Fifteen new identities also have 75 passing repetition records. Their ordinary timings are below the applicable new-identity threshold (largest new case 0.527360981 s); no allowance needed for these cases. Generic lint/duration/ratchet diagnostics remain report-only: 133 findings/60 files, existing would-fail lines and Web over-budget retained. Static checks and tier exits remain distinct from these diagnostics.

Standards
No new source finding. No code was changed or tests executed by this reviewer. Coordinator decision 2e3ef901-a37e-4012-a966-96df031c23bd identifies the failure as a shared-defect candidate, instructs no diagnosis here, and owns a five-run dev control before deciding between one unchanged retry and a posted shared fix. That classification is attributed to the Coordinator; this audit makes no independent root-cause or load-flake claim.

Disposition
Evidence not clear; C1 unverified/failed for the required configured receipt. Preserve the unchanged source and failed log. Await the Coordinator's explicit disposition before retrying or taking a shared fix. A changed head requires fresh source review; no independent Web edit or dev merge requested. No overall pass, ready, QA or landing claim.
Durable audit A-10977.

Criteria: C1 failed (Required same-head configured receipt failed the Web reconnect assertion; await Coordinator shared-defect disposition and usable replacement evidence.).
