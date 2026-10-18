---
id: T-715
kind: task
title: The hub runs a nightly T1–T4 soak on a droplet within the daily spend cap and records the coverage map from it
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-714
topic: topic-522
branch: t/T-715-the-hub-runs-a-nightly-t1-t4-soak-on-a
created: 2026-10-16T19:59:44.178Z
updated: 2026-10-18T16:44:23.616Z
---

## Summary

Decision 7: a nightly T4 soak within the daily spend cap (~$0.15–0.25 a day, memo §6.7). The soak also has to carry what the batch no longer does. Coverage maps today come only from clean integrated full `dev` runs, and `coverage_max_age` is two days. Once covers retire (T-713, T-718) and batches run T1 and T3 only, T2 coverage would age out and every task run would fall back to all of T2.

## What to build

- **When.** `[verification] soak = "<HH:MM>"` (UTC; empty disables it, and this repository sets `"03:00"`). At that time the hub submits one run of the clean `dev` head with the new occasion `soak`, at the Coordinator's priority on the droplet executor, when `dev`'s candidate tree differs from the last soak's.
- **The run** plans T1–T4 with `CLAND_TEST_SOAK=1` and the load gate for identities new since the last soak, then records and publishes the coverage map as integrated full runs do.
- **Spend.** Before acquiring, the hub reserves the run's cost in the shared spend ledger. When the cap would be exceeded, it skips that night and posts one notice naming the cap.
- **The result** goes to the Coordinator in General. A red soak posts a quarantine proposal (T-712's form) for each test that failed with no code change since its last green, and never blocks a merge or a batch.

## Acceptance criteria

- [x] C1. With a `FakeClock` past the configured time and `dev` changed, the hub submits exactly one soak run, and none when the tree is unchanged, proved by a scheduling test.
  - done: impl-715 · 2026-10-18T16:32:48.135Z
- [x] C2. A soak whose reservation would exceed the daily cap is skipped with one notice naming the cap, proved by a test with the spend ledger.
  - done: impl-715 · 2026-10-18T16:32:49.031Z
- [x] C3. A green soak records a coverage map that task selection reads, proved by a selection test.
  - done: impl-715 · 2026-10-18T16:32:50.172Z
- [x] C4. A red soak posts a quarantine proposal per failing test and leaves the merge queue running, proved by a test.
  - done: impl-715 · 2026-10-18T16:41:46.391Z

## Comments

### impl-715 · 2026-10-18T16:26:47.418Z

C1 scheduling red→green recorded (initial 0 !== 1 failure; FakeClock scheduling now passes in 0.22s). Shared ledger cap test passes in 0.07s, including one $0.1 cap notice across reopen and no provider creation. Green dispatch frame test initially failed human !== hub; hub-authored nightly results and published coverage selection now pass in 0.66s. Building C4 proposal/reporting next.

### rev-31 · 2026-10-18T16:35:26.137Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-715-source-1
commit: 6210a29af36528bfdedf7b289a39283a2dcc1c33
scope: full
findings: [{"severity":"medium","text":"Timing receipts include skipped/TODO and other non-pass completions; exit 0 plus failingTests filtering can falsely record these as lastGreen and later publish an unsupported quarantine proposal. Establish last green only from explicit completed-pass evidence.","file":"hub/src/hub/soak-quarantine.ts","line":29}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-715 source review

Head: 6210a29af36528bfdedf7b289a39283a2dcc1c33
Fixed base: d9d8e40944af9200a7c9c2e3b7070f87f809bfa8
Scope: full.

Standards: no separate findings. New scheduling/config tests retain the approved T1 seam and frame/ledger tests the approved T2 seam with FakeClock/scripted services. Daily attempts persist before I/O; one explicit droplet uses the existing shared reservation and coverage publication paths. The new occasion is validated centrally and included in tier planning. No new wall-clock waits, real-process tests or duration allowances.

Spec: not clear.
M1 (medium), hub/src/hub/soak-quarantine.ts:29: An exit-0 suite plus timingReceipts is not evidence that each identity passed. skip-reporter.ts:44–45 emits timing rows for skipped/TODO/failed completions as well, while timingReceipts drops the outcome. The failingTests exclusion does not remove skipped/TODO or every accounted quarantined failure. A later soak failure can therefore publish a quarantine proposal whose lastGreen points to an unexecuted or failed test. Require an explicit completed-pass receipt with conservative handling of other/unknown outcomes; add negative controls for skipped/TODO/quarantined/unknown receipts and a positive executed-pass proposal control. Implementer confirmed the gap in 87887c41-d80c-472b-9a4c-3a874e0f7f49 and will submit a corrected head for source review.

C4 fails this source pass. C1–C3 remain unverified: their described scheduling, cap refusal and coverage-selection tests have source coverage but await the corrected head and post-source task execution. Coordinator decisions 45d48396 and a48453ed were independently read: C5 moved to T-812, seams approved, and the minimal shared quarantine-proposal shape is owned here for T-712 reuse. No per-item QA. No verification at the superseded head; the T-813 hold remains in force.

Evidence: A-5439.

Criteria: C4 failed (Last-green eligibility accepts skipped/TODO or accounted non-pass identities because timing rows carry no outcome.).

### rev-31 · 2026-10-18T16:39:22.192Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-715-source-2
commit: ffcccfac8ef01d4acf5a3ead441eae915845efb8
scope: full
findings: [{"severity":"medium","text":"suiteProgress drops cancelled finish-only receipts; a different pass for the identity can still establish lastGreen despite observed cancellation.","file":"hub/src/hub/soak-quarantine.ts","line":32},{"severity":"medium","text":"Nested receipts without parentId have unqualified names, so the prefix-based belongs filter ignores their non-pass/unfinished outcomes and can incorrectly establish their parent's lastGreen.","file":"hub/src/hub/soak-quarantine.ts","line":43}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-715 corrected-source review

Head: ffcccfac8ef01d4acf5a3ead441eae915845efb8
Scope: full follow-up to rev-20261018-715-source-1. Three-file correction against 6210a29a; no dev merge.

Standards: no separate findings. Explicit pass evidence replaces timing-only evidence; tests cover skipped, TODO, cancelled-with-start, accounted quarantine failure, mixed repetition, qualified failed child and unfinished identities. C1–C3 source is unchanged.

Spec: not clear; C4 remains incomplete.
M1 (medium), hub/src/hub/soak-quarantine.ts:32: suiteProgress deliberately drops cancelled finish rows, preserving cancellation only through an observed start. A finish-only cancellation in a later repetition can disappear from completed/unfinished, so another pass for that identity is still admitted as lastGreen. Preserve explicit cancellation evidence even when its start is unavailable; add the finish-only negative control.
M2 (medium), hub/src/hub/soak-quarantine.ts:43: belongs() assumes nested receipts carry a parent-qualified name. skip-reporter.ts:27–33 explicitly supports legacy events without parentId and emits unqualified child names for them. A nested non-pass or unfinished child is then ignored while its top-level pass establishes lastGreen. Withhold green when non-pass descendant ancestry is unknown; add an unqualified nested negative control.

Implementer confirmed both missing invariants in 41d2e111-ac23-47aa-a86f-3bbaa6b9eb89. No separate production issue or source edits by Reviewer. C4 failed; C1–C3 remain run-unverified. Revised source review is required before verification; T-813 hold remains active.

Evidence: A-5444.

Criteria: C4 failed (Finish-only cancellation and unqualified nested non-pass evidence can still be lost from last-green eligibility.).

### rev-31 · 2026-10-18T16:44:23.616Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-715-source-3
commit: 235a69eb95f4babc83284766bfbbd0e18d9bb73a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-715 source review

Head: 235a69eb95f4babc83284766bfbbd0e18d9bb73a
Scope: full corrected-source follow-up; original fixed base d9d8e40944af9200a7c9c2e3b7070f87f809bfa8. Latest correction compared with ffcccfac; no dev merge after initial source review.

Standards: clear. Approved FakeClock/candidate scheduling T1 and scripted provider/dispatch T2 seams remain; no real-process additions, wall-clock waits or duration allowances. Configuration, UTC attempt persistence, explicit one-droplet policy, reservation and integrated coverage publication reuse their existing owners.

Spec: clear. All previous C4 findings are addressed. Per-test last green requires explicit completed-pass progress, never timing-only evidence. Raw cancellation finishes survive the interruption projection even without a start. Malformed or unknown outcome receipts withhold green. Non-pass/unfinished repetitions, qualified descendants and quarantine receipts block eligibility; unqualified or ambiguous nested ancestry withholds all greens for that file. The updated negative controls cover finish-only cancellation and legacy child names; positive proposal assertions still require exactly the two genuine pass identities and allow the following batch to complete. Git eligibility remains conservative on ancestry and executable-code changes. Shared General report shape is retained for T-712.

Findings: none. C1–C4 remain execution-unverified pending the post-source exact-head task result. A-5437/A-5441/A-5445 report targeted red-to-green and host checks; this review does not claim task verification ran. Coordinator decisions 45d48396/a48453ed approve the seams and move seven-night C5 observation to T-812. No per-item QA. Source clearance does not lift the T-813 verification hold or stage-1 merge hold; preserve this head until Coordinator all-clear permits the single mode-free droplet submission.

Evidence: A-5450.
